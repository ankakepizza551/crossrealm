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
  // 【修正】サブ属性を各5枚、完全ワイルドを各3枚に調整（デッキ総数51枚）
  const realmConfig = {
    GEAR: { total: 10, special: 3 },     // 10枚中3枚が「+2」
    MACHINE: { total: 10, special: 3 },  // 10枚中3枚が「REV」
    FOUNTAIN: { total: 10, special: 3 }, // 10枚中3枚が「WILD」
    PLANET: { total: 3, special: 0 },    // 完全ワイルド（3枚）
    RUINS: { total: 3, special: 0 },     // 完全ワイルド（3枚）
    ICEAGE: { total: 5, special: 0 },    // サブ属性（5枚）
    BATTERY: { total: 5, special: 0 },   // サブ属性（5枚）
    ARCHIVE: { total: 5, special: 0 }    // サブ属性（5枚）
  };
  
  let deck = [];
  Object.keys(realmConfig).forEach(realm => {
    const { total, special } = realmConfig[realm];
    for (let i = 0; i < total; i++) {
      let card = { id: Math.random().toString(36).substr(2, 9), realm };
      // 最初の数枚（specialで指定した枚数分）だけを特殊カードにする
      if (i < special) card.isSpecial = true;
      deck.push(card);
    }
  });
  
  // 生成された全51枚をシャッフル
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
    needsInitialChoice: room.needsInitialChoice,
    readyPlayers: Array.from(room.readyPlayers)
  });
};

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [], status: 'waiting', deck: [], discardPile: [], fieldCard: null,
        turnIndex: 0, nextDrawAmount: 1, isReversed: false, needsInitialChoice: false, readyPlayers: new Set()
      };
    }
    const room = rooms[roomId];
    
    // 【再接続システム】同じ名前のプレイヤーがいたら自動で復帰させる
    const existingPlayer = room.players.find(p => p.name === playerName);
    if (existingPlayer) {
        existingPlayer.id = socket.id;
        socket.join(roomId);
        emitUpdate(roomId);
        return;
    }

    if (room.status !== 'waiting') return;
    room.players.push({ id: socket.id, name: playerName, hand: [] });
    socket.join(roomId);
    emitUpdate(roomId);
  });

  socket.on('start-game', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.players[0].id === socket.id && room.players.length >= 2) {
      room.deck = createDeck();
      room.fieldCard = room.deck.pop();
      room.status = 'playing';
      room.turnIndex = Math.floor(Math.random() * room.players.length); 
      room.nextDrawAmount = 1;
      room.isReversed = false;
      room.needsInitialChoice = (room.fieldCard.realm === 'PLANET' || room.fieldCard.realm === 'RUINS');
      room.players.forEach(p => p.hand = room.deck.splice(0, 7)); 
      emitUpdate(roomId);
    }
  });

  socket.on('set-initial-realm', ({ roomId, chosenRealm }) => {
    const room = rooms[roomId];
    if (room && room.players[0].id === socket.id && room.needsInitialChoice) {
      room.fieldCard.realm = chosenRealm;
      room.needsInitialChoice = false;
      emitUpdate(roomId);
    }
  });

  socket.on('draw-card', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id || room.needsInitialChoice) return;
    
    const p = room.players[room.turnIndex];
    
    // 山札が足りない場合は捨て札をシャッフルして補充
    if (room.deck.length < room.nextDrawAmount) {
        room.deck = [...room.deck, ...room.discardPile].sort(() => Math.random() - 0.5);
        room.discardPile = [];
    }
    
    p.hand.push(...room.deck.splice(0, room.nextDrawAmount));
    room.nextDrawAmount = 1; 
    
    const direction = room.isReversed ? -1 : 1;
    room.turnIndex = (room.turnIndex + direction + room.players.length) % room.players.length;
    emitUpdate(roomId);
  });

  socket.on('play-card', ({ roomId, card, chosenRealm, preventSpecial }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id || room.needsInitialChoice) return;

    const p = room.players[room.turnIndex];
    const cardIndex = p.hand.findIndex(c => c.id === card.id);
    if (cardIndex === -1) return;

    room.discardPile.push(room.fieldCard);
    
    let playedCard = p.hand.splice(cardIndex, 1)[0];
    
    if (chosenRealm) {
        if(playedCard.realm === 'PLANET') playedCard.wasPlanet = true;
        if(playedCard.realm === 'RUINS') playedCard.wasRuins = true;
        playedCard.realm = chosenRealm;
    }
    
    room.fieldCard = playedCard;

    if (p.hand.length === 0) {
      room.status = 'finished';
      emitUpdate(roomId);
      return;
    }

    if (!preventSpecial && playedCard.isSpecial) {
      switch (playedCard.realm) {
        case 'GEAR':
          room.nextDrawAmount = room.nextDrawAmount === 1 ? 2 : room.nextDrawAmount + 2;
          break;
        case 'MACHINE':
          room.isReversed = !room.isReversed;
          break;
      }
    }
    
    const direction = room.isReversed ? -1 : 1;
    room.turnIndex = (room.turnIndex + direction + room.players.length) % room.players.length;
    emitUpdate(roomId);
  });

  socket.on('play-again', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.readyPlayers.add(socket.id);
    if (room.readyPlayers.size === room.players.length) {
        room.deck = createDeck();
        room.discardPile = [];
        room.fieldCard = room.deck.pop();
        room.status = 'playing';
        room.turnIndex = Math.floor(Math.random() * room.players.length); 
        room.nextDrawAmount = 1;
        room.isReversed = false;
        room.readyPlayers.clear();
        room.needsInitialChoice = (room.fieldCard.realm === 'PLANET' || room.fieldCard.realm === 'RUINS');
        room.players.forEach(p => p.hand = room.deck.splice(0, 7));
    }
    emitUpdate(roomId);
  });

  socket.on('leave-room', ({ roomId }) => {
    const room = rooms[roomId];
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length < 2 && room.status === 'playing') {
          room.status = 'waiting'; 
      }
      if (room.players.length === 0) delete rooms[roomId];
      else emitUpdate(roomId);
    }
    socket.leave(roomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
