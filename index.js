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

// ゲーム開始・リセットの共通処理
const startGame = (roomId) => {
  const room = rooms[roomId];
  const deck = createDeck();
  room.deck = deck;
  room.fieldCard = deck.pop();
  room.turnIndex = 0;
  room.winner = null;

  room.players.forEach((player, index) => {
    player.hand = room.deck.splice(0, 5);
    io.to(player.id).emit('init-game', {
      hand: player.hand,
      fieldCard: room.fieldCard,
      isMyTurn: index === 0
    });
  });
};

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { deck: [], fieldCard: null, players: [], turnIndex: 0, winner: null };
    }
    const room = rooms[roomId];
    if (room.players.length < 2) {
      room.players.push({ id: socket.id, hand: [] });
      if (room.players.length === 2) {
        startGame(roomId);
      }
    }
  });

  socket.on('play-card', (data) => {
    const room = rooms[data.roomId];
    if (!room || room.winner) return;

    room.fieldCard = data.card;
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.hand = player.hand.filter(c => c.id !== data.card.id);
      
      // 勝利判定
      if (player.hand.length === 0) {
        room.winner = socket.id;
        io.to(data.roomId).emit('game-over', { winnerId: socket.id });
        return;
      }
    }
    
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    io.to(data.roomId).emit('update-game', {
      fieldCard: room.fieldCard,
      currentTurnPlayerId: room.players[room.turnIndex].id
    });
  });

  socket.on('draw-card', (data) => {
    const room = rooms[data.roomId];
    if (!room || room.deck.length === 0 || room.winner) return;

    const drawnCard = room.deck.pop();
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.hand.push(drawnCard);
      socket.emit('init-game', {
        hand: player.hand,
        fieldCard: room.fieldCard,
        isMyTurn: false
      });
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      io.to(data.roomId).emit('update-game', {
        fieldCard: room.fieldCard,
        currentTurnPlayerId: room.players[room.turnIndex].id
      });
    }
  });

  // 再戦リクエスト
  socket.on('request-rematch', (roomId) => {
    if (rooms[roomId]) startGame(roomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
