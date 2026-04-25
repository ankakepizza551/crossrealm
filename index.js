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

const NG_WORDS = ['FUCK', 'SHIT', 'BITCH', 'ASSHOLE', 'DICK', 'PUSSY', 'RETARD', 'SHINE', 'KASU', 'GOMI', '死ね', 'バカ', 'アホ', 'カス', 'ゴミ'];

const createDeck = () => {
  const realmConfig = {
    GEAR: { total: 10, special: 3 }, MACHINE: { total: 10, special: 3 }, FOUNTAIN: { total: 10, special: 3 },
    PLANET: { total: 3, special: 0 }, RUINS: { total: 3, special: 0 }, ICEAGE: { total: 5, special: 0 },
    BATTERY: { total: 5, special: 0 }, ARCHIVE: { total: 5, special: 0 }
  };
  let deck = [];
  let counter = 0;
  Object.keys(realmConfig).forEach(realm => {
    const { total, special } = realmConfig[realm];
    for (let i = 0; i < total; i++) {
      deck.push({ id: `card-${realm}-${counter++}-${Math.random().toString(36).substr(2, 5)}`, realm: realm, isSpecial: i < special });
    }
  });
  return deck.sort(() => Math.random() - 0.5);
};

const canPlayCard = (room, card) => {
  if (!room.fieldCard) return true;
  const field = room.fieldCard.realm;
  const hand = card.realm;
  if (room.nextDrawAmount > 1) return (hand === 'GEAR' && card.isSpecial);
  if (hand === 'PLANET' || hand === 'RUINS') return true;
  if (hand === 'FOUNTAIN' && card.isSpecial) return (field === 'ICEAGE' || field === 'FOUNTAIN');
  if (field === 'PLANET' || field === 'RUINS') return true; 
  switch (field) {
    case 'GEAR': return (hand === 'GEAR' || hand === 'ICEAGE');
    case 'ICEAGE': return (hand === 'FOUNTAIN' || hand === 'BATTERY');
    case 'FOUNTAIN': return (hand === 'FOUNTAIN' || hand === 'BATTERY');
    case 'BATTERY': return (hand === 'MACHINE' || hand === 'ARCHIVE');
    case 'MACHINE': return (hand === 'MACHINE' || hand === 'ARCHIVE');
    case 'ARCHIVE': return (hand === 'GEAR' || hand === 'ICEAGE');
    default: return true;
  }
};

const emitUpdate = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('update-game', {
    roomId, status: room.status, fieldCard: room.fieldCard,
    currentTurnPlayerId: room.players[room.turnIndex]?.id,
    nextDrawAmount: room.nextDrawAmount, isReversed: room.isReversed, handLimit: HAND_LIMIT,
    players: room.players.map(p => ({ id: p.id, name: p.name, handCount: p.hand.length, hand: p.hand }))
  });
};

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomId, playerName }) => {
    const cleanId = roomId?.toUpperCase().trim();
    const cleanName = playerName?.trim();
    if (!cleanId || !cleanName) return socket.emit('join-error', 'IDと名前を入力してください。');
    if (NG_WORDS.some(word => cleanName.toUpperCase().includes(word) || cleanId.includes(word))) 
      return socket.emit('join-error', '不適切な言葉が含まれています。');

    if (!rooms[cleanId]) rooms[cleanId] = { players: [], deck: [], fieldCard: null, status: 'waiting', turnIndex: 0, nextDrawAmount: 1, isReversed: false, readyPlayers: new Set() };
    const room = rooms[cleanId];
    if (room.status !== 'waiting') return socket.emit('join-error', '進行中のため参加できません。');
    if (room.players.length >= 4) return socket.emit('join-error', '満員です。');

    if (room.players.findIndex(p => p.id === socket.id) === -1) {
      room.players.push({ id: socket.id, name: cleanName, hand: [] });
      socket.join(cleanId);
    }
    emitUpdate(cleanId);
  });

  socket.on('start-game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;
    room.deck = createDeck();
    room.players.forEach(p => p.hand = room.deck.splice(0, 5));
    room.fieldCard = room.deck.pop();
    room.status = 'playing';
    room.turnIndex = Math.floor(Math.random() * room.players.length);
    room.nextDrawAmount = 1; room.isReversed = false;
    emitUpdate(roomId);
  });

  socket.on('draw-card', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    const player = room.players[room.turnIndex];
    if (player.id !== socket.id) return;
    for (let i = 0; i < room.nextDrawAmount; i++) {
      if (room.deck.length === 0) room.deck = createDeck();
      player.hand.push(room.deck.pop());
    }
    if (player.hand.length > HAND_LIMIT) { room.status = 'finished'; emitUpdate(roomId); return; }
    room.nextDrawAmount = 1;
    room.turnIndex = (room.turnIndex + (room.isReversed ? -1 : 1) + room.players.length) % room.players.length;
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
      newFieldCard.realm = chosenRealm; newFieldCard.isSpecial = false;
    }
    room.fieldCard = newFieldCard;

    if (player.hand.length === 0) { 
      room.status = 'finished'; 
    } else {
      if (card.isSpecial) {
        if (card.realm === 'GEAR') room.nextDrawAmount = (room.nextDrawAmount === 1) ? 2 : room.nextDrawAmount + 2;
        if (card.realm === 'MACHINE') room.isReversed = !room.isReversed;
      }
      room.turnIndex = (room.turnIndex + (room.isReversed ? -1 : 1) + room.players.length) % room.players.length;
    }
    emitUpdate(roomId);
  });

  socket.on('play-again', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.readyPlayers.add(socket.id);
    if (room.readyPlayers.size === room.players.length) { room.status = 'waiting'; room.readyPlayers.clear(); }
    emitUpdate(roomId);
  });
});

const serverPort = process.env.PORT || 3001;
server.listen(serverPort, () => console.log(`Cross Realm v3.1.15 Ready`));
