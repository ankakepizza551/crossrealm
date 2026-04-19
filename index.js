const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); // 全ての接続を許可

// ブラウザで直接URLを開いた時に表示されるメッセージ
app.get('/', (req, res) => {
  res.send('CrossRealm Server is running!');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // 公開環境では "*"（すべて許可）にするのが確実です
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('ユーザーが接続しました:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`ユーザー ${socket.id} が部屋 ${roomId} に入室`);
  });

  socket.on('play-card', (data) => {
    socket.to(data.roomId).emit('opponent-played', data.card);
  });

  socket.on('disconnect', () => {
    console.log('ユーザーが切断されました');
  });
});

// Renderの環境変数（PORT）に対応させるための修正
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
