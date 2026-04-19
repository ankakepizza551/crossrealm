const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); 

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // 修正: どこからでも接続できるようにします
    origin: "*", 
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

// 修正: Renderが指定するポート番号を使うようにします
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
