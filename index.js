const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ゲームの状態管理
const rooms = {}; 

// 山札を作る関数
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
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    
    // ルームがなければ初期化
    if (!rooms[roomId]) {
      const deck = createDeck();
      rooms[roomId] = {
        deck: deck,
        fieldCard: deck.pop(),
        players: [],
        turnIndex: 0
      };
    }
    
    const room = rooms[roomId];
    if (room.players.length < 2) {
      const initialHand = room.deck.splice(0, 5);
      room.players.push({ id: socket.id, hand: initialHand });
      
      // クライアントに初期状態を送信
      socket.emit('init-game', {
        hand: initialHand,
        fieldCard: room.fieldCard,
        isMyTurn: room.players.length === 1 // 最初の人が先攻
      });
    }
  });

  socket.on('play-card', (data) => {
    const room = rooms[data.roomId];
    if (!room) return;

    // 場のカードを更新し、ターンを回す
    room.fieldCard = data.card;
    room.turnIndex = (room.turnIndex + 1) % room.players.length;

    // 全員に新しい場のカードと次のターン情報を通知
    io.to(data.roomId).emit('update-game', {
      fieldCard: room.fieldCard,
      currentTurnPlayerId: room.players[room.turnIndex].id
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
