const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {}; 

// デッキ作成
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

// 全員に現在のゲーム状態を送信する共通関数
const emitUpdate = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;

  const playersData = room.players.map(p => ({
    id: p.id,
    name: p.name,
    handCount: p.hand.length,
    hand: p.hand // フロント側で自分のIDのものだけを表示に使用
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
  // 入室処理（名前対応）
  socket.on('join-room', (data) => {
    const { roomId, playerName } = data;
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { 
        status: 'waiting', 
        deck: [], 
        fieldCard: null, 
        players: [], 
        turnIndex: 0, 
        nextDrawAmount: 1,
        isReverse: false 
      };
    }
    
    const room = rooms[roomId];
    
    if (room.players.length < 4 && room.status === 'waiting') {
      if (!room.players.find(p => p.id === socket.id)) {
        room.players.push({ 
          id: socket.id, 
          name: playerName || `Player ${room.players.length + 1}`, 
          hand: [] 
        });
      }
      emitUpdate(roomId);
    }
  });

  // ゲーム開始
  socket.on('start-game', (data) => {
    const room = rooms[data.roomId];
    if (room && room.players.length >= 2) {
      room.deck = createDeck();
      room.fieldCard = room.deck.pop();
      room.status = 'playing';
      room.turnIndex = 0;
      room.nextDrawAmount = 1;
      room.isReverse = false;

      room.players.forEach(p => {
        p.hand = room.deck.splice(0, 5);
      });
      emitUpdate(data.roomId);
    }
  });

  // カードを出す
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
        io.to(data.roomId).emit('game-over', { winnerName: player.name });
      }
    }

    // 特殊効果の処理
    let skipNext = false;
    // 歯車0: 次の人に+2枚
    if (card.realm === 'GEAR' && card.number === 0) {
      room.nextDrawAmount = 2;
    }
    // 機械0,1,2: スキップ（2人ならリバースと同じ挙動）
    if (card.realm === 'MACHINE' && card.number <= 2) {
      skipNext = true;
    }

    // 次のターンへ
    const step = skipNext ? 2 : 1;
    room.turnIndex = (room.turnIndex + step) % room.players.length;
    
    emitUpdate(data.roomId);
  });

  // カードを引く
  socket.on('draw-card', (data) => {
    const room = rooms[data.roomId];
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (player && room.players[room.turnIndex].id === socket.id) {
      const amount = room.nextDrawAmount;
      for (let i = 0; i < amount; i++) {
        if (room.deck.length > 0) player.hand.push(room.deck.pop());
      }
      room.nextDrawAmount = 1;
      // 引いた後は次の人の番
      room.turnIndex = (room.turnIndex + 1) % room.players.length;
      emitUpdate(data.roomId);
    }
  });

  // 切断時の処理
  socket.on('disconnect', () => {
    // 簡略化のため今回はそのまま（必要に応じて部屋の削除などを追加）
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
