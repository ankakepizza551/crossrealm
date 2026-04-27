const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"] 
  } 
});

const rooms = {};
const HAND_LIMIT = 10; // 10枚で脱落
const INITIAL_HAND = 5;

const REALM_NAME_JA = { GEAR: '歯車', ICEAGE: '氷河期', FOUNTAIN: '噴水', BATTERY: '電池', MACHINE: '機械', ARCHIVE: '古文書', PLANET: '惑星', RUINS: '廃墟' };

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

// 生存しているプレイヤーを探して次のターンを決定
function nextTurn(room, skip = false) {
  const step = room.isReversed ? -1 : 1;
  const survivors = room.players.filter(p => !p.isEliminated);
  
  if (survivors.length <= 1) return; // 生存者が1人なら終了チェックへ

  let nextIdx = room.turnIndex;
  const repeatCount = skip ? 2 : 1;

  for (let s = 0; s < repeatCount; s++) {
    do {
      nextIdx = (nextIdx + step + room.players.length) % room.players.length;
    } while (room.players[nextIdx].isEliminated);
  }
  
  room.turnIndex = nextIdx;
  room.currentTurnPlayerId = room.players[room.turnIndex].id;
}

function canPlay(room, card) {
    if (!room || !card || !room.fieldCard) return false;
    if (room.nextDrawAmount > 1) return (card.realm === 'GEAR' && card.isSpecial);
    const field = room.fieldCard.realm;
    const h = card.realm;
    if (h === 'PLANET' || h === 'RUINS' || field === 'PLANET' || field === 'RUINS') return true;
    if (h === 'FOUNTAIN' && card.isSpecial) return (field === 'ICEAGE' || field === 'FOUNTAIN');
    const cycle = { GEAR:['GEAR','ICEAGE'], ICEAGE:['FOUNTAIN','BATTERY'], FOUNTAIN:['FOUNTAIN','BATTERY'], BATTERY:['MACHINE','ARCHIVE'], MACHINE:['MACHINE','ARCHIVE'], ARCHIVE:['GEAR','ICEAGE'] };
    if (['ICEAGE', 'BATTERY', 'ARCHIVE'].includes(field) && field === h) return false;
    return field === h || (cycle[field] && cycle[field].includes(h));
}

function checkGameOver(room) {
  const survivors = room.players.filter(p => !p.isEliminated);
  // 手札0枚のプレイヤーがいるか、生存者が1人以下なら終了
  const winnerFound = room.players.some(p => !p.isEliminated && p.handCount === 0);
  
  if (winnerFound || survivors.length <= 1) {
    room.status = 'finished';
    const winner = survivors.find(p => p.handCount === 0) || survivors[0];
    room.logs.push({ id: Math.random(), text: `MISSION COMPLETE: ${winner ? winner.name : 'NONE'} が勝者です` });
    return true;
  }
  return false;
}

function handlePlayerExit(socket, roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const pIndex = room.players.findIndex(p => p.id === socket.id);
  if (pIndex === -1) return;
  const player = room.players[pIndex];
  room.logs.push({ id: Math.random(), text: `${player.name} が戦線を離脱しました` });
  room.players.splice(pIndex, 1);
  
  if (room.players.filter(p => !p.isBot).length === 0) {
    delete rooms[roomId];
    return;
  }
  
  if (room.status === 'playing') {
    if (!checkGameOver(room)) {
      if (pIndex < room.turnIndex) room.turnIndex--;
      room.turnIndex = (room.turnIndex + room.players.length) % room.players.length;
      nextTurn(room, false);
    }
  }
  io.to(roomId).emit('update-game', room);
}

function processBotTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing') return;
  const bot = room.players[room.turnIndex];
  if (!bot || !bot.isBot || bot.isActing || bot.isEliminated) return;
  
  bot.isActing = true;
  setTimeout(() => {
    bot.isActing = false;
    // 最新の部屋状態を再取得
    if (!rooms[roomId] || rooms[roomId].status !== 'playing') return;
    
    const action = getBotAction(room, bot);
    if (action.type === 'draw') {
      const amount = room.nextDrawAmount || 1;
      for (let i = 0; i < amount; i++) { 
        if (room.deck.length === 0) room.deck = createDeck(); 
        bot.hand.push(room.deck.pop()); 
      }
      room.logs.push({ id: Math.random(), text: `${bot.name} が ${amount}枚 ドローしました` });
      room.nextDrawAmount = 1;
      bot.handCount = bot.hand.length;
      
      if (bot.handCount >= HAND_LIMIT) {
        bot.isEliminated = true;
        room.logs.push({ id: Math.random(), text: `臨界突破: ${bot.name} が脱落しました！` });
      }
    } else {
      const { card, chosenRealm } = action;
      bot.hand = bot.hand.filter(c => c.id !== card.id);
      const originalRealm = card.realm;
      if (chosenRealm) { card.wasFountain = card.realm === 'FOUNTAIN'; card.realm = chosenRealm; }
      room.fieldCard = card;
      room.logs.push({ id: Math.random(), text: `${bot.name} が ${REALM_NAME_JA[originalRealm] || originalRealm} を展開` });
      
      if (card.isSpecial) {
        if (card.realm === 'GEAR') room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : (room.nextDrawAmount || 0) + 2;
        if (card.realm === 'MACHINE') room.isReversed = !room.isReversed;
      }
      bot.handCount = bot.hand.length;
    }

    if (!checkGameOver(room)) {
      nextTurn(room, action.card?.isSpecial && action.card.realm === 'MACHINE' && room.players.length === 2);
    }
    
    io.to(roomId).emit('update-game', room);
    if (room.status === 'playing' && room.players[room.turnIndex]?.isBot) processBotTurn(roomId);
  }, 1200);
}

