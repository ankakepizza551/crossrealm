const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// ブラウザでURLを開いた時に表示されるメッセージ（Cannot GET対策）
app.get('/', (req, res) => {
  res.send('CrossRealm Online Server is running!');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // どこからの接続も許可する設定
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('ユーザーが接続しました:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('play-card', (data) => {
    socket.to(data.roomId).emit('opponent-played', data.card);
  });

  socket.on('disconnect', () => {
    console.log('ユーザーが切断されました');
  });
});

// Renderのポート設定に対応
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
