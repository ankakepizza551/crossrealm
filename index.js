const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');

const app = express();
const path = require('path');
app.use(cors());

// デバッグ: dist/の存在チェック
const distPath = path.join(__dirname, 'dist');
const distIndexPath = path.join(distPath, 'index.html');
console.log('[BOOT] __dirname:', __dirname);
console.log('[BOOT] dist path:', distPath);
console.log('[BOOT] dist exists:', fs.existsSync(distPath));
console.log('[BOOT] dist/index.html exists:', fs.existsSync(distIndexPath));
if (fs.existsSync(distPath)) {
  console.log('[BOOT] dist contents:', fs.readdirSync(distPath));
  const assetsPath = path.join(distPath, 'assets');
  if (fs.existsSync(assetsPath)) {
    console.log('[BOOT] dist/assets contents:', fs.readdirSync(assetsPath));
  }
}

// デバッグ用エンドポイント
app.get('/api/debug', (req, res) => {
  res.json({
    dirname: __dirname,
    distExists: fs.existsSync(distPath),
    distIndexExists: fs.existsSync(distIndexPath),
    distContents: fs.existsSync(distPath) ? fs.readdirSync(distPath) : [],
    assetsContents: fs.existsSync(path.join(distPath, 'assets')) ? fs.readdirSync(path.join(distPath, 'assets')) : [],
    env: process.env.NODE_ENV || 'not set',
    port: process.env.PORT || 3000
  });
});

// 静的ファイルの提供 (ビルド済みのフロントエンド)
app.use(express.static(distPath));

