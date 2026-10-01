const test = require('node:test');
const assert = require('node:assert/strict');
const { io: ioClient } = require('socket.io-client');
const { server, io, rooms, checkGameOver } = require('../index.js');

let url;
const clients = [];

test.before(async () => {
  await new Promise(resolve => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

test.after(() => {
  clients.forEach(c => c.close());
  for (const rid in rooms) clearTimeout(rooms[rid].turnTimer);
  io.close();
});

function connect() {
  const client = ioClient(url, { transports: ['websocket'] });
  clients.push(client);
  return new Promise(resolve => client.on('connect', () => resolve(client)));
}

// 条件を満たす update-game を待つ
function waitForState(client, predicate, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`タイムアウト: ${label}`)), 5000);
    const onState = (state) => {
      if (!predicate(state)) return;
      clearTimeout(timer);
      client.off('update-game', onState);
      resolve(state);
    };
    client.on('update-game', onState);
  });
}

// 無視されるはずの操作がサーバーに届くのを待つ
const settle = () => new Promise(resolve => setTimeout(resolve, 200));

async function joinRoom(client, roomId, playerName, expectedPlayers) {
  const joined = waitForState(client, s => s.players.length === expectedPlayers, `${playerName} の入室`);
  client.emit('join-room', { roomId, playerName });
  return joined;
}

test('1人でプレイ: CPU追加後の start-game で試合が始まる', async () => {
  const client = await connect();
  const playing = waitForState(client, s => s.status === 'playing', '試合開始');

  // App.jsx の startSolo と同じ順序で送る
  const roomId = 'SOLO_TEST01';
  client.emit('join-room', { roomId, playerName: 'Tester' });
  for (let i = 0; i < 3; i++) client.emit('add-cpu', { roomId });
  client.emit('start-game', { roomId });

  const state = await playing;
  assert.equal(state.players.length, 4);
  assert.equal(state.players.filter(p => p.isBot).length, 3);
});

test('ホスト以外は試合開始・CPU追加・CPU削除ができない', async () => {
  const roomId = 'HOSTONLY';
  const host = await connect();
  const guest = await connect();
  const hostState = await joinRoom(host, roomId, 'Host', 1);
  assert.equal(hostState.hostId, host.id);
  await joinRoom(guest, roomId, 'Guest', 2);

  // ホストが CPU を1体追加しておく
  const withCpu = waitForState(guest, s => s.players.length === 3, 'CPU追加');
  host.emit('add-cpu', { roomId });
  const botId = (await withCpu).players.find(p => p.isBot).id;

  guest.emit('start-game', { roomId });
  guest.emit('add-cpu', { roomId });
  guest.emit('remove-cpu', { roomId, botId });
  await settle();
  assert.equal(rooms[roomId].status, 'waiting');
  assert.equal(rooms[roomId].players.length, 3);

  const playing = waitForState(guest, s => s.status === 'playing', 'ホストによる開始');
  host.emit('start-game', { roomId });
  await playing;

  // 試合中はホストでも start-game で配り直せない
  const hands = rooms[roomId].players.map(p => p.hand.map(c => c.id).join());
  host.emit('start-game', { roomId });
  await settle();
  assert.deepEqual(rooms[roomId].players.map(p => p.hand.map(c => c.id).join()), hands);
});

test('ホストが抜けると残った人間プレイヤーにホストが移る', async () => {
  const roomId = 'HANDOVER';
  const host = await connect();
  const guest = await connect();
  await joinRoom(host, roomId, 'Host', 1);
  const guestState = await joinRoom(guest, roomId, 'Guest', 2);
  const guestId = guestState.players.find(p => p.name === 'Guest').id;

  const handedOver = waitForState(guest, s => s.hostId === guestId, 'ホスト引き継ぎ');
  host.emit('leave-room', { roomId });
  await handedOver;

  const playing = waitForState(guest, s => s.status === 'playing', '新ホストによる開始');
  guest.emit('add-cpu', { roomId });
  guest.emit('start-game', { roomId });
  await playing;
});

// join-room を送り、サーバーから渡される再接続用トークンを受け取る
function joinWithToken(client, roomId, playerName, token) {
  const joined = new Promise(resolve => client.once('joined', resolve));
  client.emit('join-room', { roomId, playerName, token });
  return joined;
}

