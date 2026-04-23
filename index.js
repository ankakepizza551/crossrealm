const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {};

// デッキ作成（各属性12枚、特殊カード33%）
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
  socket.on('join-room', ({ roomId, playerName }) => {
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

  socket.on('start-game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.deck = createDeck();
    const firstCard = room.deck.pop();
    room.fieldCard = firstCard;
    room.status = 'playing';
    room.turnIndex = 0;
    room.nextDrawAmount = 1;
    
    // 開幕がワイルド系ならホストに選択させる
    if (firstCard.realm === 'PLANET' || firstCard.realm === 'RUINS') {
        room.needsInitialChoice = true;
    }

    room.players.forEach(p => p.hand = room.deck.splice(0, 5));
    emitUpdate(roomId);
  });

  socket.on('play-card', ({ roomId, card, chosenRealm }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || room.players[room.turnIndex].id !== socket.id) return;

    player.hand = player.hand.filter(c => c.id !== card.id);
    
    // ワイルド処理
    const newFieldCard = { ...card };
    if (chosenRealm) {
        if (card.realm === 'PLANET') newFieldCard.wasPlanet = true;
        if (card.realm === 'RUINS') newFieldCard.wasRuins = true;
        newFieldCard.realm = chosenRealm;
    }
    room.fieldCard = newFieldCard;

    // 特殊効果のスタックと反転
    if (card.isSpecial) {
      if (card.realm === 'GEAR') {
        room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : room.nextDrawAmount + 2;
      }
      if (card.realm === 'MACHINE') room.isReversed = !room.isReversed;
    }

    if (player.hand.length === 0) {
      room.status = 'finished';
      io.to(roomId).emit('game-over', { winnerName: player.name });
    } else {
      const direction = room.isReversed ? -1 : 1;
      room.turnIndex = (room.turnIndex + direction + room.players.length) % room.players.length;
    }
    emitUpdate(roomId);
  });

  socket.on('draw-card', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const player = room.players[room.turnIndex];
    if (player.id !== socket.id) return;

    const amount = room.nextDrawAmount;
    for (let i = 0; i < amount; i++) {
      if (room.deck.length > 0) player.hand.push(room.deck.pop());
    }
    
    // スタックリセットと強制ターン交代
    room.nextDrawAmount = 1;
    const direction = room.isReversed ? -1 : 1;
    room.turnIndex = (room.turnIndex + direction + room.players.length) % room.players.length;
    emitUpdate(roomId);
  });

  socket.on('set-initial-realm', ({ roomId, chosenRealm }) => {
    const room = rooms[roomId];
    if (room && room.needsInitialChoice) {
      room.fieldCard.realm = chosenRealm;
      room.needsInitialChoice = false;
      emitUpdate(roomId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