function getBotAction(room, bot) {
  const playable = bot.hand.filter(card => canPlay(room, card));
  if (playable.length === 0) return { type: 'draw' };
  let targetCard = playable[Math.floor(Math.random() * playable.length)];
  let chosenRealm = undefined;
  if (['PLANET', 'RUINS', 'FOUNTAIN'].includes(targetCard.realm) && (targetCard.realm !== 'FOUNTAIN' || targetCard.isSpecial)) {
    chosenRealm = ['GEAR', 'FOUNTAIN', 'MACHINE'][Math.floor(Math.random() * 3)];
  }
  return { type: 'play', card: targetCard, chosenRealm };
}

io.on('connection', (socket) => {
  socket.on('join-room', (data) => {
    const rid = data.roomId.toUpperCase();
    if (!rooms[rid]) rooms[rid] = { id: rid, players: [], deck: [], fieldCard: null, turnIndex: 0, status: 'waiting', nextDrawAmount: 1, isReversed: false, logs: [], currentTurnPlayerId: null };
    const room = rooms[rid];
    if (room.status !== 'waiting' || room.players.length >= 5) return;
    room.players.push({ id: socket.id, name: (data.playerName || 'Pilot').substring(0,10), hand: [], handCount: 0, isBot: false, isEliminated: false });
    socket.join(rid);
    io.to(rid).emit('update-game', room);
  });

  socket.on('add-cpu', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.status === 'waiting' && room.players.length < 5) {
      room.players.push({ id: 'CPU_' + Math.random().toString(36).substr(2,5), name: data.botName + ' (AI)', hand: [], handCount: 0, isBot: true, isEliminated: false });
      io.to(room.id).emit('update-game', room);
    }
  });

  socket.on('start-game', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.players.length >= 2) {
      room.deck = createDeck();
      room.turnIndex = Math.floor(Math.random() * room.players.length);
      room.players.forEach(p => { 
        p.hand = []; for (let i = 0; i < INITIAL_HAND; i++) p.hand.push(room.deck.pop());
        p.handCount = p.hand.length; 
        p.isEliminated = false;
      });
      room.fieldCard = room.deck.pop();
      room.status = 'playing';
      room.currentTurnPlayerId = room.players[room.turnIndex].id;
      room.logs = [{ id: Math.random(), text: "ミッション開始。リンク完了。" }];
      io.to(room.id).emit('update-game', room);
      if (room.players[room.turnIndex].isBot) processBotTurn(room.id);
    }
  });

  socket.on('play-card', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;
    const player = room.players.find(p => p.id === socket.id);
    player.hand = player.hand.filter(c => c.id !== data.card.id);
    const card = data.card;
    const originalRealm = card.realm;
    if (data.chosenRealm) { card.wasFountain = card.realm === 'FOUNTAIN'; card.realm = data.chosenRealm; }
    room.fieldCard = card;
    room.logs.push({ id: Math.random(), text: `${player.name} が ${REALM_NAME_JA[originalRealm] || originalRealm} を展開` });
    
    let skip = false;
    if (card.isSpecial) {
      if (card.realm === 'GEAR') room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : (room.nextDrawAmount || 0) + 2;
      if (card.realm === 'MACHINE') room.isReversed = !room.isReversed;
    }
    player.handCount = player.hand.length;
    
    if (!checkGameOver(room)) {
      nextTurn(room, card.isSpecial && card.realm === 'MACHINE' && room.players.length === 2);
    }
    io.to(room.id).emit('update-game', room);
    if (room.status === 'playing' && room.players[room.turnIndex].isBot) processBotTurn(room.id);
  });

  socket.on('draw-card', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;
    const player = room.players.find(p => p.id === socket.id);
    const amount = room.nextDrawAmount || 1;
    for (let i = 0; i < amount; i++) { if (room.deck.length === 0) room.deck = createDeck(); player.hand.push(room.deck.pop()); }
    player.handCount = player.hand.length;
    room.logs.push({ id: Math.random(), text: `${player.name} が ${amount}枚 ドロー` });
    room.nextDrawAmount = 1;

    if (player.handCount >= HAND_LIMIT) {
      player.isEliminated = true;
      room.logs.push({ id: Math.random(), text: `臨界突破: ${player.name} が脱落しました！` });
    }

    if (!checkGameOver(room)) {
      nextTurn(room);
    }
    io.to(room.id).emit('update-game', room);
    if (room.status === 'playing' && room.players[room.turnIndex].isBot) processBotTurn(room.id);
  });

  socket.on('play-again', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room) { room.status = 'waiting'; room.logs = []; io.to(room.id).emit('update-game', room); }
  });

  socket.on('leave-room', (data) => { if (data.roomId) handlePlayerExit(socket, data.roomId.toUpperCase()); });
  socket.on('disconnect', () => { for (const rid in rooms) handlePlayerExit(socket, rid); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
