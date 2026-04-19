const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); // フロントエンドからの接続を許可

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Reactの開発サーバーURLに合わせる
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('ユーザーが接続しました:', socket.id);

  // 指定された部屋に参加する
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`ユーザー ${socket.id} が部屋 ${roomId} に入室`);
  });

  // カードがプレイされた時、その部屋の他の人にだけ情報を送る
  socket.on('play-card', (data) => {
    // data = { roomId: '...', card: { realm: '...', number: 5 } }
    socket.to(data.roomId).emit('opponent-played', data.card);
  });

  socket.on('disconnect', () => {
    console.log('ユーザーが切断されました');
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
