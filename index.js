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
  const realmCounts = {
    GEAR: 15, MACHINE: 12, FOUNTAIN: 12,
    PLANET: 6, RUINS: 6,
    ICEAGE: 6, BATTERY: 6, ARCHIVE: 6
  };
  let deck = [];
  Object.keys(realmCounts).forEach(realm => {
    for (let i = 0; i < realmCounts[realm]; i++) {
      let card = { id: Math.random().toString(36).substr(2, 9), realm };
      if (Math.random() < 0.3) card.isSpecial = true;
      deck.push(card);
    }
  });
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
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { status: 'waiting', deck: [], discardPile: [], fieldCard: null, players: [], turnIndex: 0, nextDrawAmount: 1, isReversed: false, needsInitialChoice: false, readyPlayers: new Set() };
    }
    const room = rooms[roomId];
    if (room.players.length < 4 && room.status === 'waiting') {
      if (!room.players.find(p => p.id === socket.id)) {
        room.players.push({ id: socket.id, name: playerName || `Player ${room.players.length + 1}`, hand: [] });
      }
      emitUpdate(roomId);
    }
  });

  socket.on('start-game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.deck = createDeck();
    room.discardPile = [];
    room.fieldCard = room.deck.pop();
    room.status = 'playing';
    room.turnIndex = 0;
    room.nextDrawAmount = 1;
    room.isReversed = false;
    room.readyPlayers.clear();
    room.needsInitialChoice = (room.fieldCard.realm === 'PLANET' || room.fieldCard.realm === 'RUINS');
    room.players.forEach(p => p.hand = room.deck.splice(0, 5));
    emitUpdate(roomId);
  });

  socket.on('play-card', ({ roomId, card, chosenRealm }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;
    const player = room.players.find(p => p.id === socket.id);
    
    // 現在の場のカードを捨て札に移動（ワイルドカードは元の状態にリセット）
    if (room.fieldCard) {
      let discard = { ...room.fieldCard };
      if (discard.wasPlanet) discard.realm = 'PLANET';
      if (discard.wasRuins) discard.realm = 'RUINS';
      delete discard.wasPlanet;
      delete discard.wasRuins;
      room.discardPile.push(discard);
    }

    player.hand = player.hand.filter(c => c.id !== card.id);
    const newFieldCard = { ...card };
    if (chosenRealm) {
        if (card.realm === 'PLANET') newFieldCard.wasPlanet = true;
        if (card.realm === 'RUINS') newFieldCard.wasRuins = true;
        newFieldCard.realm = chosenRealm;
    }
    room.fieldCard = newFieldCard;
    if (card.isSpecial) {
      if (card.realm === 'GEAR') room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : room.nextDrawAmount + 2;
      if (card.realm === 'MACHINE') room.isReversed = !room.isReversed;
    }
    if (player.hand.length === 0) {
      room.status = 'finished';
    } else {
      const direction = room.isReversed ? -1 : 1;
      room.turnIndex = (room.turnIndex + direction + room.players.length) % room.players.length;
    }
    emitUpdate(roomId);
  });

  socket.on('draw-card', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;
    const player = room.players[room.turnIndex];

    for (let i = 0; i < room.nextDrawAmount; i++) {
      // 山札が空なら捨て札を補充
      if (room.deck.length === 0) {
        if (room.discardPile.length > 0) {
          room.deck = room.discardPile.sort(() => Math.random() - 0.5);
          room.discardPile = [];
        } else {
          break; // 全カードが手元にある場合は終了
        }
      }
      // 15枚制限チェック
      if (player.hand.length < 15) {
        player.hand.push(room.deck.pop());
      } else {
        break;
      }
    }

    room.nextDrawAmount = 1;
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
        room.turnIndex = 0;
        room.nextDrawAmount = 1;
        room.isReversed = false;
        room.readyPlayers.clear();
        room.needsInitialChoice = (room.fieldCard.realm === 'PLANET' || room.fieldCard.realm === 'RUINS');
        room.players.forEach(p => p.hand = room.deck.splice(0, 5));
    }
    emitUpdate(roomId);
  });

  socket.on('leave-room', ({ roomId }) => {
    const room = rooms[roomId];
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) delete rooms[roomId];
      else emitUpdate(roomId);
    }
    socket.leave(roomId);
  });

  socket.on('set-initial-realm', ({ roomId, chosenRealm }) => {
    const room = rooms[roomId];
    if (room && room.needsInitialChoice) {
      room.fieldCard.realm = chosenRealm;
      room.needsInitialChoice = false;
      emitUpdate(roomId);
    }
  });
});

server.listen(process.env.PORT || 3001);
