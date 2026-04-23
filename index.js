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
    isReversed: room.isReversed,
    needsInitialChoice: room.needsInitialChoice
  });
};

io.on('connection', (socket) => {
  socket.on('join-room', (data) => {
    const { roomId, playerName } = data;
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { status: 'waiting', deck: [], fieldCard: null, players: [], turnIndex: 0, nextDrawAmount: 1, isReversed: false, needsInitialChoice: false };
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
      let first = room.deck.pop();
      if (first.realm === 'PLANET' || first.realm === 'RUINS' || (first.realm === 'FOUNTAIN' && first.isSpecial)) {
        room.needsInitialChoice = true;
        if (first.realm === 'RUINS') first.wasRuins = true;
        if (first.realm === 'PLANET') first.wasPlanet = true;
      }
      room.fieldCard = first;
      room.status = 'playing';
      room.players.forEach(p => { p.hand = room.deck.splice(0, 5); });
      emitUpdate(data.roomId);
    }
  });

  socket.on('set-initial-realm', (data) => {
    const room = rooms[data.roomId];
    if (room && room.needsInitialChoice && room.players[0].id === socket.id) {
      room.fieldCard.realm = data.chosenRealm;
      room.needsInitialChoice = false;
      emitUpdate(data.roomId);
    }
  });

  socket.on('play-card', (data) => {
    const room = rooms[data.roomId];
    if (!room || room.status !== 'playing' || room.needsInitialChoice) return;
    if (room.players[room.turnIndex].id !== socket.id) return;

    const player = room.players.find(p => p.id === socket.id);
    let card = data.card;
    player.hand = player.hand.filter(c => c.id !== card.id);

    if (card.realm === 'RUINS') {
      const normal = ['GEAR', 'ICEAGE', 'FOUNTAIN', 'BATTERY', 'MACHINE', 'ARCHIVE'];
      card.realm = normal[Math.floor(Math.random() * normal.length)];
      card.wasRuins = true;
    }
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
    } else {
      const dir = room.isReversed ? -1 : 1;
      room.turnIndex = (room.turnIndex + dir + room.players.length) % room.players.length;
    }
    emitUpdate(data.roomId);
  });

  socket.on('draw-card', (data) => {
    const room = rooms[data.roomId];
    if (!room || room.status !== 'playing' || room.needsInitialChoice) return;
    if (room.players[room.turnIndex].id !== socket.id) return;
    const player = room.players.find(p => p.id === socket.id);
    for (let i = 0; i < room.nextDrawAmount; i++) {
      if (room.deck.length > 0) player.hand.push(room.deck.pop());
    }
    room.nextDrawAmount = 1;
    const dir = room.isReversed ? -1 : 1;
    room.turnIndex = (room.turnIndex + dir + room.players.length) % room.players.length;
    emitUpdate(data.roomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