// どこにアクセスしても index.html を返す (SPA用設定)
app.get('*', (req, res) => {
  if (fs.existsSync(distIndexPath)) {
    res.sendFile(distIndexPath);
  } else {
    res.status(500).send('dist/index.html not found. Build may have failed.');
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

// ============================================================
// 🎮 バランス調整エリア（ここだけ触ればOK）
// ============================================================

// --- 手札 ---
const INITIAL_HAND = 5;       // 初期手札枚数
const HAND_LIMIT   = 11;      // これ以上になると脱落（この枚数になった瞬間アウト）

// --- デッキ枚数 ---
// メインレルム：GEAR / MACHINE / FOUNTAIN（特殊カードあり）
const MAIN_NORMAL_COUNT  = 7; // メインの通常カード（1種あたり）
const MAIN_SPECIAL_COUNT = 3; // メインの特殊カード（1種あたり）
// サブレルム：ICEAGE / BATTERY / ARCHIVE（通常カードのみ）
const SUB_NORMAL_COUNT   = 5; // サブの通常カード（1種あたり）
// ワイルド：PLANET / RUINS
const WILD_COUNT         = 3; // ワイルドカード（1種あたり）

// --- 特殊カード効果 ---
// DRAW 2（GEAR特殊）: スタック時の挙動
//   現在: 1枚目→2枚ドロー、2枚目以降→さらに+2枚ずつ積み上げ
//   MAX_DRAW_STACK を設定するとドロー枚数の上限を制限できる（0=無制限）
const MAX_DRAW_STACK = 0;     // ドロー枚数の上限（0=無制限）

// --- 脱落ペナルティ ---
const ELIMINATION_PENALTY = -10; // 脱落時のスコアペナルティ

// --- 点数計算 ---
// 基本点：勝者以外の残り手札枚数の合計
// ワイルド上がりボーナス：基本点にこの倍率をかける（切り上げ）
// ※ LIMIT WILD（FOUNTAIN特殊）はボーナス対象外
const WILD_FINISH_MULTIPLIER = 1.2; // ワイルド上がり時の倍率

// 連勝ボーナス：連続で勝ったときに加算されるボーナス点
const WIN_STREAK_THRESHOLD = 2;  // 何連勝からボーナスが発生するか
const WIN_STREAK_BONUS     = 3;  // ボーナス点数（上限あり・一律）

// --- シリーズ設定 ---
const MAX_MATCHES = 5; // 何戦先取でシリーズ終了か

// ============================================================

const REALM_NAME_JA = { GEAR: '歯車', ICEAGE: '氷河期', FOUNTAIN: '噴水', BATTERY: '電池', MACHINE: '機械', ARCHIVE: '古文書', PLANET: '惑星', RUINS: '廃墟' };

// --- 究極の予防回収: 公序良俗NGワード・フィルタリング（真・極限版） ---
const NG_WORDS = [
  // 性的・卑猥表現
  'ちんぽ', 'ちんこ', 'まんこ', 'おめこ', 'せっくす', '中出し', 'ぶっかけ', 'フェラ', 'クンニ', 'アナル', '潮吹き', 'パコ', '生ハメ', 'デリヘル', 'ソープ', '援交', 'パパ活',
  // 差別・ヘイト
  'シナ人', '支那', 'チョン', 'エタ', '非人', 'ガイジ', '池沼', 'めくら', 'ツンボ', 'ホモ', 'オカマ', 'レズ', '土方', 'ドカタ', 'nigger', 'faggot',
  // 犯罪・暴力・自傷
  '殺す', '死ね', 'レイプ', '強姦', 'ミンチ', 'リスカ', '自殺', '覚醒剤', 'シャブ', '大麻', '爆破', 'サリン', 'テロ', '闇バイト',
  // 政治・歴史
  '天安門', '六四', '習近平', '南京大虐殺', '慰安婦', 'ナチス', 'ヒトラー', 'ハケンクロイツ'
];

function filterName(name) {
  if (!name) return 'Pilot';

  // 1. Unicode正規化 (結合文字対策など)
  let n = name.normalize('NFKC');

  // 2. 制御文字・ゼロ幅文字・不可視文字の除去 (バイパスハック対策)
  n = n.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u202E\uFEFF]/g, '');

  // 3. グリフ近似の正規化 (見た目が似ている漢字をカタカナに変換して判定)
  const glyphMap = { '千': 'チ', '工': 'エ', '口': 'ロ', '丁': 'テ', '力': 'カ', '二': 'ニ' };
  let normalizedForCheck = n;
  for (const [key, val] of Object.entries(glyphMap)) {
    normalizedForCheck = normalizedForCheck.replace(new RegExp(key, 'g'), val);
  }

  // 4. チェック (小文字化して判定)
  const checkStr = normalizedForCheck.toLowerCase();
  const hasNG = NG_WORDS.some(word => checkStr.includes(word));

  // 10文字制限を適用
  const finalName = n.substring(0, 10).trim();

  return (hasNG || finalName.length === 0) ? 'Pilot' : finalName;
}

// Fisher-Yatesアルゴリズムによる均一なシャッフル
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createDeck() {
  const deck = [];
  const mains = ['GEAR', 'MACHINE', 'FOUNTAIN'];
  const subs  = ['ICEAGE', 'BATTERY', 'ARCHIVE'];
  const wilds = ['PLANET', 'RUINS'];
  const mkCard = (realm, isSpecial) => ({ id: Math.random().toString(36).substr(2, 9), realm, isSpecial });
  mains.forEach(r => {
    for (let i = 0; i < MAIN_NORMAL_COUNT;  i++) deck.push(mkCard(r, false));
    for (let i = 0; i < MAIN_SPECIAL_COUNT; i++) deck.push(mkCard(r, true));
  });
  subs.forEach(r => {
    for (let i = 0; i < SUB_NORMAL_COUNT; i++) deck.push(mkCard(r, false));
  });
  wilds.forEach(r => {
    for (let i = 0; i < WILD_COUNT; i++) deck.push(mkCard(r, false));
  });
  return shuffleDeck(deck);
}

// デッキが尽きたとき捨て札をシャッフルして再利用する（なければ新しいデッキ）
function replenishDeck(room) {
  if (room.discardPile && room.discardPile.length > 0) {
    room.deck = shuffleDeck(room.discardPile);
    room.discardPile = [];
  } else {
    room.deck = createDeck();
  }
}

// 生存しているプレイヤーを探して次のターンを決定
function nextTurn(room, skip = false) {
  const step = room.isReversed ? -1 : 1;
  const survivors = room.players.filter(p => !p.isEliminated);

  if (survivors.length <= 1) return; // 生存者が1人なら終了チェックへ

  let nextIdx = room.turnIndex;
  const repeatCount = skip ? 2 : 1;

  for (let s = 0; s < repeatCount; s++) {
    do {
      nextIdx = (nextIdx + step + room.players.length) % room.players.length;
    } while (room.players[nextIdx].isEliminated);
  }

  room.turnIndex = nextIdx;
  room.currentTurnPlayerId = room.players[room.turnIndex].id;
}

function canPlay(room, card) {
  if (!room || !card || !room.fieldCard) return false;
  if (room.nextDrawAmount > 1) return (card.realm === 'GEAR' && card.isSpecial);
  const field = room.fieldCard.realm;
  const h = card.realm;
  if (h === 'PLANET' || h === 'RUINS' || field === 'PLANET' || field === 'RUINS') return true;
  if (h === 'FOUNTAIN' && card.isSpecial) return (field === 'ICEAGE' || field === 'FOUNTAIN');
  const cycle = { GEAR: ['GEAR', 'ICEAGE'], ICEAGE: ['FOUNTAIN', 'BATTERY'], FOUNTAIN: ['FOUNTAIN', 'BATTERY'], BATTERY: ['MACHINE', 'ARCHIVE'], MACHINE: ['MACHINE', 'ARCHIVE'], ARCHIVE: ['GEAR', 'ICEAGE'] };
  if (['ICEAGE', 'BATTERY', 'ARCHIVE'].includes(field) && field === h) return false;
  return field === h || (cycle[field] && cycle[field].includes(h));
}

function checkGameOver(room) {
  const survivors = room.players.filter(p => !p.isEliminated);
  // 手札0枚のプレイヤーがいるか、生存者が1人以下なら終了
  const winnerFound = room.players.some(p => !p.isEliminated && p.handCount === 0);

  if (winnerFound || survivors.length <= 1) {
    room.status = 'finished';
    room.players.forEach(p => { p.ready = p.isBot; }); // 全員のready状態をリセット（全員同意で次へ進む）
    const winner = survivors.find(p => p.handCount === 0) || survivors[0];

    let earnedPoints = 0;
    let isWildFinish = false;
    if (winner) {
      room.players.forEach(p => {
        if (p.id !== winner.id && p.handCount > 0) {
          earnedPoints += p.handCount;
        }
      });

      const basePoints = earnedPoints;
      let totalEarned = basePoints;
      let bonusPoints = 0;
      
      // 部屋のフラグまたは現在のフィールドカードから判定（LIMIT WILDはボーナス対象外）
      const isLimitWild = room.fieldCard.wasFountain || (room.fieldCard.realm === 'FOUNTAIN' && room.fieldCard.isSpecial);
      const isWildCard = !isLimitWild && (room.lastPlayWasWild || room.fieldCard.wasPlanet || room.fieldCard.wasRuins || room.fieldCard.realm === 'PLANET' || room.fieldCard.realm === 'RUINS');
      
      if (winner.handCount === 0 && room.fieldCard && isWildCard) {
        totalEarned = Math.ceil(basePoints * WILD_FINISH_MULTIPLIER);
        bonusPoints = totalEarned - basePoints;
        isWildFinish = true;
      }

      // 連勝ボーナス
      winner.winStreak = (winner.winStreak || 0) + 1;
      let streakBonus = 0;
      if (winner.winStreak >= WIN_STREAK_THRESHOLD) {
        streakBonus = WIN_STREAK_BONUS;
        totalEarned += streakBonus;
      }
      // 負けたプレイヤーの連勝をリセット
      room.players.forEach(p => { if (p.id !== winner.id) p.winStreak = 0; });

      room.logs.push({ id: Math.random(), text: `RESULT: Winner=${winner.name}, Base=${basePoints}, WildBonus=${bonusPoints}, Streak=${winner.winStreak}, StreakBonus=${streakBonus}` });

      winner.score += totalEarned;
      winner.earnedPoints = totalEarned;
      winner.basePoints = basePoints;
      winner.bonusPoints = bonusPoints;
      winner.streakBonus = streakBonus;
      winner.finishBonus = isWildFinish;
      room.lastPlayWasWild = false; // Reset for next match
    }

    room.logs.push({ id: Math.random(), text: `MATCH ${room.matchCount} COMPLETE: ${winner ? winner.name : 'NONE'} (+${earnedPoints} pts)` });

    room.matchCount++;
    if (room.matchCount > room.maxMatches) {
      room.isSeriesFinished = true;
    }
    return true;
  }
  return false;
}

function handlePlayerExit(socket, roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const pIndex = room.players.findIndex(p => p.id === socket.id);
  if (pIndex === -1) return;
  const player = room.players[pIndex];
  room.logs.push({ id: Math.random(), text: `${player.name} が戦線を離脱しました` });
  room.players.splice(pIndex, 1);

  if (room.players.filter(p => !p.isBot).length === 0) {
    delete rooms[roomId];
    return;
  }

  if (room.status === 'playing') {
    if (!checkGameOver(room)) {
      if (pIndex < room.turnIndex) room.turnIndex--;
      room.turnIndex = (room.turnIndex + room.players.length) % room.players.length;
      nextTurn(room, false);
    }
  }
  io.to(roomId).emit('update-game', room);
}

function processBotTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing') return;
  const bot = room.players[room.turnIndex];
  if (!bot || !bot.isBot || bot.isActing || bot.isEliminated) return;

  const isWild = room.lastPlayWasWild || (room.fieldCard && (room.fieldCard.wasPlanet || room.fieldCard.wasRuins));
  const botDelay = isWild ? 3000 : 1200;
  bot.isActing = true;
  setTimeout(() => {
    bot.isActing = false;
    // 最新の部屋状態を再取得
    if (!rooms[roomId] || rooms[roomId].status !== 'playing') return;

    const action = getBotAction(room, bot);
    if (action.type === 'draw') {
      const amount = room.nextDrawAmount || 1;
      for (let i = 0; i < amount; i++) {
        if (room.deck.length === 0) replenishDeck(room);
        bot.hand.push(room.deck.pop());
      }
      room.logs.push({ id: Math.random(), text: `${bot.name} が ${amount}枚 ドローしました` });
      room.nextDrawAmount = 1;
      bot.handCount = bot.hand.length;
      room.lastAction = { type: 'draw', playerId: bot.id };

      if (bot.handCount >= HAND_LIMIT) {
        bot.isEliminated = true;
        bot.score += ELIMINATION_PENALTY;
        room.logs.push({ id: Math.random(), text: `臨界突破: ${bot.name} が脱落！ (SCORE -10)` });
      }
    } else {
      const { card, chosenRealm } = action;
      bot.hand = bot.hand.filter(c => c.id !== card.id);
      const originalRealm = card.realm;
      room.lastPlayWasWild = (originalRealm === 'PLANET' || originalRealm === 'RUINS');
      if (chosenRealm) {
        card.wasPlanet = originalRealm === 'PLANET';
        card.wasRuins = originalRealm === 'RUINS';
        card.wasFountain = originalRealm === 'FOUNTAIN';
        card.realm = chosenRealm;
        card.isSpecial = false;
      }
      // 前のフィールドカードを捨て札へ
      if (room.fieldCard) {
        if (!room.discardPile) room.discardPile = [];
        room.discardPile.push(room.fieldCard);
      }
      room.fieldCard = card;
      room.logs.push({ id: Math.random(), text: `${bot.name} が ${REALM_NAME_JA[originalRealm] || originalRealm} を展開` });

      if (card.isSpecial) {
        if (card.realm === 'GEAR') {
          const next = (room.nextDrawAmount === 1) ? 2 : (room.nextDrawAmount || 0) + 2;
          room.nextDrawAmount = (MAX_DRAW_STACK > 0) ? Math.min(next, MAX_DRAW_STACK) : next;
        }
        if (card.realm === 'MACHINE') room.isReversed = !room.isReversed;
      }
      bot.handCount = bot.hand.length;
    }

    room.lastAction = { type: action.type, playerId: bot.id, cardId: action.card?.id };

    if (!checkGameOver(room)) {
      nextTurn(room, action.card?.isSpecial && action.card.realm === 'MACHINE' && room.players.length === 2);
    }

    io.to(roomId).emit('update-game', room);

    // AIのターンが続くなら次のAIを動かす
    if (room.status === 'playing') {
      const nextPlayer = room.players[room.turnIndex];
      if (nextPlayer && nextPlayer.isBot && !nextPlayer.isEliminated) {
        processBotTurn(roomId);
      }
    }
  }, botDelay);
}

