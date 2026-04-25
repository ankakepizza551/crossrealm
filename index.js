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

const PERSONALITIES = [
  { name: 'Astra', type: 'Aggressive' },
  { name: 'Bern', type: 'Defensive' },
  { name: 'Ciel', type: 'Tactical' }
];

function createDeck() {
  const deck = [];
  const mains = ['GEAR', 'MACHINE', 'FOUNTAIN'];
  const subs = ['ICEAGE', 'BATTERY', 'ARCHIVE'];
  const wilds = ['PLANET', 'RUINS'];
  mains.forEach(r => {
    for (let i = 0; i < 7; i++) deck.push({ id: Math.random(), realm: r, isSpecial: false });
    for (let i = 0; i < 3; i++) deck.push({ id: Math.random(), realm: r, isSpecial: true });
  });
  subs.forEach(r => {
    for (let i = 0; i < 5; i++) deck.push({ id: Math.random(), realm: r, isSpecial: false });
  });
  wilds.forEach(r => {
    for (let i = 0; i < 3; i++) deck.push({ id: Math.random(), realm: r, isSpecial: false });
  });
  return deck.sort(() => Math.random() - 0.5);
}

function nextTurn(room, skip = false) {
  const step = room.isReversed ? -1 : 1;
  const count = skip ? 2 : 1;
  room.turnIndex = (room.turnIndex + (step * count) + room.players.length) % room.players.length;
}

function getBotAction(room, bot) {
  const playable = bot.hand.filter(card => {
    if (room.nextDrawAmount > 1) return (card.realm === 'GEAR' && card.isSpecial);
    const field = room.fieldCard.realm;
    const h = card.realm;
    if (h === 'PLANET' || h === 'RUINS') return true;
    if (field === 'PLANET' || field === 'RUINS') return true;
    if (h === 'FOUNTAIN' && card.isSpecial) return (field === 'ICEAGE' || field === 'FOUNTAIN');
    const cycle = { GEAR:['GEAR','ICEAGE'], ICEAGE:['FOUNTAIN','BATTERY'], FOUNTAIN:['FOUNTAIN','BATTERY'], BATTERY:['MACHINE','ARCHIVE'], MACHINE:['MACHINE','ARCHIVE'], ARCHIVE:['GEAR','ICEAGE'] };
    return field === h || (cycle[field] && cycle[field].includes(h));
  });

  if (playable.length === 0) return { type: 'draw' };

  let targetCard = playable[0];
  if (bot.personality === 'Aggressive') {
    targetCard = playable.find(c => c.isSpecial) || playable[0];
  } else if (bot.personality === 'Defensive') {
    targetCard = (bot.hand.length < 7) ? (playable.find(c => !c.isSpecial && !['PLANET','RUINS'].includes(c.realm)) || playable[0]) : (playable.find(c => c.isSpecial) || playable[0]);
  } else if (bot.personality === 'Tactical') {
    const counts = {};
    bot.hand.forEach(c => counts[c.realm] = (counts[c.realm] || 0) + 1);
    const fav = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'GEAR');
    targetCard = playable.find(c => c.realm === fav) || playable[0];
  }

  let chosenRealm = undefined;
  if (['PLANET', 'RUINS', 'FOUNTAIN'].includes(targetCard.realm) && (targetCard.realm !== 'FOUNTAIN' || targetCard.isSpecial)) {
    const mains = ['GEAR', 'FOUNTAIN', 'MACHINE'];
    const counts = { GEAR:0, FOUNTAIN:0, MACHINE:0 };
    bot.hand.forEach(c => { if(mains.includes(c.realm)) counts[c.realm]++; });
    chosenRealm = mains.reduce((a, b) => counts[a] >= counts[b] ? a : b);
  }
  return { type: 'play', card: targetCard, chosenRealm };
}

function processBotTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing') return;
  const bot = room.players[room.turnIndex];
  if (!bot || !bot.isBot) return;

  setTimeout(() => {
    // 状態の再確認（遅延中の切断対策）
    if (!rooms[roomId] || rooms[roomId].status !== 'playing' || rooms[roomId].players[rooms[roomId].turnIndex].id !== bot.id) return;

    const action = getBotAction(room, bot);
    if (action.type === 'draw') {
      const amount = room.nextDrawAmount;
      for (let i = 0; i < amount; i++) {
        if (room.deck.length === 0) room.deck = createDeck();
        bot.hand.push(room.deck.pop());
      }
      room.logs.push({ id: Math.random(), text: `[SYS] ${bot.name} ドロー ${amount}` });
      room.nextDrawAmount = 1;
      nextTurn(room);
    } else {
      const { card, chosenRealm } = action;
      bot.hand = bot.hand.filter(c => c.id !== card.id);
      if (chosenRealm) {
        card.wasPlanet = card.realm === 'PLANET'; card.wasRuins = card.realm === 'RUINS';
        card.wasFountain = card.realm === 'FOUNTAIN'; card.realm = chosenRealm;
      }
      room.playHistory.push(room.fieldCard);
      if (room.playHistory.length > 5) room.playHistory.shift();
      room.fieldCard = card;
      room.logs.push({ id: Math.random(), text: `[PLAY] ${bot.name} : ${card.realm}${card.isSpecial ? '(S)' : ''}` });
      
      let skip = false;
      if (card.isSpecial) {
        if (card.realm === 'GEAR') room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : room.nextDrawAmount + 2;
        if (card.realm === 'MACHINE') {
          room.isReversed = !room.isReversed;
          if (room.players.length === 2) skip = true;
        }
      }
      if (bot.hand.length === 0) room.status = 'finished';
      else nextTurn(room, skip);
    }
    bot.handCount = bot.hand.length;
    room.players.forEach(p => { if (p.handCount > HAND_LIMIT) room.status = 'finished'; });
    
    io.to(roomId).emit('update-game', room);
    if (room.status === 'playing') processBotTurn(roomId);
  }, 1200);
}

io.on('connection', (socket) => {
  socket.on('join-room', (data) => {
    const rid = data.roomId.toUpperCase();
    if (!rooms[rid]) rooms[rid] = { id: rid, players: [], deck: [], fieldCard: null, turnIndex: 0, status: 'waiting', nextDrawAmount: 1, isReversed: false, logs: [], playHistory: [], handLimit: HAND_LIMIT };
    const room = rooms[rid];
    if (room.status !== 'waiting' || room.players.length >= 4) return socket.emit('join-error', '参加不可');
    room.players.push({ id: socket.id, name: data.playerName || 'Pilot', hand: [], handCount: 0, isBot: false });
    socket.join(rid);
    io.to(rid).emit('update-game', room);
  });

  socket.on('add-cpu', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.status === 'waiting' && room.players.length < 4) {
      const bIdx = room.players.filter(p=>p.isBot).length;
      const pInfo = PERSONALITIES[bIdx % PERSONALITIES.length];
      room.players.push({ id: 'CPU_' + Math.random().toString(36).substr(2,5), name: pInfo.name, personality: pInfo.type, hand: [], handCount: 0, isBot: true });
      io.to(room.id).emit('update-game', room);
    }
  });

  socket.on('start-game', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.players.length >= 2) {
      room.status = 'playing'; room.deck = createDeck();
      room.players.forEach(p => {
        p.hand = []; for (let i = 0; i < INITIAL_HAND; i++) p.hand.push(room.deck.pop());
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
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;
    const player = room.players.find(p => p.id === socket.id);
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
    let skip = false;
    if (card.isSpecial) {
      if (card.realm === 'GEAR') room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : room.nextDrawAmount + 2;
      if (card.realm === 'MACHINE') {
        room.isReversed = !room.isReversed;
        if (room.players.length === 2) skip = true;
      }
    }
    if (player.hand.length === 0) room.status = 'finished';
    else nextTurn(room, skip);
    player.handCount = player.hand.length;
    io.to(room.id).emit('update-game', room);
    processBotTurn(room.id);
  });

  socket.on('draw-card', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;
    const player = room.players.find(p => p.id === socket.id);
    const amount = room.nextDrawAmount;
    for (let i = 0; i < amount; i++) {
      if (room.deck.length === 0) room.deck = createDeck();
      player.hand.push(room.deck.pop());
    }
    room.logs.push({ id: Math.random(), text: `[SYS] ${player.name} ドロー ${amount}` });
    room.nextDrawAmount = 1;
    player.handCount = player.hand.length;
    if (player.handCount > HAND_LIMIT) room.status = 'finished';
    else nextTurn(room);
    io.to(room.id).emit('update-game', room);
    processBotTurn(room.id);
  });

  socket.on('play-again', (data) => {
    const rid = data.roomId.toUpperCase();
    if (rooms[rid]) {
        rooms[rid].status = 'waiting';
        rooms[rid].players.forEach(p => { p.hand = []; p.handCount = 0; });
        rooms[rid].playHistory = [];
        rooms[rid].logs = [];
    }
    io.to(rid).emit('update-game', rooms[rid]);
  });
});

server.listen(3000, () => console.log('Server running on port 3000'));
