const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {};
const HAND_LIMIT = 10;
const INITIAL_HAND = 5;

// CPUの性格定義
const PERSONALITIES = [
  { name: 'Astra', type: 'Aggressive', desc: '攻撃特化: 特殊カードを積極的に使用' },
  { name: 'Bern', type: 'Defensive', desc: '守備特化: 特殊カードを温存する' },
  { name: 'Ciel', type: 'Tactical', desc: '知略特化: 自分の手札に多い属性へ誘導' }
];

function createDeck() {
  const deck = [];
  const mainRealms = ['GEAR', 'MACHINE', 'FOUNTAIN'];
  const subRealms = ['ICEAGE', 'BATTERY', 'ARCHIVE'];
  const wildRealms = ['PLANET', 'RUINS'];

  mainRealms.forEach(r => {
    for (let i = 0; i < 7; i++) deck.push({ id: Math.random(), realm: r, isSpecial: false });
    for (let i = 0; i < 3; i++) deck.push({ id: Math.random(), realm: r, isSpecial: true });
  });
  subRealms.forEach(r => {
    for (let i = 0; i < 5; i++) deck.push({ id: Math.random(), realm: r, isSpecial: false });
  });
  wildRealms.forEach(r => {
    for (let i = 0; i < 3; i++) deck.push({ id: Math.random(), realm: r, isSpecial: false });
  });
  return deck.sort(() => Math.random() - 0.5);
}

// AIの思考ロジック
function getBotAction(room, bot) {
  const playable = bot.hand.filter(card => {
    if (room.nextDrawAmount > 1) return (card.realm === 'GEAR' && card.isSpecial);
    const field = room.fieldCard.realm;
    const h = card.realm;
    if (h === 'PLANET' || h === 'RUINS') return true;
    if (field === 'PLANET' || field === 'RUINS') return true;
    if (h === 'FOUNTAIN' && card.isSpecial) return (field === 'ICEAGE' || field === 'FOUNTAIN');
    const cycle = { GEAR:['GEAR','ICEAGE'], ICEAGE:['FOUNTAIN','BATTERY'], FOUNTAIN:['FOUNTAIN','BATTERY'], 
                    BATTERY:['MACHINE','ARCHIVE'], MACHINE:['MACHINE','ARCHIVE'], ARCHIVE:['GEAR','ICEAGE'] };
    return field === h || cycle[field]?.includes(h);
  });

  if (playable.length === 0) return { type: 'draw' };

  let targetCard = playable[0];

  // 性格別のカード選択
  if (bot.personality === 'Aggressive') {
    // 特殊カード(S)を優先
    targetCard = playable.find(c => c.isSpecial) || playable[0];
  } else if (bot.personality === 'Defensive') {
    // 手札が少ない時は特殊/ワイルドを温存(通常カードを優先)
    if (bot.hand.length < 7) {
      targetCard = playable.find(c => !c.isSpecial && !['PLANET','RUINS'].includes(c.realm)) || playable[0];
    } else {
      targetCard = playable.find(c => c.isSpecial) || playable[0];
    }
  } else if (bot.personality === 'Tactical') {
    // 自分の手札に一番多い属性を「出す属性」または「ワイルドで指定する属性」に選ぶ
    const counts = {};
    bot.hand.forEach(c => counts[c.realm] = (counts[c.realm] || 0) + 1);
    const favorite = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    targetCard = playable.find(c => c.realm === favorite) || playable[0];
  }

  // ワイルドカードだった場合の属性指定
  let chosenRealm = undefined;
  if (['PLANET', 'RUINS'].includes(targetCard.realm) || (targetCard.realm === 'FOUNTAIN' && targetCard.isSpecial)) {
    const counts = {};
    bot.hand.forEach(c => counts[c.realm] = (counts[c.realm] || 0) + 1);
    chosenRealm = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) || 'GEAR';
  }

  return { type: 'play', card: targetCard, chosenRealm };
}

function processBotTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing') return;
  const currentPlayer = room.players[room.turnIndex];
  if (!currentPlayer.isBot) return;

  setTimeout(() => {
    const action = getBotAction(room, currentPlayer);
    if (action.type === 'draw') {
      const amount = room.nextDrawAmount;
      for (let i = 0; i < amount; i++) {
        if (room.deck.length === 0) room.deck = createDeck();
        currentPlayer.hand.push(room.deck.pop());
      }
      room.logs.push({ id: Math.random(), text: `[SYS] ${currentPlayer.name} が ${amount}枚 ドロー` });
      room.nextDrawAmount = 1;
      room.turnIndex = (room.turnIndex + (room.isReversed ? -1 : 1) + room.players.length) % room.players.length;
    } else {
      const { card, chosenRealm } = action;
      currentPlayer.hand = currentPlayer.hand.filter(c => c.id !== card.id);
      if (chosenRealm) {
        card.wasPlanet = card.realm === 'PLANET';
        card.wasRuins = card.realm === 'RUINS';
        card.wasFountain = card.realm === 'FOUNTAIN';
        card.realm = chosenRealm;
      }
      room.playHistory.push(room.fieldCard);
      if (room.playHistory.length > 5) room.playHistory.shift();
      room.fieldCard = card;
      room.logs.push({ id: Math.random(), text: `[PLAY] ${currentPlayer.name} : ${card.realm}${card.isSpecial ? '(S)' : ''}` });
      
      // 効果処理
      if (card.isSpecial) {
        if (card.realm === 'GEAR') room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : room.nextDrawAmount + 2;
        if (card.realm === 'MACHINE') {
          room.isReversed = !room.isReversed;
          if (room.players.length === 2) { /* 2人時はスキップ相当なのでインデックス動かさない */ }
          else { room.turnIndex = (room.turnIndex + (room.isReversed ? -1 : 1) + room.players.length) % room.players.length; }
        }
      }

      if (currentPlayer.hand.length === 0) {
        room.status = 'finished';
      } else {
        room.turnIndex = (room.turnIndex + (room.isReversed ? -1 : 1) + room.players.length) % room.players.length;
      }
    }
    currentPlayer.handCount = currentPlayer.hand.length;
    
    // バースト判定
    room.players.forEach(p => {
      if (p.hand.length > HAND_LIMIT) room.status = 'finished';
    });

    io.to(roomId).emit('update-game', room);
    if (room.status === 'playing') processBotTurn(roomId);
  }, 1500);
}