test('ホストが同じ名前・同じトークンで再接続してもホストのまま', async () => {
  const roomId = 'RECONNECT';
  const first = await connect();
  const { token } = await joinWithToken(first, roomId, 'Host');
  assert.equal(typeof token, 'string');

  // 切断を検知される前に、新しい接続で同じ名前・同じトークンのまま入り直す
  const second = await connect();
  const state = waitForState(second, s => s.players.length === 1, '再接続');
  const again = await joinWithToken(second, roomId, 'Host', token);
  assert.equal(again.token, token);
  assert.equal((await state).hostId, second.id);
});

test('同じ名前でもトークンがなければ席を乗っ取れず、別名で参加になる', async () => {
  const roomId = 'NOHIJACK';
  const host = await connect();
  await joinWithToken(host, roomId, 'Host');
  const intruder = await connect();
  const state = waitForState(intruder, s => s.players.length === 2, '別名で参加');
  await joinWithToken(intruder, roomId, 'Host', 'wrong-token');
  const s = await state;
  assert.deepEqual(s.players.map(p => p.name).sort(), ['Host', 'Host2']);
  assert.equal(s.hostId, host.id, 'ホストは元の接続のまま');
  assert.equal(rooms[roomId].players.find(p => p.name === 'Host').id, host.id);
});

test('CPUと同じ名前で入ってもCPUの席は乗っ取れない', async () => {
  const roomId = 'NOBOTHIJACK';
  const host = await connect();
  await joinWithToken(host, roomId, 'Host');
  const withCpu = waitForState(host, s => s.players.length === 2, 'CPU追加');
  host.emit('add-cpu', { roomId });
  const botName = (await withCpu).players.find(p => p.isBot).name;

  const intruder = await connect();
  const state = waitForState(intruder, s => s.players.length === 3, '別名で参加');
  await joinWithToken(intruder, roomId, botName);
  const players = (await state).players;
  assert.equal(players.filter(p => p.isBot).length, 1, 'CPUはCPUのまま');
  assert.equal(players.filter(p => p.name === botName).length, 1, '名前は重複しない');
});

test('対戦中のルームには新しいプレイヤーは入れない', async () => {
  const roomId = 'NOMIDJOIN';
  const host = await connect();
  await joinWithToken(host, roomId, 'Host');
  const playing = waitForState(host, s => s.status === 'playing', '試合開始');
  host.emit('add-cpu', { roomId });
  host.emit('start-game', { roomId });
  await playing;

  const late = await connect();
  const error = new Promise(resolve => late.once('join-error', resolve));
  late.emit('join-room', { roomId, playerName: 'Late' });
  assert.match((await error).message, /対戦中/);
  assert.equal(rooms[roomId].players.length, 2);
});

test('不正なメッセージを送られてもサーバーは落ちない', async () => {
  const bad = await connect();
  const payloads = [undefined, null, {}, { roomId: 123 }, { roomId: null }, { roomId: 'NOPE' }, { roomId: 'x'.repeat(100), playerName: 42 }];
  for (const ev of ['join-room', 'add-cpu', 'remove-cpu', 'start-game', 'play-card', 'draw-card', 'play-again', 'leave-room']) {
    for (const data of payloads) bad.emit(ev, data);
  }
  await settle();
  // その後も普通に部屋を作って遊べる
  const ok = await connect();
  const { token } = await joinWithToken(ok, 'AFTERBAD', 'Pilot');
  assert.ok(token);
});

test('次のマッチへ: 全員が準備完了すると手札を配り直して次の試合が始まる', async () => {
  const roomId = 'NEXTMATCH';
  const host = await connect();
  await joinRoom(host, roomId, 'Host', 1);
  const playing = waitForState(host, s => s.status === 'playing', '1試合目の開始');
  host.emit('add-cpu', { roomId });
  host.emit('start-game', { roomId });
  await playing;

  // 1試合目をホストの勝ちで終わらせる
  const room = rooms[roomId];
  clearTimeout(room.turnTimer);
  const me = room.players.find(p => !p.isBot);
  me.hand = []; me.handCount = 0;
  assert.equal(checkGameOver(room), true);
  assert.equal(room.status, 'finished');
  assert.ok(me.basePoints > 0);

  const next = waitForState(host, s => s.status === 'playing' && s.matchCount === 2, '2試合目の開始');
  host.emit('play-again', { roomId });
  await next;

  assert.equal(room.logs[0].text, 'MATCH 2 開始。');
  for (const p of room.players) {
    assert.equal(p.hand.length, 5, `${p.name} の手札`);
    assert.equal(p.isEliminated, false);
    assert.equal(p.earnedPoints, 0);
    assert.equal(p.basePoints, 0);
    assert.equal(p.bonusPoints, 0);
    assert.equal(p.ready, p.isBot);
  }
  assert.ok(me.score > 0, 'シリーズの合計スコアは引き継がれる');
});