function getBotAction(room, bot) {
  const playable = bot.hand.filter(card => canPlay(room, card));
  if (playable.length === 0) return { type: 'draw' };
  let targetCard = playable[Math.floor(Math.random() * playable.length)];
  let chosenRealm = undefined;
  if (['PLANET', 'RUINS', 'FOUNTAIN'].includes(targetCard.realm) && (targetCard.realm !== 'FOUNTAIN' || targetCard.isSpecial)) {
    chosenRealm = ['GEAR', 'FOUNTAIN', 'MACHINE'][Math.floor(Math.random() * 3)];
  }
  return { type: 'play', card: targetCard, chosenRealm };
}

const BOT_NAMES = ['Astra', 'Nova', 'Echo', 'Vector', 'Zion', 'Kael', 'Luna', 'Cyrus', 'Iris', 'Xenon'];

io.on('connection', (socket) => {
  socket.on('join-room', (data) => {
    if (!data || !data.roomId) return;
    const rid = data.roomId.toUpperCase();
    console.log(`[SYSTEM] Join Request: Room=${rid}, Player=${data.playerName}`);

    if (!rooms[rid]) {
      rooms[rid] = { id: rid, players: [], deck: [], fieldCard: null, turnIndex: 0, status: 'waiting', nextDrawAmount: 1, isReversed: false, logs: [], currentTurnPlayerId: null, matchCount: 1, maxMatches: MAX_MATCHES, isSeriesFinished: false };
      console.log(`[SYSTEM] New Room Created: ${rid}`);
    }

    const room = rooms[rid];
    if (room.status !== 'waiting' && room.status !== 'playing') return;

    // NGワードフィルタを適用
    const sanitizedName = filterName(data.playerName);

    // 同名のプレイヤーがいるかチェック（再接続対応）
    const existingPlayer = room.players.find(p => p.name === sanitizedName);

    if (existingPlayer) {
      console.log(`[SYSTEM] Reconnecting Player: ${existingPlayer.name} (ID: ${existingPlayer.id} -> ${socket.id})`);
      existingPlayer.id = socket.id;
      socket.join(rid);
      io.to(rid).emit('update-game', room);

      // もしその人のターンだったら、AIかどうかチェックして進行させる（念のため）
      if (room.status === 'playing' && room.players[room.turnIndex].id === socket.id && room.players[room.turnIndex].isBot) {
        processBotTurn(rid);
      }
      return;
    }

    if (room.players.length >= 5) return;

    const newPlayer = { id: socket.id, name: sanitizedName, hand: [], handCount: 0, isBot: false, isEliminated: false, score: 0, ready: false };
    room.players.push(newPlayer);
    socket.join(rid);

    console.log(`[SYSTEM] Player ${newPlayer.name} joined ${rid}. Total players: ${room.players.length}`);
    io.to(rid).emit('update-game', room);
  });

  socket.on('add-cpu', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.status === 'waiting' && room.players.length < 5) {
      // 被っていない名前をプールから選ぶ
      const usedNames = room.players.map(p => p.name.replace(' (AI)', ''));
      const availableNames = BOT_NAMES.filter(name => !usedNames.includes(name));

      const botBaseName = availableNames.length > 0
        ? availableNames[Math.floor(Math.random() * availableNames.length)]
        : (data.botName || 'CPU');

      room.players.push({
        id: 'CPU_' + Math.random().toString(36).substr(2, 5),
        name: botBaseName + ' (AI)',
        hand: [],
        handCount: 0,
        isBot: true,
        isEliminated: false,
        score: 0,
        ready: true
      });
      io.to(room.id).emit('update-game', room);
    }
  });

  socket.on('remove-cpu', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.status === 'waiting') {
      const idx = room.players.findIndex(p => p.id === data.botId);
      if (idx !== -1 && room.players[idx].isBot) {
        room.players.splice(idx, 1);
        io.to(room.id).emit('update-game', room);
      }
    }
  });


  socket.on('start-game', (data) => {
    try {
      const room = rooms[data.roomId.toUpperCase()];
      if (room && room.players.length >= 2) {
        room.deck = createDeck();
        room.turnIndex = Math.floor(Math.random() * room.players.length);
        room.players.forEach(p => {
          p.hand = []; for (let i = 0; i < INITIAL_HAND; i++) p.hand.push(room.deck.pop());
          p.handCount = p.hand.length;
          p.isEliminated = false;
          p.earnedPoints = 0;
          p.basePoints = 0;
          p.bonusPoints = 0;
          p.finishBonus = false;
        });
        room.fieldCard = room.deck.pop();
        room.status = 'playing';
        room.currentTurnPlayerId = room.players[room.turnIndex].id;
        room.nextDrawAmount = 1;
        room.isReversed = false;
        room.discardPile = [];
        room.logs = [{ id: Math.random(), text: `MATCH ${room.matchCount} 開始。` }];
        room.players.forEach(p => p.ready = p.isBot);
        io.to(room.id).emit('update-game', room);

        // 最初がAIなら動かす
        if (room.players[room.turnIndex].isBot) processBotTurn(room.id);
      }
    } catch (e) { console.error("[ERROR] start-game:", e); }
  });

  socket.on('play-card', (data) => {
    try {
      const room = rooms[data.roomId.toUpperCase()];
      if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;
      const player = room.players.find(p => p.id === socket.id);
      player.hand = player.hand.filter(c => c.id !== data.card.id);
      const card = data.card;
      const originalRealm = card.realm;
      room.lastPlayWasWild = (originalRealm === 'PLANET' || originalRealm === 'RUINS');
      if (data.chosenRealm) {
        card.wasPlanet = originalRealm === 'PLANET';
        card.wasRuins = originalRealm === 'RUINS';
        card.wasFountain = originalRealm === 'FOUNTAIN';
        card.realm = data.chosenRealm;
        card.isSpecial = false;
      }
      // 前のフィールドカードを捨て札へ
      if (room.fieldCard) {
        if (!room.discardPile) room.discardPile = [];
        room.discardPile.push(room.fieldCard);
      }
      room.fieldCard = { ...card };
      room.logs.push({ id: Math.random(), text: `${player.name} が ${REALM_NAME_JA[originalRealm] || originalRealm} を展開` });

      if (card.isSpecial) {
        if (card.realm === 'GEAR') {
          const next = (room.nextDrawAmount === 1) ? 2 : (room.nextDrawAmount || 0) + 2;
          room.nextDrawAmount = (MAX_DRAW_STACK > 0) ? Math.min(next, MAX_DRAW_STACK) : next;
        }
        if (card.realm === 'MACHINE') room.isReversed = !room.isReversed;
      }
      player.handCount = player.hand.length;

      if (!checkGameOver(room)) {
        nextTurn(room, card.isSpecial && card.realm === 'MACHINE' && room.players.length === 2);
      }
      room.lastAction = { type: 'play', playerId: socket.id, cardId: card.id };
      io.to(room.id).emit('update-game', room);

      // 次がAIなら動かす
      const nextPlayer = room.players[room.turnIndex];
      if (room.status === 'playing' && nextPlayer && nextPlayer.isBot && !nextPlayer.isEliminated) {
        processBotTurn(room.id);
      }
    } catch (e) { console.error("[ERROR] play-card:", e); }
  });

  socket.on('draw-card', (data) => {
    try {
      const room = rooms[data.roomId.toUpperCase()];
      if (!room || room.status !== 'playing' || room.players[room.turnIndex].id !== socket.id) return;
      const player = room.players.find(p => p.id === socket.id);
      const amount = room.nextDrawAmount || 1;
      for (let i = 0; i < amount; i++) { if (room.deck.length === 0) replenishDeck(room); player.hand.push(room.deck.pop()); }
      player.handCount = player.hand.length;
      room.logs.push({ id: Math.random(), text: `${player.name} が ${amount}枚 ドロー` });
      room.nextDrawAmount = 1;

      if (player.handCount >= HAND_LIMIT) {
        player.isEliminated = true;
        player.score += ELIMINATION_PENALTY;
        room.logs.push({ id: Math.random(), text: `臨界突破: ${player.name} が脱落！ (SCORE ${ELIMINATION_PENALTY})` });
      }

      if (!checkGameOver(room)) {
        nextTurn(room);
      }
      room.lastAction = { type: 'draw', playerId: socket.id };
      io.to(room.id).emit('update-game', room);

      // 次がAIなら動かす
      const nextPlayer = room.players[room.turnIndex];
      if (room.status === 'playing' && nextPlayer && nextPlayer.isBot && !nextPlayer.isEliminated) {
        processBotTurn(room.id);
      }
    } catch (e) { console.error("[ERROR] draw-card:", e); }
  });

  socket.on('play-again', (data) => {
    const room = rooms[data.roomId.toUpperCase()];
    if (room && room.status === 'finished') {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.ready = true;
        room.logs.push({ id: Math.random(), text: `${player.name} が準備完了しました` });
      }

      const humanPlayers = room.players.filter(p => !p.isBot);
      const allReady = humanPlayers.every(p => p.ready);

      if (allReady) {
        if (room.isSeriesFinished) {
          room.matchCount = 1;
          room.isSeriesFinished = false;
          room.players.forEach(p => { p.score = 0; p.winStreak = 0; });
          room.status = 'waiting';
          room.logs = [];
        } else {
          // 次のマッチを開始 (start-gameのロジックと同様)
          room.deck = createDeck();
          room.turnIndex = Math.floor(Math.random() * room.players.length);
          room.players.forEach(p => {
            p.hand = []; for (let i = 0; i < INITIAL_HAND; i++) p.hand.push(room.deck.pop());
            p.handCount = p.hand.length;
            p.isEliminated = false;
            p.earnedPoints = 0;
            p.finishBonus = false;
            p.ready = p.isBot;
          });
          room.fieldCard = room.deck.pop();
          room.status = 'playing';
          room.currentTurnPlayerId = room.players[room.turnIndex].id;
          room.nextDrawAmount = 1;
          room.isReversed = false;
          room.discardPile = [];
          room.logs = [{ id: Math.random(), text: `MATCH ${room.matchCount} 開始。` }];
          
          if (room.players[room.turnIndex].isBot) processBotTurn(room.id);
        }
      }
      io.to(room.id).emit('update-game', room);
    }
  });

  socket.on('leave-room', (data) => { if (data.roomId) handlePlayerExit(socket, data.roomId.toUpperCase()); });
  socket.on('disconnect', () => { for (const rid in rooms) handlePlayerExit(socket, rid); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
