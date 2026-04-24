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

// --- タクティカル・エディション専用：属性サイクル定義 ---
const CYCLE_ORDER = ['GEAR', 'ICEAGE', 'FOUNTAIN', 'BATTERY', 'MACHINE', 'ARCHIVE'];

const createDeck = () => {
  const realmConfig = {
    GEAR: { total: 10, special: 3 },      // ドロー2
    MACHINE: { total: 10, special: 3 },   // リバース
    FOUNTAIN: { total: 10, special: 3 },  // Specialはワイルド
    PLANET: { total: 3, special: 0 },    // ワイルド
    RUINS: { total: 3, special: 0 },     // ワイルド
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

// サーバー側バリデーション：タクティカル・ルール
const canPlayCard = (room, card) => {
  // 1. ドロー蓄積中のチェック：特殊なGEAR以外は出せない
  if (room.nextDrawAmount > 1) {
    return (card.realm === 'GEAR' && card.isSpecial);
  }

  const field = room.fieldCard.realm;
  const hand = card.realm;

  // 2. ワイルドカード（PLANET / RUINS / Special FOUNTAIN）は常に出せる
  if (hand === 'PLANET' || hand === 'RUINS') return true;
  if (hand === 'FOUNTAIN' && card.isSpecial) return true;

  // 3. 同じレルムなら出せる
  if (field === hand) return true;

  // 4. 戦術サイクルチェック (次の属性なら出せる)
  const currentIdx = CYCLE_ORDER.indexOf(field);
  if (currentIdx !== -1) {
    const nextRealm = CYCLE_ORDER[(currentIdx + 1) % 6];
    if (hand === nextRealm) return true;
  }

  // 5. 特殊相性コンボ
  if (field === 'ARCHIVE' && hand === 'ICEAGE') return true; // 古文書を凍らせる
  if (field === 'ICEAGE' && hand === 'BATTERY') return true;  // 氷河期を充電
  if (field === 'ICEAGE' && hand === 'FOUNTAIN') return true; // 氷を溶かす

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
      room.players.push({ id: socket.id, name: playerName || "ANON", hand: [] });
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
    
    // 最初のカードがワイルドだった場合の処理
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

    // サーバー側バリデーション
    if (!canPlayCard(room, card)) return;

    player.hand = player.hand.filter(c => c.id !== card.id);
    
    const newFieldCard = { ...card };
    
    // ワイルドカード使用時の処理
    if (chosenRealm) {
      if (card.realm === 'RUINS') newFieldCard.wasRuins = true;
      if (card.realm === 'PLANET') newFieldCard.wasPlanet = true;
      if (card.realm === 'FOUNTAIN') newFieldCard.wasFountain = true;
      newFieldCard.realm = chosenRealm;
      newFieldCard.isSpecial = false; // 属性変更後は通常カード扱い
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
server.listen(PORT, () => console.log(`Tactical Eternal Server running on port ${PORT}`));
