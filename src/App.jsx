import React, { useState, useEffect, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * CROSS REALM - v16.0 "Final Prototype" Integrated Edition
 * * 統合ポイント:
 * 1. v16.0のアイコンデザイン (機械リバースの矢印、噴水ワイルドの虹)
 * 2. ヴォイド属性（惑星・廃墟）の視認性特化ラベル
 * 3. 特殊効果（DRAW 2, REVERSE, WILD）のHUD統合演出
 * 4. 手札の3Dインタラクション
 */

// Socket.ioの接続先
const socket = io('https://crossrealm-server.onrender.com');

// -----------------------------------------------------------------------------
// 1. レルム・世界観定義
// -----------------------------------------------------------------------------
const REALMS = {
  GEAR: { n: '歯車', color: '#FF8C00', shadow: 'rgba(255, 140, 0, 0.7)' },
  ICEAGE: { n: '氷河期', color: '#00BFFF', shadow: 'rgba(0, 191, 255, 0.9)' },
  FOUNTAIN: { n: '噴水', color: '#4169E1', shadow: 'rgba(65, 105, 225, 0.9)' },
  BATTERY: { n: '電池', color: '#32CD32', shadow: 'rgba(50, 205, 50, 0.9)' },
  MACHINE: { n: '機械', color: '#94A3B8', shadow: 'rgba(148, 163, 184, 0.7)' },
  ARCHIVE: { n: '古文書', color: '#FF3131', shadow: 'rgba(255, 49, 49, 0.9)' },
  PLANET: { n: '惑星', color: '#9400D3', shadow: 'rgba(148, 0, 211, 1)' },
  RUINS: { n: '廃墟', color: '#FFFFFF', shadow: 'rgba(255, 255, 255, 0.8)' }
};

const THEMES = { 
  GEAR: 'steampunk', ARCHIVE: 'steampunk', 
  ICEAGE: 'fantasy', FOUNTAIN: 'fantasy', 
  PLANET: 'void', RUINS: 'void', 
  BATTERY: 'cyber', MACHINE: 'cyber' 
};

const CYCLE_ORDER = ['GEAR', 'ICEAGE', 'FOUNTAIN', 'BATTERY', 'MACHINE', 'ARCHIVE'];

// -----------------------------------------------------------------------------
// 2. アイコンSVG定義 (v16.0 改良版)
// -----------------------------------------------------------------------------
const ICONS = {
  GEAR: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"></path></svg>,
  ICEAGE: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m10 20-2.5-2.5L5 20"/><path d="M12 22V2"/><path d="m14 20 2.5-2.5L19 20"/><path d="m10 4-2.5 2.5L5 4"/><path d="m14 4 2.5 2.5L19 4"/><path d="m20 10-2.5 2.5L20 15"/><path d="M22 12H2"/><path d="m4 10 2.5 2.5L4 15"/></svg>,
  FOUNTAIN: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22a9.7 9.7 0 0 1-7.1-3 7 7 0 0 1-1.4-8.4l6.8-9.4a2 2 0 0 1 3.4 0l6.8 9.4a7 7 0 0 1-1.4 8.4A9.7 9.7 0 0 1 12 22z"></path></svg>,
  BATTERY: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"></rect><line x1="22" x2="22" y1="11" y2="13"></line><line x1="6" x2="6" y1="11" y2="13"></line><line x1="10" x2="10" y1="11" y2="13"></line><line x1="14" x2="14" y1="11" y2="13"></line></svg>,
  MACHINE: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>,
  MACHINE_S: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" opacity="0.3"></rect><path d="M12 8v4l3 3" strokeWidth="2"/><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" strokeWidth="2" stroke="currentColor"/><polyline points="16 8 21 8 21 3" strokeWidth="2" stroke="currentColor"/></svg>,
  ARCHIVE: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>,
  PLANET: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10z"></path></svg>,
  RUINS: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 20h20"></path><path d="M5 20v-8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8"></path><path d="M9 20v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"></path></svg>
};

// -----------------------------------------------------------------------------
// 3. スタイル定義 (CSS-in-JS)
// -----------------------------------------------------------------------------
const GLOBAL_STYLE = `
  @keyframes rotate-eternal { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes nebula-pulse { 0% { opacity: 0.5; transform: scale(1); } 100% { opacity: 0.8; transform: scale(1.1); } }
  @keyframes glitch-flicker { from { opacity: 1; } to { opacity: 0.8; } }
  @keyframes rainbow-glow { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
  @keyframes vibrate { 0% { transform: translateZ(120px) rotate(-10.5deg); } 100% { transform: translateZ(120px) rotate(-9.5deg); } }
  @keyframes liquid-shape { 0% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; } 100% { border-radius: 70% 30% 30% 70% / 70% 70% 30% 30%; } }

  .font-steampunk { font-family: 'Special Elite', cursive; }
  .font-fantasy { font-family: 'Cinzel Decorative', serif; }
  .font-cyber { font-family: 'Orbitron', sans-serif; }
  .font-void { font-family: 'Audiowide', cursive; }

  .card-base { transform-style: preserve-3d; transition: transform 0.12s ease-out, box-shadow 0.4s ease; border-radius: 12px; }
  
  .theme-steampunk { border: 6px solid #3d2416; background: linear-gradient(135deg, #4a2511, #1a0802); box-shadow: 0 10px 30px #000; }
  .theme-steampunk::before { content: ''; position: absolute; inset: 0; background-image: repeating-linear-gradient(45deg, rgba(0,0,0,0.3) 0, rgba(0,0,0,0.3) 2px, transparent 2px, transparent 4px); opacity: 0.6; }

  .theme-fantasy { border: 3px solid rgba(255,255,255,0.7); background: radial-gradient(circle at 50% 50%, #2a1b7e, #05021a); box-shadow: 0 0 30px rgba(138,43,226,0.4); }
  
  .theme-cyber { background: #000; box-shadow: inset 0 0 50px rgba(0,255,255,0.1); border: 2px solid var(--r-color); clip-path: polygon(0 15%, 15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%); }
  
  .theme-void { border: none; background: #000; box-shadow: 0 0 60px var(--r-shadow-color), inset 0 0 120px var(--r-shadow-color); animation: liquid-shape 10s infinite alternate ease-in-out; }

  .label-bg { background: rgba(0,0,0,0.9); border-left: 5px solid var(--r-color); padding: 4px 12px; border-radius: 2px; }
  .theme-void .label-bg { background: #fff; border-left: 8px solid var(--r-color); box-shadow: 0 0 20px #fff; }
  .theme-void .label-bg span { color: #000; text-shadow: none; }

  .unit-reverse-text { position: absolute; top: 60%; left: 50%; width: 120px; background: var(--r-color); color: #000; font-family: 'Orbitron'; font-weight: 900; font-size: 12px; padding: 3px 0; text-align: center; transform: translate(-50%, -50%) translateZ(120px); clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%); animation: glitch-flicker 0.2s infinite alternate; }
  .effect-text-wild { position: absolute; bottom: 50px; left: 50%; width: 100%; text-align: center; transform: translateX(-50%) translateZ(130px); font-size: 28px; font-weight: 900; font-style: italic; background: linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); background-size: 200% 100%; -webkit-background-clip: text; color: transparent; animation: rainbow-glow 2s linear infinite; filter: drop-shadow(0 0 15px #fff); }
  .unit-draw2 { position: absolute; top: 80px; left: -10px; width: 60px; background: #6a1505; border: 3px solid #D4AF37; border-radius: 4px; transform: translateZ(140px) rotate(-10deg); display: flex; flex-direction: column; align-items: center; padding: 8px 0; animation: vibrate 0.05s infinite; box-shadow: 10px 5px 25px #000; }
  .unit-draw2 .num { font-family: 'Special Elite'; font-size: 32px; color: #fff; line-height: 1; text-shadow: 0 0 15px #f00; }
  .unit-draw2 .txt { font-size: 10px; color: #D4AF37; font-weight: 900; margin-top: 4px; background: #000; width: 100%; text-align: center; }
`;

// -----------------------------------------------------------------------------
// 4. サブコンポーネント: Card
// -----------------------------------------------------------------------------
const Card = ({ card, playable, onClick, isField, size = 'hand' }) => {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ transform: 'rotateX(0deg) rotateY(0deg)', '--mx': '50%', '--my': '50%' });

  if (!card || !card.realm) return null;

  let baseRealm = card.realm;
  if (card.wasRuins) baseRealm = 'RUINS';
  else if (card.wasPlanet) baseRealm = 'PLANET';
  else if (card.wasFountain || (card.realm === 'FOUNTAIN' && card.isSpecial)) baseRealm = 'FOUNTAIN';

  const theme = THEMES[baseRealm] || 'fantasy';
  const isSpecial = card.isSpecial || card.wasFountain;
  const isWildType = baseRealm === 'PLANET' || baseRealm === 'RUINS';
  const isFountainWild = baseRealm === 'FOUNTAIN' && isSpecial;

  const rColor = REALMS[baseRealm]?.color || '#fff';
  const shadowColor = REALMS[baseRealm]?.shadow || 'rgba(255,255,255,0.4)';

  const handleMouseMove = (e) => {
    if (isField) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -25;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 25;
    setTilt({
      transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-15px) scale(1.15)`,
      '--mx': `${(x / rect.width) * 100}%`,
      '--my': `${(y / rect.height) * 100}%`,
      zIndex: 1000,
      transition: 'none'
    });
  };

  const handleMouseLeave = () => {
    setTilt({ transform: 'rotateX(0deg) rotateY(0deg)', '--mx': '50%', '--my': '50%', transition: 'all 0.5s ease-out' });
  };

  const iconComponent = isSpecial && baseRealm === 'MACHINE' ? ICONS.MACHINE_S : ICONS[baseRealm];

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`card-base theme-${theme} relative flex flex-col overflow-hidden transition-all ${playable ? 'cursor-pointer' : (!isField ? 'opacity-40 grayscale-[0.6] scale-95 pointer-events-none' : '')}`}
      style={{
        width: size === 'field' ? '180px' : '110px',
        height: size === 'field' ? '255px' : '155px',
        '--r-color': rColor,
        '--r-shadow-color': shadowColor,
        ...tilt
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>
        <div className="absolute inset-0 opacity-30 bg-fx"></div>
        
        {/* レルムラベル */}
        <div className="identity-label label-bg absolute top-3 left-3 z-30 flex items-center" style={{ transform: 'translateZ(70px)' }}>
          <span className={`uppercase font-${theme}`}>{baseRealm}</span>
        </div>

        {/* 特殊効果ユニット */}
        {baseRealm === 'MACHINE' && isSpecial && <div className="unit-reverse-text">REVERSE</div>}
        {(isWildType || isFountainWild) && <div className="effect-text-wild" style={{ fontSize: size === 'field' ? '36px' : '22px' }}>WILD</div>}
        {baseRealm === 'GEAR' && isSpecial && <div className="unit-draw2"><div className="num">2</div><div className="txt">DRAW</div></div>}

        {/* 中央アイコン */}
        <div className="absolute top-[42%] left-1/2 w-3/5 h-3/5 flex items-center justify-center z-10"
             style={{ 
               transform: 'translate(-50%, -50%) translateZ(100px)', 
               color: (isWildType || isFountainWild) ? 'url(#rainbow-gradient)' : rColor,
               filter: `drop-shadow(0 0 15px ${rColor})`
             }}>
          <svg width="0" height="0" style={{position:'absolute'}}>
            <defs>
              <linearGradient id="rainbow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f00" /><stop offset="20%" stopColor="#ff0" />
                <stop offset="40%" stopColor="#0f0" /><stop offset="60%" stopColor="#0ff" />
                <stop offset="80%" stopColor="#00f" /><stop offset="100%" stopColor="#f0f" />
              </linearGradient>
            </defs>
          </svg>
          {iconComponent}
        </div>

        {/* フッター */}
        <div className={`absolute bottom-0 w-full text-center py-3 bg-black/70 z-20 font-${theme} text-[12px] font-black tracking-[0.3em]`}
             style={{ transform: 'translateZ(60px)', textShadow: `0 0 10px ${rColor}` }}>
          {REALMS[baseRealm]?.n || '???'}
        </div>

        {/* ホログラム & グレア */}
        <div className="absolute inset-0 mix-blend-color-dodge opacity-20 bg-gradient-to-br from-white/30 via-transparent to-white/30"></div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 5. メインコンポーネント
// -----------------------------------------------------------------------------
export default function App() {
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [gameState, setGameState] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [showWildMenu, setShowWildMenu] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = GLOBAL_STYLE;
    document.head.appendChild(styleTag);

    socket.on('update-game', (data) => setGameState(data));
    return () => {
      socket.off('update-game');
      document.head.removeChild(styleTag);
    };
  }, []);

  const joinRoom = () => {
    if (!roomId || !playerName) return;
    socket.emit('join-room', { roomId: roomId.toUpperCase(), playerName: playerName.toUpperCase() });
    setIsJoined(true);
  };

  const startGame = () => socket.emit('start-game', { roomId: gameState?.id || roomId });
  const drawCard = () => socket.emit('draw-card', { roomId: gameState?.id || roomId });

  const playCard = (card) => {
    const isWild = card.realm === 'PLANET' || card.realm === 'RUINS' || (card.realm === 'FOUNTAIN' && card.isSpecial);
    if (isWild) {
      setSelectedCard(card);
      setShowWildMenu(true);
    } else {
      socket.emit('play-card', { roomId: gameState?.id || roomId, card });
    }
  };

  const selectWildRealm = (realm) => {
    socket.emit('play-card', { roomId: gameState?.id || roomId, card: selectedCard, chosenRealm: realm });
    setShowWildMenu(false);
    setSelectedCard(null);
  };

  const checkPlayable = (card) => {
    if (!gameState || gameState.currentTurnPlayerId !== socket.id) return false;
    if (gameState.nextDrawAmount > 1) return (card.realm === 'GEAR' && card.isSpecial);
    const field = gameState.fieldCard.realm;
    const hand = card.realm;
    if (hand === 'PLANET' || hand === 'RUINS') return true;
    if (field === 'PLANET' || field === 'RUINS') return true;
    if (hand === 'FOUNTAIN' && card.isSpecial) return (field === 'ICEAGE' || field === 'FOUNTAIN');
    const cycle = { GEAR:['GEAR','ICEAGE'], ICEAGE:['FOUNTAIN','BATTERY'], FOUNTAIN:['FOUNTAIN','BATTERY'], BATTERY:['MACHINE','ARCHIVE'], MACHINE:['MACHINE','ARCHIVE'], ARCHIVE:['GEAR','ICEAGE'] };
    const isTransition = ['ICEAGE', 'BATTERY', 'ARCHIVE'].includes(field);
    if (field === hand && isTransition) return false;
    return field === hand || (cycle[field] && cycle[field].includes(hand));
  };

  const myData = gameState?.players.find(p => p.id === socket.id);
  const isMyTurn = gameState?.currentTurnPlayerId === socket.id;

  // --- UI表示 ---

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-slate-900 border-2 border-amber-500/50 p-12 rounded-3xl w-full max-w-md shadow-[0_0_50px_rgba(212,175,55,0.2)] text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
          <h1 className="text-5xl font-black mb-2 font-cinzel text-amber-500 tracking-widest drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]">CROSS REALM</h1>
          <p className="text-cyan-400 text-[11px] font-black tracking-[0.6em] mb-10 uppercase">Identity Reborn Edition</p>
          <div className="space-y-6 relative z-10">
            <input type="text" placeholder="ID: Pilot Name" value={playerName} onChange={e => setPlayerName(e.target.value)}
                   className="w-full bg-black/60 border-b-2 border-amber-500/50 p-4 text-center font-bold text-white outline-none focus:border-cyan-400 transition-all" />
            <input type="text" placeholder="Sector ID (合言葉)" value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())}
                   className="w-full bg-black/60 border-b-2 border-amber-500/50 p-4 text-center font-bold text-white outline-none focus:border-cyan-400 transition-all" />
            <button onClick={joinRoom} className="w-full bg-amber-600 hover:bg-amber-500 text-black font-black py-5 rounded-xl transition-all shadow-xl shadow-amber-900/40 text-lg tracking-widest uppercase">Sync Start</button>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState || gameState.status === 'waiting') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="mb-10">
            <p className="text-cyan-400 text-xs font-black tracking-[1em] mb-2">AWAITING LINKAGE</p>
            <h2 className="font-cinzel text-6xl font-black text-white tracking-tighter shadow-text">SECTOR: {roomId}</h2>
        </div>
        <div className="w-full max-w-sm space-y-3 mb-12">
          {gameState?.players.map((p, i) => (
            <div key={i} className="bg-slate-900/80 p-5 rounded-xl border-l-8 border-amber-500 flex justify-between items-center shadow-lg transform hover:scale-105 transition-all">
              <span className="font-black text-xl tracking-wider uppercase">{p.name}</span>
              <span className="text-[10px] font-black bg-cyan-400 text-black px-3 py-1 rounded-full animate-pulse">CONNECTED</span>
            </div>
          ))}
        </div>
        <button onClick={startGame} disabled={gameState?.players.length < 2}
                className="bg-white text-black px-16 py-5 rounded-full font-black text-2xl hover:bg-cyan-400 transition-all disabled:opacity-20 shadow-[0_0_30px_rgba(255,255,255,0.3)]">START MISSION</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#020205] text-white flex flex-col overflow-hidden font-exo">
      {/* 他プレイヤー状況 */}
      <div className="p-4 bg-slate-900/80 border-b border-white/5 flex gap-4 overflow-x-auto no-scrollbar backdrop-blur-md">
        {gameState.players.map(p => (
          <div key={p.id} className={`flex-shrink-0 min-w-[140px] p-3 rounded-lg border-l-4 transition-all ${gameState.currentTurnPlayerId === p.id ? 'border-cyan-400 bg-cyan-900/30 ring-1 ring-cyan-400/50' : 'border-white/10 bg-black/40'}`}>
            <div className="text-[10px] font-black opacity-60 truncate mb-1 uppercase tracking-widest">{p.name}</div>
            <div className="text-2xl font-black font-cinzel">{p.handCount} <span className="text-[10px] opacity-40 font-exo">UNITS</span></div>
          </div>
        ))}
      </div>

      {/* メインフィールド */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 bg-radial-gradient from-cyan-900/10 to-transparent pointer-events-none"></div>
        
        <div className="absolute top-8 flex flex-col gap-3 items-center z-50">
          {gameState.nextDrawAmount > 1 && <div className="bg-red-600 text-white px-8 py-2 rounded-full font-black animate-bounce shadow-[0_0_30px_#f00]">CRITICAL: DRAW +{gameState.nextDrawAmount}</div>}
          {gameState.isReversed && <div className="bg-amber-500 text-black px-6 py-1 rounded-full font-black text-xs tracking-widest animate-pulse">SEQUENCE REVERSED</div>}
        </div>
        
        <div className="relative group perspective-1000">
          <Card card={gameState.fieldCard} isField={true} size="field" />
          <div className="absolute -bottom-16 left-0 right-0 text-center flex flex-col items-center gap-1">
             <div className="text-[11px] font-black tracking-[0.8em] text-cyan-400 uppercase animate-pulse">
                {isMyTurn ? "Access Granted" : "Link Synchronizing"}
             </div>
             <div className="h-1 w-32 bg-cyan-950 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 animate-loading-bar"></div>
             </div>
          </div>
        </div>
      </div>

      {/* 手札エリア */}
      <div className="p-8 bg-black/90 backdrop-blur-3xl border-t border-white/5 z-[1000] shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-10 items-center">
          <div className="flex-shrink-0 text-center lg:text-left border-r border-white/10 pr-10">
            <div className="text-[10px] font-black text-cyan-400 mb-2 tracking-[0.4em] uppercase">Core Integrity</div>
            <div className="text-6xl font-black italic font-cinzel leading-none mb-6">{myData?.hand.length}<span className="text-2xl opacity-20 ml-2">/12</span></div>
            <button onClick={drawCard} disabled={!isMyTurn} 
                    className={`px-12 py-5 rounded-2xl font-black text-xl transition-all shadow-2xl ${isMyTurn ? 'bg-white text-black hover:bg-cyan-400 hover:scale-105 active:scale-95' : 'bg-slate-900 text-slate-700 border border-white/5 opacity-50 cursor-not-allowed'}`}>
              REQUEST UNIT
            </button>
          </div>

          <div className="flex-1 flex justify-center items-end h-56 relative overflow-visible px-10">
            {myData?.hand.map((card, i) => {
              const total = myData.hand.length;
              const angle = total <= 1 ? 0 : (i - (total - 1) / 2) * (40 / total);
              const isPlayable = checkPlayable(card);
              return (
                <div key={card.id} style={{ 
                  position: 'absolute', 
                  transform: `translateX(${(i - (total - 1) / 2) * 55}px) rotate(${angle}deg)`, 
                  zIndex: i + 10
                }}>
                  <Card card={card} playable={isPlayable} onClick={() => isPlayable && playCard(card)} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ワイルド選択（ALIGNMENT）メニュー */}
      {showWildMenu && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[5000] flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
          <div className="text-cyan-400 text-xs font-black tracking-[1em] mb-4 uppercase">System Intervention</div>
          <h2 className="font-cinzel text-5xl font-black text-white mb-12 tracking-widest text-shadow-glow">ALIGN CORE REALM</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-2xl">
            {CYCLE_ORDER.map(r => (
              <button key={r} onClick={() => selectWildRealm(r)}
                      className="group relative p-8 rounded-2xl border-2 transition-all hover:bg-white hover:text-black overflow-hidden"
                      style={{ borderColor: REALMS[r].color, color: REALMS[r].color }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-current transition-opacity"></div>
                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-12 h-12">{ICONS[r]}</div>
                    <span className="font-black text-xl tracking-widest uppercase">{REALMS[r].n}</span>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => {setShowWildMenu(false); setSelectedCard(null);}} className="mt-12 text-slate-500 uppercase font-black text-sm tracking-[0.4em] hover:text-white transition-colors underline decoration-1 underline-offset-8">Abort Alignment</button>
        </div>
      )}

      {/* ミッション終了画面 */}
      {gameState.status === 'finished' && (
        <div className="fixed inset-0 bg-black/95 z-[9000] flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-500">
          <div className="text-[12vw] font-black font-cinzel text-white leading-none mb-[-2vh] drop-shadow-[0_0_50px_rgba(255,255,255,0.4)] tracking-tighter">MISSION END</div>
          <div className="bg-slate-900 border border-white/10 p-12 rounded-[3rem] w-full max-w-lg shadow-[0_0_100px_rgba(0,0,0,1)] relative">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-500 text-black px-10 py-2 rounded-full font-black text-sm tracking-widest">FINAL RANKING</div>
            <div className="space-y-4 mb-10 mt-4">
              {gameState.players.slice().sort((a,b) => a.handCount - b.handCount).map((p, i) => (
                <div key={p.id} className={`p-5 rounded-2xl border flex items-center transition-all ${p.handCount === 0 ? 'border-cyan-400 bg-cyan-400/10 scale-105 shadow-[0_0_20px_rgba(64,224,208,0.2)]' : 'border-white/5 opacity-40 grayscale'}`}>
                  <span className="font-black text-3xl mr-6 italic font-cinzel text-slate-500">#{i+1}</span>
                  <span className="font-black text-xl tracking-wider uppercase flex-1 text-left">{p.name}</span>
                  <span className="font-black text-cyan-400 font-mono text-xl">{p.handCount}</span>
                </div>
              ))}
            </div>
            <button onClick={startGame} className="w-full bg-white text-black py-5 rounded-2xl font-black text-2xl hover:bg-cyan-400 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-cyan-900/20">RE-LINK SECTOR</button>
          </div>
        </div>
      )}
    </div>
  );
}
