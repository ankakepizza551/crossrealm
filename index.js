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

// タクティカル・ルールの属性サイクル定義
const CYCLE_ORDER = ['GEAR', 'ICEAGE', 'FOUNTAIN', 'BATTERY', 'MACHINE', 'ARCHIVE'];

const createDeck = () => {
  const realmConfig = {
    GEAR: { total: 10, special: 3 },      // +2ドロー
    MACHINE: { total: 10, special: 3 },   // リバース
    FOUNTAIN: { total: 10, special: 3 },  // Specialはワイルド扱い
    PLANET: { total: 3, special: 0 },     // ワイルド
    RUINS: { total: 3, special: 0 },      // ワイルド
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
        id: `card-${realm}-${counter++}-${Math.random().toString(36).substr(2, 5)}`,
        realm: realm,
        isSpecial: i < special
      });
    }
  });
  return deck.sort(() => Math.random() - 0.5);
};

// サーバー側でのプレイ可否判定
const canPlayCard = (room, card) => {
  if (room.nextDrawAmount > 1) {
    return (card.realm === 'GEAR' && card.isSpecial);
  }
  const field = room.fieldCard.realm;
  const hand = card.realm;
  if (hand === 'PLANET' || hand === 'RUINS' || (hand === 'FOUNTAIN' && card.isSpecial)) return true;
  if (field === hand) return true;
  const currentIdx = CYCLE_ORDER.indexOf(field);
  if (currentIdx !== -1 && hand === CYCLE_ORDER[(currentIdx + 1) % 6]) return true;
  if (field === 'ARCHIVE' && hand === 'ICEAGE') return true;
  if (field === 'ICEAGE' && (hand === 'BATTERY' || hand === 'FOUNTAIN')) return true;
  return false;
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
        players: [], deck: [], fieldCard: null,
        status: 'waiting', turnIndex: 0, nextDrawAmount: 1, isReversed: false,
        readyPlayers: new Set(), needsInitialChoice: false
      };
    }
    const room = rooms[roomId];
    if (room.players.findIndex(p => p.id === socket.id) === -1 && room.players.length < 4) {
      room.players.push({ id: socket.id, name: playerName || "匿名", hand: [] });
      socket.join(roomId);
    }
    emitUpdate(roomId);
  });

  socket.on('start-game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;
    room.deck = createDeck();
    room.players.forEach(p => p.hand = room.deck.splice(0, 5));
    room.fieldCard = room.deck.pop();
    room.status = 'playing';
    room.turnIndex = Math.floor(Math.random() * room.players.length);
    room.nextDrawAmount = 1;
    room.isReversed = false;
    room.needsInitialChoice = (room.fieldCard.realm === 'PLANET' || room.fieldCard.realm === 'RUINS' || (room.fieldCard.realm === 'FOUNTAIN' && room.fieldCard.isSpecial));
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
    if (!canPlayCard(room, card)) return;
    player.hand = player.hand.filter(c => c.id !== card.id);
    const newFieldCard = { ...card };
    if (chosenRealm) {
      if (card.realm === 'RUINS') newFieldCard.wasRuins = true;
      if (card.realm === 'PLANET') newFieldCard.wasPlanet = true;
      if (card.realm === 'FOUNTAIN') newFieldCard.wasFountain = true;
      newFieldCard.realm = chosenRealm;
      newFieldCard.isSpecial = false; 
    }
    room.fieldCard = newFieldCard;
    if (player.hand.length === 0) {
      room.status = 'finished';
    } else {
      if (card.isSpecial) {
        switch (card.realm) {
          case 'GEAR': room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : room.nextDrawAmount + 2; break;
          case 'MACHINE': room.isReversed = !room.isReversed; break;
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
server.listen(PORT, () => console.log(`Cross Realm Server running on port ${PORT}`));