io.on('connection', (socket) => {
  socket.on('join-room', (data) => {
    const rid = data.roomId.toUpperCase();
    if (!rooms[rid]) rooms[rid] = { id: rid, players: [], deck: [], fieldCard: null, turnIndex: 0, status: 'waiting', nextDrawAmount: 1, isReversed: false, logs: [], playHistory: [], handLimit: HAND_LIMIT };
    const room = rooms[rid];
    if (room.status !== 'waiting') return socket.emit('join-error', '対戦中です');
    if (room.players.length >= 4) return socket.emit('join-error', '満員です');
    room.players.push({ id: socket.id, name: data.playerName || 'Pilot', hand: [], handCount: 0, isBot: false });
    socket.join(rid);
    io.to(rid).emit('update-game', room);
  });

  socket.on('add-cpu', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.status === 'waiting' && room.players.length < 4) {
      const pInfo = PERSONALITIES[Math.min(room.players.filter(p=>p.isBot).length, 2)];
      room.players.push({
        id: 'CPU_' + Math.random().toString(36).substr(2,5),
        name: pInfo.name,
        personality: pInfo.type,
        hand: [], handCount: 0, isBot: true
      });
      io.to(room.id).emit('update-game', room);
    }
  });

  socket.on('start-game', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.players.length >= 2) {
      room.status = 'playing';
      room.deck = createDeck();
      room.players.forEach(p => {
        p.hand = [];
        for (let i = 0; i < INITIAL_HAND; i++) p.hand.push(room.deck.pop());
        p.handCount = p.hand.length;
      });
      room.fieldCard = room.deck.pop();
      room.logs = [{ id: 1, text: "[SYS] ミッション開始" }];
      io.to(room.id).emit('update-game', room);
      processBotTurn(room.id);
    }
  });

  socket.on('play-card', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    const player = room.players.find(p => p.id === socket.id);
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;

    const card = data.card;
    player.hand = player.hand.filter(c => c.id !== card.id);
    if (data.chosenRealm) {
      card.wasPlanet = card.realm === 'PLANET'; card.wasRuins = card.realm === 'RUINS';
      card.wasFountain = card.realm === 'FOUNTAIN'; card.realm = data.chosenRealm;
    }
    room.playHistory.push(room.fieldCard);
    if (room.playHistory.length > 5) room.playHistory.shift();
    room.fieldCard = card;
    room.logs.push({ id: Math.random(), text: `[PLAY] ${player.name} : ${card.realm}${card.isSpecial ? '(S)' : ''}` });

    if (card.isSpecial) {
      if (card.realm === 'GEAR') room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : room.nextDrawAmount + 2;
      if (card.realm === 'MACHINE') {
        room.isReversed = !room.isReversed;
        if (room.players.length === 2) { /* 連続手番用 */ }
        else { room.turnIndex = (room.turnIndex + (room.isReversed ? -1 : 1) + room.players.length) % room.players.length; }
      }
    }

    if (player.hand.length === 0) { room.status = 'finished'; }
    else { room.turnIndex = (room.turnIndex + (room.isReversed ? -1 : 1) + room.players.length) % room.players.length; }
    
    player.handCount = player.hand.length;
    io.to(room.id).emit('update-game', room);
    processBotTurn(room.id);
  });

  socket.on('draw-card', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    const player = room.players.find(p => p.id === socket.id);
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;

    const amount = room.nextDrawAmount;
    for (let i = 0; i < amount; i++) {
      if (room.deck.length === 0) room.deck = createDeck();
      player.hand.push(room.deck.pop());
    }
    room.logs.push({ id: Math.random(), text: `[SYS] ${player.name} が ${amount}枚 ドロー` });
    room.nextDrawAmount = 1;
    player.handCount = player.hand.length;
    if (player.handCount > HAND_LIMIT) { room.status = 'finished'; }
    else { room.turnIndex = (room.turnIndex + (room.isReversed ? -1 : 1) + room.players.length) % room.players.length; }
    io.to(room.id).emit('update-game', room);
    processBotTurn(room.id);
  });

  socket.on('play-again', (data) => {
    const rid = data.roomId.toUpperCase();
    if (rooms[rid]) rooms[rid].status = 'waiting';
    io.to(rid).emit('update-game', rooms[rid]);
  });
});

server.listen(3000, () => console.log('Server running on port 3000'));
