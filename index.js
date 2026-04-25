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
    for (let i = 0; i < 7; i++) deck.push({ id: Math.random().toString(36).substr(2, 9), realm: r, isSpecial: false });
    for (let i = 0; i < 3; i++) deck.push({ id: Math.random().toString(36).substr(2, 9), realm: r, isSpecial: true });
  });
  subs.forEach(r => {
    for (let i = 0; i < 5; i++) deck.push({ id: Math.random().toString(36).substr(2, 9), realm: r, isSpecial: false });
  });
  wilds.forEach(r => {
    for (let i = 0; i < 3; i++) deck.push({ id: Math.random().toString(36).substr(2, 9), realm: r, isSpecial: false });
  });
  return deck.sort(() => Math.random() - 0.5);
}

function nextTurn(room, skip = false) {
  const step = room.isReversed ? -1 : 1;
  const count = skip ? 2 : 1;
  room.turnIndex = (room.turnIndex + (step * count) + room.players.length) % room.players.length;
}

function canPlay(room, card) {
    if (room.nextDrawAmount > 1) return (card.realm === 'GEAR' && card.isSpecial);
    const field = room.fieldCard.realm;
    const h = card.realm;
    if (h === 'PLANET' || h === 'RUINS') return true;
    if (field === 'PLANET' || field === 'RUINS') return true;
    if (h === 'FOUNTAIN' && card.isSpecial) return (field === 'ICEAGE' || field === 'FOUNTAIN');
    const cycle = { GEAR:['GEAR','ICEAGE'], ICEAGE:['FOUNTAIN','BATTERY'], FOUNTAIN:['FOUNTAIN','BATTERY'], BATTERY:['MACHINE','ARCHIVE'], MACHINE:['MACHINE','ARCHIVE'], ARCHIVE:['GEAR','ICEAGE'] };
    const isTransition = ['ICEAGE', 'BATTERY', 'ARCHIVE'].includes(field);
    if (field === h && isTransition) return false;
    return field === h || (cycle[field] && cycle[field].includes(h));
}

function getBotAction(room, bot) {
  const playable = bot.hand.filter(card => canPlay(room, card));
  if (playable.length === 0) return { type: 'draw' };
  let targetCard = playable[0];
  if (bot.personality === 'Aggressive') targetCard = playable.find(c => c.isSpecial) || playable[0];
  else if (bot.personality === 'Defensive') targetCard = (bot.hand.length < 7) ? (playable.find(c => !c.isSpecial && !['PLANET','RUINS'].includes(c.realm)) || playable[0]) : (playable.find(c => c.isSpecial) || playable[0]);
  else {
    const counts = {}; bot.hand.forEach(c => counts[c.realm] = (counts[c.realm] || 0) + 1);
    const fav = Object.keys(counts).reduce((a, b) => (counts[a] || 0) > (counts[b] || 0) ? a : b, 'GEAR');
    targetCard = playable.find(c => c.realm === fav) || playable[0];
  }
  let chosenRealm = undefined;
  if (['PLANET', 'RUINS', 'FOUNTAIN'].includes(targetCard.realm) && (targetCard.realm !== 'FOUNTAIN' || targetCard.isSpecial)) {
    const mains = ['GEAR', 'FOUNTAIN', 'MACHINE'];
    chosenRealm = mains[Math.floor(Math.random() * mains.length)];
  }
  return { type: 'play', card: targetCard, chosenRealm };
}

function processBotTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing') return;
  const bot = room.players[room.turnIndex];
  if (!bot || !bot.isBot || bot.isActing) return;

  bot.isActing = true;
  setTimeout(() => {
    bot.isActing = false;
    const currentRoom = rooms[roomId];
    if (!currentRoom || currentRoom.status !== 'playing' || currentRoom.players[currentRoom.turnIndex].id !== bot.id) return;
    const action = getBotAction(currentRoom, bot);
    if (action.type === 'draw') {
      const amount = currentRoom.nextDrawAmount;
      for (let i = 0; i < amount; i++) { if (currentRoom.deck.length === 0) currentRoom.deck = createDeck(); bot.hand.push(currentRoom.deck.pop()); }
      addLog(currentRoom, `[SYS] ${bot.name} ドロー ${amount}`);
      currentRoom.nextDrawAmount = 1; nextTurn(currentRoom);
    } else {
      const { card, chosenRealm } = action;
      bot.hand = bot.hand.filter(c => c.id !== card.id);
      if (chosenRealm) { card.wasPlanet = card.realm === 'PLANET'; card.wasRuins = card.realm === 'RUINS'; card.wasFountain = card.realm === 'FOUNTAIN'; card.realm = chosenRealm; }
      currentRoom.playHistory.push(JSON.parse(JSON.stringify(currentRoom.fieldCard)));
      if (currentRoom.playHistory.length > 5) currentRoom.playHistory.shift();
      currentRoom.fieldCard = card;
      addLog(currentRoom, `[PLAY] ${bot.name} : ${card.realm}${card.isSpecial ? '(S)' : ''}`);
      let skip = false;
      if (card.isSpecial) {
        if (card.realm === 'GEAR') currentRoom.nextDrawAmount = (currentRoom.nextDrawAmount === 1) ? 2 : currentRoom.nextDrawAmount + 2;
        if (card.realm === 'MACHINE') { currentRoom.isReversed = !currentRoom.isReversed; if (currentRoom.players.length === 2) skip = true; }
      }
      if (bot.hand.length === 0) currentRoom.status = 'finished'; else nextTurn(currentRoom, skip);
    }
    bot.handCount = bot.hand.length;
    currentRoom.players.forEach(p => { if (p.handCount > HAND_LIMIT) currentRoom.status = 'finished'; });
    currentRoom.currentTurnPlayerId = currentRoom.players[currentRoom.turnIndex].id;
    io.to(roomId).emit('update-game', currentRoom);
    if (currentRoom.status === 'playing' && currentRoom.players[currentRoom.turnIndex].isBot) processBotTurn(roomId);
  }, 1500);
}

