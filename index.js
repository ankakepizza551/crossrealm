const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {};
const HAND_LIMIT = 12;

// デッキ作成時に確実にユニークなIDを生成
const createDeck = () => {
  const realmConfig = {
    GEAR: { total: 10, special: 3 },
    MACHINE: { total: 10, special: 3 },
    FOUNTAIN: { total: 10, special: 3 },
    PLANET: { total: 3, special: 0 },
    RUINS: { total: 3, special: 0 },
    ICEAGE: { total: 5, special: 0 },
    BATTERY: { total: 5, special: 0 },
    ARCHIVE: { total: 5, special: 0 }
  };
  
  let deck = [];
  let counter = 0;
  Object.keys(realmConfig).forEach(realm => {
    const { total, special } = realmConfig[realm];
    for (let i = 0; i < total; i++) {
      deck.push({
        // ランダムな文字列 + カウンターで確実に重複を避ける
        id: `card-${realm}-${counter++}-${Math.random().toString(36).substr(2, 5)}`,
        realm: realm,
        isSpecial: i < special
      });
    }
  });
  return deck.sort(() => Math.random() - 0.5);
};

const emitUpdate = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;
  const data = {
    status: room.status,
    fieldCard: room.fieldCard,
    currentTurnPlayerId: room.players[room.turnIndex]?.id,
    nextDrawAmount: room.nextDrawAmount,
    isReversed: room.isReversed,
    needsInitialChoice: room.needsInitialChoice,
    handLimit: HAND_LIMIT,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      hand: p.hand 
    }))
  };
  io.to(roomId).emit('update-game', data);
};

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        deck: [],
        discardPile: [],
        fieldCard: null,
        status: 'waiting',
        turnIndex: 0,
        nextDrawAmount: 1,
        isReversed: false,
        readyPlayers: new Set(),
        needsInitialChoice: false
      };
    }
    const room = rooms[roomId];
    
    // 同一ソケットIDのプレイヤーが既に入っているか確認（二重登録防止）
    const existingPlayerIndex = room.players.findIndex(p => p.id === socket.id);
    
    if (existingPlayerIndex === -1) {
      if (room.players.length < 4) {
        room.players.push({ id: socket.id, name: playerName, hand: [] });
        socket.join(roomId);
      }
    } else {
      // 既に参加している場合は名前のみ更新
      room.players[existingPlayerIndex].name = playerName;
      socket.join(roomId);
    }
    emitUpdate(roomId);
  });

  socket.on('start-game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.deck = createDeck();
    room.players.forEach(p => p.hand = room.deck.splice(0, 5));
    room.fieldCard = room.deck.pop();
    room.status = 'playing';
    room.needsInitialChoice = (room.fieldCard.realm === 'PLANET' || room.fieldCard.realm === 'RUINS');
    emitUpdate(roomId);
  });

  socket.on('draw-card', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const player = room.players[room.turnIndex];
    if (player.id !== socket.id) return;

    const count = room.nextDrawAmount;
    for (let i = 0; i < count; i++) {
      if (room.deck.length === 0) break;
      player.hand.push(room.deck.pop());
    }

    if (player.hand.length > HAND_LIMIT) {
      room.status = 'finished';
      emitUpdate(roomId);
      return;
    }

    room.nextDrawAmount = 1;
    const direction = room.isReversed ? -1 : 1;
    room.turnIndex = (room.turnIndex + direction + room.players.length) % room.players.length;
    emitUpdate(roomId);
  });

  socket.on('play-card', ({ roomId, card, chosenRealm }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const player = room.players[room.turnIndex];
    if (player.id !== socket.id) return;

    player.hand = player.hand.filter(c => c.id !== card.id);
    
    const newFieldCard = { ...card };
    if (chosenRealm) {
      newFieldCard.realm = chosenRealm;
      if (card.realm === 'RUINS') newFieldCard.wasRuins = true;
      if (card.realm === 'PLANET') newFieldCard.wasPlanet = true;
      if (card.realm === 'FOUNTAIN') newFieldCard.wasFountain = true;
    }
    room.fieldCard = newFieldCard;

    if (player.hand.length === 0) {
      room.status = 'finished';
    } else {
      if (card.isSpecial) {
        switch (card.realm) {
          case 'GEAR':
            room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : room.nextDrawAmount + 2;
            break;
          case 'MACHINE':
            room.isReversed = !room.isReversed;
            break;
        }
      }
      const direction = room.isReversed ? -1 : 1;
      room.turnIndex = (room.turnIndex + direction + room.players.length) % room.players.length;
    }
    emitUpdate(roomId);
  });

  socket.on('set-initial-realm', ({ roomId, chosenRealm }) => {
    const room = rooms[roomId];
    if (room && room.needsInitialChoice) {
      room.fieldCard.realm = chosenRealm;
      room.needsInitialChoice = false;
      emitUpdate(roomId);
    }
  });

  socket.on('leave-room', ({ roomId }) => {
    const room = rooms[roomId];
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) delete rooms[roomId];
      else emitUpdate(roomId);
    }
  });

  socket.on('play-again', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.readyPlayers.add(socket.id);
    if (room.readyPlayers.size === room.players.length) {
      room.status = 'waiting';
      room.readyPlayers.clear();
    }
    emitUpdate(roomId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
