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

io.on('connection', (socket) => {
  // 入室処理
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      const deck = createDeck();
      rooms[roomId] = { deck, fieldCard: deck.pop(), players: [], turnIndex: 0 };
    }
    const room = rooms[roomId];
    if (room.players.length < 2) {
      const initialHand = room.deck.splice(0, 5);
      room.players.push({ id: socket.id, hand: initialHand });
      socket.emit('init-game', {
        hand: initialHand,
        fieldCard: room.fieldCard,
        isMyTurn: room.players.length === 1 
      });
    }
  });

  // カードを出す処理
  socket.on('play-card', (data) => {
    const room = rooms[data.roomId];
    if (!room) return;
    room.fieldCard = data.card;
    const player = room.players.find(p => p.id === socket.id);
    if (player) player.hand = player.hand.filter(c => c.id !== data.card.id);
    
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
    io.to(data.roomId).emit('update-game', {
      fieldCard: room.fieldCard,
      currentTurnPlayerId: room.players[room.turnIndex].id
    });
  });

  // 【追加】カードを引く処理
  socket.on('draw-card', (data) => {
    const room = rooms[data.roomId];
    if (!room || room.deck.length === 0) return;

    const drawnCard = room.deck.pop();
    const player = room.players.find(p => p.id === socket.id);
    
    if (player) {
      player.hand.push(drawnCard);
      // 本人に最新の手札を送信
      socket.emit('init-game', {
        hand: player.hand,
        fieldCard: room.fieldCard,
        isMyTurn: false // 引いたらターン終了
      });
      // ターンを回す
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      io.to(data.roomId).emit('update-game', {
        fieldCard: room.fieldCard,
        currentTurnPlayerId: room.players[room.turnIndex].id
      });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