function addLog(room, text) {
  room.logs.push({ id: Math.random(), text });
  if (room.logs.length > 30) room.logs.shift();
}

io.on('connection', (socket) => {
  socket.on('join-room', (data) => {
    const rid = data.roomId.toUpperCase();
    if (!rooms[rid]) rooms[rid] = { id: rid, players: [], deck: [], fieldCard: null, turnIndex: 0, status: 'waiting', nextDrawAmount: 1, isReversed: false, logs: [], playHistory: [], handLimit: HAND_LIMIT, currentTurnPlayerId: null };
    const room = rooms[rid];
    if (room.status !== 'waiting' || room.players.length >= 4) return socket.emit('join-error', '満員です');
    room.players.push({ id: socket.id, name: (data.playerName || 'Pilot').substring(0,10), hand: [], handCount: 0, isBot: false, isActing: false });
    socket.join(rid);
    io.to(rid).emit('update-game', room);
  });

  socket.on('add-cpu', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.status === 'waiting' && room.players.length < 4) {
      const bIdx = room.players.filter(p=>p.isBot).length;
      const pInfo = PERSONALITIES[bIdx % PERSONALITIES.length];
      room.players.push({ id: 'CPU_' + Math.random().toString(36).substr(2,5), name: pInfo.name, personality: pInfo.type, hand: [], handCount: 0, isBot: true, isActing: false });
      io.to(room.id).emit('update-game', room);
    }
  });

  socket.on('start-game', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.players.length >= 2) {
      room.players = room.players.sort(() => Math.random() - 0.5); // プレイ順シャッフル
      room.status = 'playing';
      room.deck = createDeck();
      room.turnIndex = 0;
      room.isReversed = false;
      room.nextDrawAmount = 1;
      room.logs = [];
      room.playHistory = [];
      room.players.forEach(p => { 
        p.hand = []; 
        for (let i = 0; i < INITIAL_HAND; i++) p.hand.push(room.deck.pop()); 
        p.handCount = p.hand.length; 
        p.isActing = false;
      });
      room.fieldCard = room.deck.pop();
      addLog(room, "[SYS] ミッション開始");
      room.currentTurnPlayerId = room.players[room.turnIndex].id;
      io.to(room.id).emit('update-game', room);
      if (room.players[room.turnIndex].isBot) processBotTurn(room.id);
    }
  });

  socket.on('play-card', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;
    if (!canPlay(room, data.card)) return;
    const player = room.players.find(p => p.id === socket.id);
    player.hand = player.hand.filter(c => c.id !== data.card.id);
    const card = data.card;
    if (data.chosenRealm) { card.wasPlanet = card.realm === 'PLANET'; card.wasRuins = card.realm === 'RUINS'; card.wasFountain = card.realm === 'FOUNTAIN'; card.realm = data.chosenRealm; }
    room.playHistory.push(JSON.parse(JSON.stringify(room.fieldCard)));
    if (room.playHistory.length > 5) room.playHistory.shift();
    room.fieldCard = card;
    addLog(room, `[PLAY] ${player.name} : ${card.realm}${card.isSpecial ? '(S)' : ''}`);
    let skip = false;
    if (card.isSpecial) {
      if (card.realm === 'GEAR') room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : room.nextDrawAmount + 2;
      if (card.realm === 'MACHINE') { room.isReversed = !room.isReversed; if (room.players.length === 2) skip = true; }
    }
    if (player.hand.length === 0) room.status = 'finished'; else nextTurn(room, skip);
    player.handCount = player.hand.length;
    room.currentTurnPlayerId = room.players[room.turnIndex].id;
    io.to(room.id).emit('update-game', room);
    if (room.status === 'playing' && room.players[room.turnIndex].isBot) processBotTurn(room.id);
  });

  socket.on('draw-card', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;
    const player = room.players.find(p => p.id === socket.id);
    const amount = room.nextDrawAmount;
    for (let i = 0; i < amount; i++) { if (room.deck.length === 0) room.deck = createDeck(); player.hand.push(room.deck.pop()); }
    addLog(room, `[SYS] ${player.name} ドロー ${amount}`);
    room.nextDrawAmount = 1; player.handCount = player.hand.length;
    if (player.handCount > HAND_LIMIT) room.status = 'finished'; else nextTurn(room);
    room.currentTurnPlayerId = room.players[room.turnIndex].id;
    io.to(room.id).emit('update-game', room);
    if (room.status === 'playing' && room.players[room.turnIndex].isBot) processBotTurn(room.id);
  });

  socket.on('play-again', (data) => {
    const rid = data.roomId.toUpperCase();
    const room = rooms[rid];
    if (room) {
        room.status = 'waiting';
        room.deck = []; room.fieldCard = null; room.turnIndex = 0; room.nextDrawAmount = 1; room.isReversed = false; room.logs = []; room.playHistory = []; room.currentTurnPlayerId = null;
        room.players.forEach(p => { p.hand = []; p.handCount = 0; p.isActing = false; });
        io.to(rid).emit('update-game', room);
    }
  });
});

server.listen(3000, () => console.log('Server running on port 3000'));
