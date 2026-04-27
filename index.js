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

// 共通のプレイヤー削除・クリーンアップ処理
function handlePlayerExit(socket, roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const pIndex = room.players.findIndex(p => p.id === socket.id);
  if (pIndex === -1) return;

  const player = room.players[pIndex];
  room.logs = room.logs || [];
  room.logs.push({ id: Math.random(), text: `[SYS] ${player.name} が退出しました` });

  room.players.splice(pIndex, 1);

  // 人間がいなくなれば部屋を削除
  const humans = room.players.filter(p => !p.isBot);
  if (humans.length === 0) {
    delete rooms[roomId];
    return;
  }

  // プレイ中ならターン調整
  if (room.status === 'playing') {
    if (room.players.length < 2) {
      room.status = 'finished';
      room.logs.push({ id: Math.random(), text: `[SYS] プレイヤー不足により終了します` });
    } else {
      if (pIndex < room.turnIndex) {
        room.turnIndex--;
      } else if (pIndex === room.turnIndex) {
        room.turnIndex = room.turnIndex % room.players.length;
      }
      if (room.players[room.turnIndex]) {
        room.currentTurnPlayerId = room.players[room.turnIndex].id;
      }
    }
  }

  io.to(roomId).emit('update-game', room);
  if (room.status === 'playing' && room.players[room.turnIndex]?.isBot) processBotTurn(roomId);
}

function getBotAction(room, bot) {
  const playable = bot.hand.filter(card => canPlay(room, card));
  if (playable.length === 0) return { type: 'draw' };
  
  let targetCard = playable[0];
  const pType = bot.personality || '';
  if (pType === 'AGGRO') targetCard = playable.find(c => c.isSpecial) || playable[0];
  else if (pType === 'DEFENSE') targetCard = bot.hand.length < 7 ? (playable.find(c => !c.isSpecial) || playable[0]) : playable[0];

  let chosenRealm = undefined;
  if (['PLANET', 'RUINS', 'FOUNTAIN'].includes(targetCard.realm) && (targetCard.realm !== 'FOUNTAIN' || targetCard.isSpecial)) {
    chosenRealm = ['GEAR', 'FOUNTAIN', 'MACHINE'][Math.floor(Math.random() * 3)];
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
    if (!currentRoom || currentRoom.status !== 'playing' || currentRoom.players[currentRoom.turnIndex]?.id !== bot.id) return;
    const action = getBotAction(currentRoom, bot);
    
    if (action.type === 'draw') {
      const amount = currentRoom.nextDrawAmount || 1;
      for (let i = 0; i < amount; i++) { if (currentRoom.deck.length === 0) currentRoom.deck = createDeck(); bot.hand.push(currentRoom.deck.pop()); }
      currentRoom.nextDrawAmount = 1; nextTurn(currentRoom);
    } else {
      const { card, chosenRealm } = action;
      bot.hand = bot.hand.filter(c => c.id !== card.id);
      if (chosenRealm) { card.wasPlanet = card.realm === 'PLANET'; card.wasRuins = card.realm === 'RUINS'; card.wasFountain = card.realm === 'FOUNTAIN'; card.realm = chosenRealm; }
      currentRoom.fieldCard = card;
      let skip = false;
      if (card.isSpecial) {
        if (card.realm === 'GEAR') currentRoom.nextDrawAmount = (currentRoom.nextDrawAmount === 1) ? 2 : (currentRoom.nextDrawAmount || 0) + 2;
        if (card.realm === 'MACHINE') { currentRoom.isReversed = !currentRoom.isReversed; if (currentRoom.players.length === 2) skip = true; }
      }
      if (bot.hand.length === 0) currentRoom.status = 'finished'; else nextTurn(currentRoom, skip);
    }
    bot.handCount = bot.hand.length;
    if (currentRoom.players[currentRoom.turnIndex]) currentRoom.currentTurnPlayerId = currentRoom.players[currentRoom.turnIndex].id;
    io.to(roomId).emit('update-game', currentRoom);
    if (currentRoom.status === 'playing' && currentRoom.players[currentRoom.turnIndex]?.isBot) processBotTurn(roomId);
  }, 1500);
}

io.on('connection', (socket) => {
  socket.on('join-room', (data) => {
    const rid = data.roomId.toUpperCase();
    if (!rooms[rid]) rooms[rid] = { id: rid, players: [], deck: [], fieldCard: null, turnIndex: 0, status: 'waiting', nextDrawAmount: 1, isReversed: false, logs: [], currentTurnPlayerId: null };
    const room = rooms[rid];
    if (room.status !== 'waiting' || room.players.length >= 5) return;
    room.players.push({ id: socket.id, name: (data.playerName || 'Pilot').substring(0,10), hand: [], handCount: 0, isBot: false });
    socket.join(rid);
    io.to(rid).emit('update-game', room);
  });

  // 明示的な退出イベント
  socket.on('leave-room', (data) => {
    if (data.roomId) handlePlayerExit(socket, data.roomId.toUpperCase());
  });

  socket.on('add-cpu', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.status === 'waiting' && room.players.length < 5) {
      room.players.push({ id: 'CPU_' + Math.random().toString(36).substr(2,5), name: data.botName + ' (AI)', personality: 'TACTICAL', hand: [], handCount: 0, isBot: true });
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
      });
      room.fieldCard = room.deck.pop();
      room.status = 'playing';
      room.currentTurnPlayerId = room.players[room.turnIndex].id;
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
    if (data.chosenRealm) { card.wasPlanet = card.realm === 'PLANET'; card.wasRuins = card.realm === 'RUINS'; card.wasFountain = card.realm === 'FOUNTAIN'; card.realm = data.chosenRealm; }
    room.fieldCard = card;
    let skip = false;
    if (card.isSpecial) {
      if (card.realm === 'GEAR') room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : (room.nextDrawAmount || 0) + 2;
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
    const amount = room.nextDrawAmount || 1;
    for (let i = 0; i < amount; i++) { if (room.deck.length === 0) room.deck = createDeck(); player.hand.push(room.deck.pop()); }
    room.nextDrawAmount = 1; player.handCount = player.hand.length;
    nextTurn(room);
    room.currentTurnPlayerId = room.players[room.turnIndex].id;
    io.to(room.id).emit('update-game', room);
    if (room.status === 'playing' && room.players[room.turnIndex].isBot) processBotTurn(room.id);
  });

  socket.on('play-again', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room) { room.status = 'waiting'; io.to(room.id).emit('update-game', room); }
  });

  socket.on('disconnect', () => {
    for (const rid in rooms) handlePlayerExit(socket, rid);
  });
});

server.listen(3000, () => console.log('Server running on port 3000'));