// A・B・C（＋任意のCPU）で対戦を始め、席順を A,B,C,… に固定して B の番にする
async function setupThreeHumans(roomId, cpuCount = 0) {
  const a = await connect(), b = await connect(), c = await connect();
  await joinWithToken(a, roomId, 'A');
  await joinWithToken(b, roomId, 'B');
  await joinWithToken(c, roomId, 'C');
  for (let i = 0; i < cpuCount; i++) a.emit('add-cpu', { roomId });
  const playing = waitForState(a, s => s.status === 'playing', '試合開始');
  a.emit('start-game', { roomId });
  await playing;
  const room = rooms[roomId];
  clearTimeout(room.turnTimer);
  room.players.sort((x, y) => x.name.localeCompare(y.name));
  room.isReversed = false;
  room.turnIndex = 1;
  room.currentTurnPlayerId = room.players[1].id;
  return { room, a, b, c };
}

test('手番外のプレイヤーが抜けても、今の手番は変わらない', async () => {
  const { room, a } = await setupThreeHumans('LEAVEOTHER');
  a.emit('leave-room', { roomId: 'LEAVEOTHER' });
  await settle();
  assert.equal(room.players[room.turnIndex].name, 'B');
  assert.equal(room.currentTurnPlayerId, room.players[room.turnIndex].id);
});

test('手番中のプレイヤーが抜けると、進行方向の次の人の番になる', async () => {
  const { room, b } = await setupThreeHumans('LEAVECUR');
  b.emit('leave-room', { roomId: 'LEAVECUR' });
  await settle();
  assert.equal(room.players[room.turnIndex].name, 'C');
});

test('REVERSE中に手番中のプレイヤーが抜けると、逆方向の次の人の番になる', async () => {
  const { room, b } = await setupThreeHumans('LEAVEREV');
  room.isReversed = true;
  b.emit('leave-room', { roomId: 'LEAVEREV' });
  await settle();
  assert.equal(room.players[room.turnIndex].name, 'A');
});

test('手番中のプレイヤーが抜けて次がCPUなら、CPUがすぐに動く', async () => {
  const roomId = 'LEAVEBOT';
  const host = await connect(), guest = await connect();
  await joinWithToken(host, roomId, 'Host');
  await joinWithToken(guest, roomId, 'Guest');
  host.emit('add-cpu', { roomId });
  const playing = waitForState(host, s => s.status === 'playing', '試合開始');
  host.emit('start-game', { roomId });
  await playing;
  const room = rooms[roomId];
  clearTimeout(room.turnTimer);
  // 席順を Guest → CPU → Host にして Guest の番に
  const order = [room.players.find(p => p.name === 'Guest'), room.players.find(p => p.isBot), room.players.find(p => p.name === 'Host')];
  room.players.splice(0, room.players.length, ...order);
  room.isReversed = false;
  room.turnIndex = 0;
  room.currentTurnPlayerId = order[0].id;
  room.logs.push({ id: 1, text: 'x' }); // 試合開始直後の長い待ち時間を避ける
  const bot = order[1];
  const before = bot.hand.length;

  guest.emit('leave-room', { roomId });
  // CPU が出すかドローして、手番がホストに回る
  const moved = waitForState(host, s => s.currentTurnPlayerId === host.id, 'CPUの行動');
  await moved;
  assert.notEqual(bot.hand.length, before, 'CPUがカードを出すかドローした');
});

test('1つの接続で入れる部屋は1つだけ（別の部屋に入ると前の部屋から抜ける）', async () => {
  const c = await connect();
  await joinWithToken(c, 'ONEROOM1', 'Solo');
  await joinWithToken(c, 'ONEROOM2', 'Solo');
  assert.equal(rooms['ONEROOM1'], undefined, '誰もいなくなった前の部屋は消える');
  assert.equal(rooms['ONEROOM2'].players.length, 1);
});

test('公開ルーム一覧は最大50件まで', async () => {
  for (let i = 0; i < 60; i++) {
    rooms[`FAKEPUB${i}`] = { id: `FAKEPUB${i}`, roomName: 'x', isPublic: true, status: 'waiting', hostId: 'h', players: [{ id: 'h', name: 'h', isBot: false }] };
  }
  const res = await fetch(`${url}/api/rooms`);
  const list = await res.json();
  for (let i = 0; i < 60; i++) delete rooms[`FAKEPUB${i}`];
  assert.equal(list.length, 50);
});
