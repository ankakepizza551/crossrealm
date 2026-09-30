const test = require('node:test');
const assert = require('node:assert/strict');
const { io: ioClient } = require('socket.io-client');
const { server, io, rooms } = require('../index.js');

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

test('ホストが同じ名前で再接続してもホストのまま', async () => {
  const roomId = 'RECONNECT';
  const first = await connect();
  await joinRoom(first, roomId, 'Host', 1);

  // 切断を検知される前に、新しい接続で同じ名前のまま入り直す
  const second = await connect();
  const state = await joinRoom(second, roomId, 'Host', 1);
  assert.equal(state.hostId, second.id);
});
