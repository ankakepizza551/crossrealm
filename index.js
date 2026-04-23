const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {}; 

const createDeck = () => {
  const realms = ['GEAR', 'ICEAGE', 'FOUNTAIN', 'BATTERY', 'MACHINE', 'ARCHIVE', 'PLANET', 'RUINS'];
  let deck = [];
  realms.forEach(realm => {
    for (let i = 0; i < 12; i++) {
      let card = { id: Math.random().toString(36).substr(2, 9), realm };
      if (i % 3 === 0 && i < 10) card.isSpecial = true;
      deck.push(card);
    }
  });
  return deck.sort(() => Math.random() - 0.5);
};

const emitUpdate = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('update-game', {
    status: room.status,
    players: room.players.map(p => ({ id: p.id, name: p.name, handCount: p.hand.length, hand: p.hand })),
    fieldCard: room.fieldCard,
    currentTurnPlayerId: room.players[room.turnIndex]?.id,
    nextDrawAmount: room.nextDrawAmount,
    isReversed: room.isReversed
  });
};

io.on('connection', (socket) => {
  socket.on('join-room', (data) => {
    const { roomId, playerName } = data;
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { status: 'waiting', deck: [], fieldCard: null, players: [], turnIndex: 0, nextDrawAmount: 1, isReversed: false };
    }
    const room = rooms[roomId];
    if (room.players.length < 4 && room.status === 'waiting') {
      if (!room.players.find(p => p.id === socket.id)) {
        room.players.push({ id: socket.id, name: playerName || `Player ${room.players.length + 1}`, hand: [] });
      }
      emitUpdate(roomId);
    }
  });

  socket.on('start-game', (data) => {
    const room = rooms[data.roomId];
    if (room && room.players.length >= 2) {
      room.deck = createDeck();
      room.fieldCard = room.deck.pop();
      room.status = 'playing';
      room.turnIndex = 0;
      room.nextDrawAmount = 1;
      room.isReversed = false;
      room.players.forEach(p => { p.hand = room.deck.splice(0, 5); });
      emitUpdate(data.roomId);
    }
  });

  socket.on('play-card', (data) => {
    const room = rooms[data.roomId];
    if (!room || room.status !== 'playing') return;
    if (room.players[room.turnIndex].id !== socket.id) return;

    const player = room.players.find(p => p.id === socket.id);
    let card = data.card;
    player.hand = player.hand.filter(c => c.id !== card.id);

    // 廃墟（RUINS）のランダム属性処理
    if (card.realm === 'RUINS') {
      const normalRealms = ['GEAR', 'ICEAGE', 'FOUNTAIN', 'BATTERY', 'MACHINE', 'ARCHIVE'];
      card.realm = normalRealms[Math.floor(Math.random() * normalRealms.length)];
      card.wasRuins = true; // 元が廃墟だったことを記録（画像表示のため）
    }

    // 惑星や噴水ワイルドで属性が指定されている場合
    if (data.chosenRealm) {
      card.realm = data.chosenRealm;
      card.wasPlanet = true;
    }

    room.fieldCard = card;

    if (card.isSpecial) {
      if (card.realm === 'GEAR') room.nextDrawAmount = 2;
      if (card.realm === 'MACHINE') room.isReversed = !room.isReversed;
    }

    if (player.hand.length === 0) {
      room.status = 'finished';
      io.to(data.roomId).emit('game-over', { winnerName: player.name });
    }

    const direction = room.isReversed ? -1 : 1;
    room.turnIndex = (room.turnIndex + direction + room.players.length) % room.players.length;
    emitUpdate(data.roomId);
  });

  socket.on('draw-card', (data) => {
    const room = rooms[data.roomId];
    if (!room || room.status !== 'playing') return;
    if (room.players[room.turnIndex].id !== socket.id) return;
    const player = room.players.find(p => p.id === socket.id);
    for (let i = 0; i < room.nextDrawAmount; i++) {
      if (room.deck.length > 0) player.hand.push(room.deck.pop());
    }
    room.nextDrawAmount = 1;
    const direction = room.isReversed ? -1 : 1;
    room.turnIndex = (room.turnIndex + direction + room.players.length) % room.players.length;
    emitUpdate(data.roomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
