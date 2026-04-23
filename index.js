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
    for (let i = 0; i <= 9; i++) {
      deck.push({ id: Math.random().toString(36).substr(2, 9), realm, number: i });
    }
  });
  return deck.sort(() => Math.random() - 0.5);
};

// 全員に現在のゲーム状態を送信する関数
const emitUpdate = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;

  const playersData = room.players.map(p => ({
    id: p.id,
    handCount: p.hand.length,
    hand: p.hand // フロント側で自分のみ抽出
  }));

  io.to(roomId).emit('update-game', {
    status: room.status,
    players: playersData,
    fieldCard: room.fieldCard,
    currentTurnPlayerId: room.players[room.turnIndex]?.id,
    nextDrawAmount: room.nextDrawAmount
  });
};

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { 
        status: 'waiting', 
        deck: [], 
        fieldCard: null, 
        players: [], 
        turnIndex: 0, 
        nextDrawAmount: 1 
      };
    }
    const room = rooms[roomId];
    
    // 最大4人まで
    if (room.players.length < 4 && room.status === 'waiting') {
      if (!room.players.find(p => p.id === socket.id)) {
        room.players.push({ id: socket.id, hand: [] });
      }
      emitUpdate(roomId);
    }
  });

  // ロビーでホストが「開始」を押した時の処理
  socket.on('start-game', (data) => {
    const room = rooms[data.roomId];
    if (room && room.players.length >= 2) {
      const deck = createDeck();
      room.deck = deck;
      room.fieldCard = room.deck.pop();
      room.status = 'playing';
      room.turnIndex = 0;
      room.nextDrawAmount = 1;

      room.players.forEach(p => {
        p.hand = room.deck.splice(0, 5);
      });
      emitUpdate(data.roomId);
    }
  });

  socket.on('play-card', (data) => {
    const room = rooms[data.roomId];
    if (!room || room.status !== 'playing') return;

    const card = data.card;
    room.fieldCard = card;
    const player = room.players.find(p => p.id === socket.id);
    
    if (player) {
      player.hand = player.hand.filter(c => c.id !== card.id);
      if (player.hand.length === 0) {
        room.status = 'finished';
        io.to(data.roomId).emit('game-over', { winnerId: socket.id });
      }
    }

    let skipNext = false;
    if (card.realm === 'GEAR' && card.number === 0) room.nextDrawAmount = 2;
    if (card.realm === 'MACHINE' && card.number <= 2) skipNext = true;

    if (!skipNext) {
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
    }
    emitUpdate(data.roomId);
  });

  socket.on('draw-card', (data) => {
    const room = rooms[data.roomId];
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      for (let i = 0; i < room.nextDrawAmount; i++) {
        if (room.deck.length > 0) player.hand.push(room.deck.pop());
      }
      room.nextDrawAmount = 1;
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      emitUpdate(data.roomId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
