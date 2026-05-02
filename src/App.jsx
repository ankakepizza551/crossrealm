import React, { useState, useEffect, useMemo, useRef } from 'react';
import io from 'socket.io-client';
import './index.css';
import CycleDiagramSmall from './components/CycleDiagramSmall';

const socket = io(
    (window.location.hostname.includes('onrender.com'))
        ? undefined
        : `${window.location.protocol}//${window.location.hostname}:3000`
);

const REALMS = {
    GEAR: { n: '歯車', color: '#FF8C00', bright: '#FFD700', glow: 'rgba(255,140,0,1)', theme: 'steam', font: 'Special Elite' },
    ARCHIVE: { n: '古文書', color: '#FF3131', bright: '#FF6347', glow: 'rgba(255,49,49,1)', theme: 'steam', font: 'Special Elite' },
    FOUNTAIN: { n: '噴水', color: '#0047FF', bright: '#6699FF', glow: 'rgba(0,71,255,1)', theme: 'fantasy', font: 'Cinzel Decorative' },
    ICEAGE: { n: '氷河期', color: '#00F3FF', bright: '#ADFCFF', glow: 'rgba(0,243,255,1)', theme: 'fantasy', font: 'Cinzel Decorative' },
    MACHINE: { n: '機械', color: '#E2B0FF', bright: '#DDA0DD', glow: 'rgba(226,176,255,1)', dim: 'rgba(226,176,255,0.4)', theme: 'cyber', font: 'Orbitron' },
    BATTERY: { n: '電池', color: '#ADFF2F', bright: '#7FFF00', glow: 'rgba(173,255,47,1)', dim: 'rgba(173,255,47,0.4)', theme: 'cyber', font: 'Orbitron' },
    PLANET: { n: '惑星', color: '#FFFFFF', bright: '#F0F8FF', glow: 'rgba(255,255,255,1)', theme: 'void-planet', font: 'Audiowide' },
    RUINS: { n: '廃墟', color: '#CCCCCC', bright: '#D3D3D3', glow: 'rgba(204,204,204,1)', theme: 'void-ruins', font: 'Audiowide' }
};

const NEXT_MAP = { GEAR: ['GEAR', 'ICEAGE'], ICEAGE: ['FOUNTAIN', 'BATTERY'], FOUNTAIN: ['FOUNTAIN', 'BATTERY'], BATTERY: ['MACHINE', 'ARCHIVE'], MACHINE: ['MACHINE', 'ARCHIVE'], ARCHIVE: ['GEAR', 'ICEAGE'] };
const SORT_WEIGHT = { GEAR: 1, ICEAGE: 2, FOUNTAIN: 3, BATTERY: 4, MACHINE: 5, ARCHIVE: 6, PLANET: 7, RUINS: 8 };

let audioCtx = null;
const playSE = (type, muted) => {
    if (muted) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const doPlay = () => {
            const now = audioCtx.currentTime;
            if (type === 'play') {
                const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
                o.connect(g); g.connect(audioCtx.destination); o.type = 'square';
                o.frequency.setValueAtTime(800, now); o.frequency.exponentialRampToValueAtTime(100, now + 0.1);
                g.gain.setValueAtTime(0.06, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                o.start(now); o.stop(now + 0.1);
            } else if (type === 'draw') {
                const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
                o.connect(g); g.connect(audioCtx.destination); o.type = 'triangle';
                o.frequency.setValueAtTime(500, now); o.frequency.exponentialRampToValueAtTime(100, now + 0.05);
                g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                o.start(now); o.stop(now + 0.05);
            } else if (type === 'start') {
                const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
                o.connect(g); g.connect(audioCtx.destination); o.type = 'sawtooth';
                o.frequency.setValueAtTime(40, now); o.frequency.linearRampToValueAtTime(800, now + 0.7);
                g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
                o.start(now); o.stop(now + 0.7);
            } else if (type === 'cancel') {
                const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
                o.connect(g); g.connect(audioCtx.destination); o.type = 'sawtooth';
                o.frequency.setValueAtTime(150, now); o.frequency.exponentialRampToValueAtTime(80, now + 0.25);
                g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                o.start(now); o.stop(now + 0.25);
            } else if (type === 'burst') {
                // バースト音：下降する不協和音
                const o1 = audioCtx.createOscillator(); const g1 = audioCtx.createGain();
                o1.connect(g1); g1.connect(audioCtx.destination); o1.type = 'square';
                o1.frequency.setValueAtTime(400, now); o1.frequency.exponentialRampToValueAtTime(50, now + 0.5);
                g1.gain.setValueAtTime(0.2, now); g1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                o1.start(now); o1.stop(now + 0.5);
            } else if (type === 'victory') {
                // 勝利音：上昇する明るいファンファーレ
                [0, 0.15, 0.3].forEach((delay, i) => {
                    const freq = [523, 659, 784][i]; // C, E, G
                    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
                    o.connect(g); g.connect(audioCtx.destination); o.type = 'sine';
                    o.frequency.setValueAtTime(freq, now + delay);
                    g.gain.setValueAtTime(0.1, now + delay); g.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.3);
                    o.start(now + delay); o.stop(now + delay + 0.3);
                });
            } else if (type === 'wild') {
                // WILD変化音：神秘的なキラキラ音
                const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
                o.connect(g); g.connect(audioCtx.destination); o.type = 'sine';
                o.frequency.setValueAtTime(1200, now); o.frequency.exponentialRampToValueAtTime(2400, now + 0.2);
                g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                o.start(now); o.stop(now + 0.2);
            }
        };
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(doPlay).catch(() => { });
        } else {
            doPlay();
        }
    } catch (e) { }
};

const ComplexEmblem = ({ isLogo = false }) => (
    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <defs>
            <filter id="core-glow-bg"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
        </defs>
        <g style={{ transform: isLogo ? 'scale(1)' : 'scale(0.8)', transformOrigin: 'center' }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" strokeWidth="0.5" opacity="0.3" strokeDasharray="1 3" />
            <g style={{ animation: 'emblem-rotate-outer 40s linear infinite', transformOrigin: 'center' }}>
                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="1" strokeDasharray="15 5" opacity="0.4" />
                {[...Array(3)].map((_, i) => <rect key={i} x="48" y="2" width="4" height="6" fill="var(--accent)" opacity="0.6" transform={`rotate(${i * 120} 50 50)`} />)}
            </g>
            <path d="M50 16 L79.4 33 L79.4 67 L50 84 L20.6 67 L20.6 33 Z" fill="none" stroke="var(--steam-gold)" strokeWidth="1.5" opacity="0.5" style={{ animation: 'emblem-rotate-inner 45s linear infinite', transformOrigin: 'center' }} />
            <path d="M50 20 L76 35 L76 65 L50 80 L24 65 L24 35 Z" fill="none" stroke="var(--steam-gold)" strokeWidth="0.5" opacity="0.3" style={{ animation: 'emblem-rotate-outer 55s linear infinite', transformOrigin: 'center' }} />
            {isLogo && <g style={{ animation: 'emblem-rotate-inner 45s linear infinite', transformOrigin: 'center' }}>{[...Array(6)].map((_, i) => <circle key={i} cx="50" cy="16" r="1.5" fill="var(--steam-gold)" opacity="0.9" transform={`rotate(${i * 60} 50 50)`} />)}</g>}
            <circle cx="50" cy="50" r="12" fill="var(--danger)" opacity="0.3" filter="url(#core-glow-bg)" style={{ animation: 'emblem-pulse 3s infinite' }} />
            <path d="M36 36 L64 64 M64 36 L36 64" stroke="#fff" strokeWidth="4" strokeLinecap="square" opacity="0.9" />
            <path d="M30 30 L70 70 M70 30 L30 70" stroke="var(--accent)" strokeWidth="1" strokeLinecap="square" opacity="0.5" />
            <text x="50" y="54" fill="var(--accent)" fontSize="10" fontWeight="1000" font-family="Orbitron" textAnchor="middle" style={{ animation: 'emblem-pulse 2s infinite' }}>X</text>
        </g>
    </svg>
);

const IconRenderer = ({ r, spec, className, ...rest }) => {
    const p = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: spec ? 4 : 2, strokeLinecap: "round", strokeLinejoin: "round", className: className || "w-full h-full", ...rest };
    switch (r) {
        case 'GEAR':
            return <svg {...p}>
                <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.1" stroke="none" />
                <circle cx="12" cy="12" r="5" fill="none" strokeWidth="1.5" />
                <g style={{ transformOrigin: 'center' }}>
                    {[...Array(8)].map((_, i) => (
                        <rect key={i} x="11" y="2" width="2" height="4" fill="currentColor" transform={`rotate(${i * 45} 12 12)`} />
                    ))}
                </g>
                <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
            </svg>;
        case 'ARCHIVE':
            return <svg {...p}>
                <path d="M4 17a3 3 0 0 1 3-3 5 5 0 0 1 9 1 3 3 0 0 1 0 6H7a3 3 0 0 1-3-3z" fill="currentColor" opacity="0.1" stroke="none" />
                <path d="M8.5 5H20v15.5H8.5a2.5 2.5 0 0 1 0-5H20" fill="currentColor" opacity="0.2" stroke="none" />
                <path d="M6 20.5A2.5 2.5 0 0 1 8.5 18H20" />
                <path d="M8.5 5H20v15.5H8.5a2.5 2.5 0 0 1 0-5H20" />
                <rect x="15" y="10" width="6" height="5" rx="1" fill="currentColor" opacity="0.4" stroke="none" />
                <rect x="15" y="10" width="6" height="5" rx="1" />
                <circle cx="18" cy="12.5" r="1.5" fill="currentColor" stroke="none" style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
            </svg>;
        case 'FOUNTAIN':
            return <svg {...p}>
                <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.1" stroke="none" />
                <circle cx="12" cy="12" r="9" strokeDasharray="2 4" opacity="0.6" />
                <path d="M12 19c3.8 0 7-3.2 7-7 0-4.5-7-10-7-10S5 7.5 5 12c0 3.8 3.2 7 7 7z" fill="currentColor" opacity="0.25" stroke="none" />
                <path d="M12 19c3.8 0 7-3.2 7-7 0-4.5-7-10-7-10S5 7.5 5 12c0 3.8 3.2 7 7 7z" />
                <path d="M12 16c2 0 3.5-1.5 3.5-3.5 0-2.5-3.5-5.5-3.5-5.5S8.5 10 8.5 12.5c0 2 1.5 3.5 3.5 3.5z" fill="currentColor" stroke="none" style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
                <path d="M7 6a7 7 0 0 1 10 0" opacity="0.8" />
            </svg>;
        case 'ICEAGE':
            return <svg {...p}>
                <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.1" stroke="none" />
                <path d="M12 3v18 M3 12h18 M5.6 5.6l12.8 12.8 M5.6 18.4l12.8-12.8" strokeWidth="1.2" opacity="0.7" />
                <polygon points="12 7 17 12 12 17 7 12" fill="currentColor" opacity="0.25" stroke="none" />
                <polygon points="12 7 17 12 12 17 7 12" fill="none" strokeWidth="1.2" />
                <polygon points="12 4 15.5 8.5 20 12 15.5 15.5 12 20 8.5 15.5 4 12 8.5 8.5" fill="none" strokeWidth="1.2" opacity="0.5" />
                <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
            </svg>;
        case 'MACHINE':
            return <svg {...p}>
                <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" opacity="0.1" stroke="none" />
                <rect x="8" y="8" width="8" height="8" strokeWidth="1.5" />
                <path d="M12 8v8 M8 12h8" strokeWidth="1" opacity="0.5" />
                <path d="M10 4v2 M14 4v2 M10 18v2 M14 18v2 M4 10h2 M4 14h2 M18 10h2 M18 14h2" strokeWidth="1.5" />
                <rect x="11" y="11" width="2" height="2" fill="currentColor" stroke="none" style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
            </svg>;
        case 'BATTERY':
            return <svg {...p}>
                <rect x="2" y="7" width="4" height="1" fill="currentColor" opacity="0.2" stroke="none" />
                <rect x="18" y="15" width="3" height="2" fill="currentColor" opacity="0.15" stroke="none" />
                <rect x="5" y="4" width="14" height="14" fill="currentColor" opacity="0.08" stroke="none" />
                <rect x="5" y="3" width="14" height="18" rx="2" fill="currentColor" opacity="0.2" stroke="none" />
                <rect x="5" y="3" width="14" height="18" rx="2" />
                <path d="M9 1h6 M5 8h14 M5 16h14" />
                <path d="M12.5 4.5l-2.5 6h4l-2.5 6" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
            </svg>;
        case 'PLANET': return <svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
        case 'RUINS': return <svg {...p}><path d="M3 21h18M5 21V10a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11M9 21v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4" /></svg>;
        case 'BACK': return <svg {...p}><rect x="2" y="2" width="20" height="20" rx="2" fill="currentColor" opacity="0.1" stroke="none" /><circle cx="12" cy="12" r="8" strokeWidth="0.5" strokeDasharray="1 2" /><path d="M12 4v4 M12 16v4 M4 12h4 M16 12h4" opacity="0.5" /><path d="M7 7l10 10 M7 17l10-10" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" fill="currentColor" /><circle cx="12" cy="12" r="5" strokeWidth="0.5" /></svg>;
        default: return null;
    }
};

const CardOrnaments = ({ theme }) => {
    if (theme === 'steam') return (
        <React.Fragment>
            <div className="steam-rivet r-tl" /><div className="steam-rivet r-tr" /><div className="steam-rivet r-bl" /><div className="steam-rivet r-br" />
            <div className="steam-core-glow" />
            <div className="steam-particle" style={{ '--l': '-5%', '--d': '2.5s', '--delay': '0s', '--drift-start': '0px', '--drift-end': '30px', '--rot': '90deg' }} />
            <div className="steam-particle" style={{ '--l': '35%', '--d': '3.2s', '--delay': '1.2s', '--drift-start': '10px', '--drift-end': '-20px', '--rot': '-45deg' }} />
            <div className="steam-particle" style={{ '--l': '75%', '--d': '2.8s', '--delay': '0.5s', '--drift-start': '-10px', '--drift-end': '25px', '--rot': '120deg' }} />
        </React.Fragment>
    );
    if (theme === 'fantasy') return (
        <React.Fragment>
            <div className="magic-circle-bg" /><div className="ripple" style={{ '--delay': '0s' }} /><div className="ripple" style={{ '--delay': '2s' }} />
        </React.Fragment>
    );
    if (theme === 'cyber') return (
        <React.Fragment><div className="cyber-circuit" /><div className="cyber-fx-scanline" /></React.Fragment>
    );
    if (theme.includes('void')) return (
        <React.Fragment><div className="void-singularity-ring" /><div className="void-fluctuation" /></React.Fragment>
    );
    return null;
};

const CardView = ({ card, playable, isField, isSelected, isMyTurn, hideOrnaments }) => {
    if (!card?.realm) return null;
    let dr = card.realm;
    const spec = card.isSpecial;
    const rData = REALMS[dr] || REALMS.GEAR;

    let specialLabel = "";
    if (spec) {
        if (dr === 'GEAR') specialLabel = "DRAW 2";
        else if (dr === 'MACHINE') specialLabel = "REVERSE";
        else if (dr === 'FOUNTAIN') specialLabel = "LIMIT WILD";
        else specialLabel = "WILD";
    }

    return (
        <div className={`card-surface mat-${rData.theme}`}
            style={{ '--r-color': rData.color, '--r-color-bright': rData.bright, '--r-color-glow': rData.glow, '--r-color-dim': rData.dim || 'rgba(0,0,0,0.5)', width: 'var(--card-w)', height: 'var(--card-h)', borderRadius: '8px', overflow: 'hidden', position: 'relative', border: 'none' }}>
            {!hideOrnaments && <CardOrnaments theme={rData.theme} />}
            <div className="card-content">
                <div className="card-info-top"><span>{dr}</span></div>
                <div className="card-icon-overload" style={{ color: rData.bright, filter: `drop-shadow(0 0 10px ${rData.glow})`, position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', width: '55%', height: '55%' }}>
                    <IconRenderer r={dr} spec={spec} />
                </div>
                <div className={`card-footer-peak font-['${rData.font}']`}>{rData.n}</div>
                {spec && <div className="special-badge-base">{specialLabel.split(' ').map((word, i) => <div key={i}>{word}</div>)}</div>}
            </div>
        </div>
    );
};

const AstralBackground = ({ bgAnim, isDimmed }) => {
    const stars = useMemo(() => {
        // パフォーマンス向上のため星の数を削減（15 → 8）
        return [...Array(8)].map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            delay: `${Math.random() * 5}s`,
            dur: `${4 + Math.random() * 6}s`
        }));
    }, []);

    return (
        <div className={`astral-bg-container ${bgAnim ? 'bg-anim-active' : ''} ${isDimmed ? 'bg-dimmed' : ''}`}>
            {/* 1. Cyber: サイバーグリッド */}
            <div className="cyber-grid-layer" />
            
            {/* 2. Fantasy: 星雲 & 魔法陣 (CSS Background) */}
            <div className="nebula-layer">
                <div className="nebula-glow n1" />
                <div className="nebula-glow n2" />
                {/* パフォーマンス向上のためn3を削除 */}
            </div>
            
            <div className="magic-circle-layer">
                <div className="bg-magic-circle-css" />
            </div>

            {/* 3. Steampunk: 巨大歯車 (CSS Background) */}
            <div className="gears-layer">
                <div className="bg-gear-css g1" />
                <div className="bg-gear-css g2" />
            </div>
            
            {/* 4. Mana Particles */}
            <div className="star-particles">
                {stars.map(s => (
                    <div key={s.id} className="star-particle" style={{
                        left: s.left,
                        top: s.top,
                        animationDelay: s.delay,
                        animationDuration: s.dur
                    }} />
                ))}
            </div>
        </div>
    );
};

const App = () => {
    const [gs, setGs] = useState(null);
    const [motions, setMotions] = useState([]);
    const lastActionRef = useRef(null);

    useEffect(() => {
        if (!gs?.lastAction) return;
        const act = gs.lastAction;
        if (JSON.stringify(act) !== JSON.stringify(lastActionRef.current)) {
            const mid = Math.random();
            setMotions(prev => [...prev, { ...act, mid }]);
            setTimeout(() => setMotions(prev => prev.filter(m => m.mid !== mid)), 700); // 1000ms → 700ms に短縮
            lastActionRef.current = act;
        }
    }, [gs]);

    const otherPlayersInCircle = useMemo(() => {
        if (!gs || !socket) return [];
        const myIndex = gs.players.findIndex(p => p.id === socket.id);
        if (myIndex === -1) return gs.players.filter(p => p.id !== socket?.id);
        const sorted = [];
        for (let i = 1; i < gs.players.length; i++) {
            const targetIdx = (myIndex + i) % gs.players.length;
            sorted.push(gs.players[targetIdx]);
        }
        return sorted;
    }, [gs?.players, socket?.id]);

    const getPlayerPosClass = (pid) => {
        if (!gs) return "pos-center";
        if (pid === socket.id) return "pos-bottom";
        const idx = otherPlayersInCircle.findIndex(p => p.id === pid);
        if (idx === 0) return "pos-p0";
        if (idx === 1) return "pos-p1";
        if (idx === 2) return "pos-p2";
        if (idx === 3) return "pos-p3";
        return "pos-top-center";
    };

    const getTurnDistance = (pid) => {
        if (!gs || gs.status !== 'playing') return null;
        const survivors = gs.players.map((p, i) => ({ ...p, originalIdx: i })).filter(p => !p.isEliminated);
        if (survivors.length <= 1) return null;
        const currentSurvivorIdx = survivors.findIndex(p => p.originalIdx === gs.turnIndex);
        const targetSurvivorIdx = survivors.findIndex(p => p.id === pid);
        if (currentSurvivorIdx === -1 || targetSurvivorIdx === -1) return null;
        const diff = survivors.length;
        if (!gs.isReversed) return (targetSurvivorIdx - currentSurvivorIdx + diff) % diff;
        else return (currentSurvivorIdx - targetSurvivorIdx + diff) % diff;
    };

    const [room, setRoom] = useState('');
    const [name, setName] = useState('');
    const [joined, setJoined] = useState(false);
    const [selector, setSelector] = useState(null);
    const [muted, setMuted] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [hoveredCardId, setHoveredCardId] = useState(null);
    const [vfxOverlay, setVfxOverlay] = useState(null);
    const [isDisconnected, setIsDisconnected] = useState(false);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [shake, setShake] = useState(false);
    const [bgAnim, setBgAnim] = useState(true);
    const [cutin, setCutin] = useState(null);
    const [visualFieldCard, setVisualFieldCard] = useState(null);
    const prevFieldCardId = useRef(null);
    const morphTimeoutRef = useRef(null);
    const morphTimeout2Ref = useRef(null);
    const safetyTimeoutRef = useRef(null);
    const [entryAnim, setEntryAnim] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isMorphing, setIsMorphing] = useState(false);
    const [newlyDrawnCardIds, setNewlyDrawnCardIds] = useState(new Set());
    const [draggingCardId, setDraggingCardId] = useState(null);
    const [touchStartX, setTouchStartX] = useState(0);
    const [touchStartY, setTouchStartY] = useState(0);
    const [dragOffsetX, setDragOffsetX] = useState(0);
    const [dragOffsetY, setDragOffsetY] = useState(0);
    const [bufferedAction, setBufferedAction] = useState(null);

    const displayFieldCard = useMemo(() => {
        if (!gs?.fieldCard) return null;
        const c = gs.fieldCard;
        const isNewWild = (c.wasPlanet || c.wasRuins || c.wasFountain) && (c.id !== prevFieldCardId.current);
        const isDuringFreezeOrFade = (c.wasPlanet || c.wasRuins || c.wasFountain) && (isAnimating || isMorphing);
        if (isNewWild || isDuringFreezeOrFade) {
            return { ...c, realm: c.wasPlanet ? 'PLANET' : (c.wasRuins ? 'RUINS' : 'FOUNTAIN'), isSpecial: true };
        }
        return visualFieldCard || c;
    }, [gs?.fieldCard, visualFieldCard, isAnimating, isMorphing]);
    const prevPlayersRef = useRef([]);
    const logContainerRef = useRef(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        socket.on('connect', () => { setIsConnected(true); setIsDisconnected(false); });
        socket.on('update-game', (data) => { setGs(data); });
        socket.on('disconnect', (reason) => { setIsConnected(false); setIsDisconnected(true); });
        const initAudio = () => {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            document.removeEventListener('click', initAudio);
            document.removeEventListener('touchstart', initAudio);
        };
        document.addEventListener('click', initAudio);
        document.addEventListener('touchstart', initAudio);
        return () => { socket.off('update-game'); socket.off('disconnect'); socket.off('connect'); document.removeEventListener('click', initAudio); document.removeEventListener('touchstart', initAudio); };
    }, []);

    // 先行入力の実行
    useEffect(() => {
        if (!isAnimating && !isMorphing && !selector && bufferedAction) {
            const action = bufferedAction;
            setBufferedAction(null);
            if (action.type === 'play') {
                handleCardClick(action.card, action.isPlayable);
            } else if (action.type === 'draw') {
                playSE('draw', muted);
                socket.emit('draw-card', { roomId: room });
            }
        }
    }, [isAnimating, isMorphing, selector, bufferedAction]);

    useEffect(() => {
        if (gs && gs.fieldCard && gs.fieldCard.id !== prevFieldCardId.current) {
            const c = gs.fieldCard;
            if (morphTimeoutRef.current) clearTimeout(morphTimeoutRef.current);
            setEntryAnim(true);
            setTimeout(() => setEntryAnim(false), 500);
            if (c.wasPlanet || c.wasRuins || c.wasFountain) {
                setIsAnimating(true); setIsMorphing(false);
                if (morphTimeout2Ref.current) clearTimeout(morphTimeout2Ref.current);
                if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
                setVisualFieldCard({ ...c, realm: c.wasPlanet ? 'PLANET' : (c.wasRuins ? 'RUINS' : 'FOUNTAIN'), isSpecial: true });
                morphTimeoutRef.current = setTimeout(() => {
                    setVisualFieldCard(c); setIsAnimating(false); setIsMorphing(true);
                    morphTimeout2Ref.current = setTimeout(() => {
                        setIsMorphing(false); morphTimeout2Ref.current = null;
                        if (safetyTimeoutRef.current) { clearTimeout(safetyTimeoutRef.current); safetyTimeoutRef.current = null; }
                    }, 1500);
                    morphTimeoutRef.current = null;
                }, 1500);
                // iOS/DiscordブラウザでsetTimeoutが遅延した場合の強制リセット
                safetyTimeoutRef.current = setTimeout(() => {
                    setIsAnimating(false); setIsMorphing(false);
                    setVisualFieldCard(c);
                    safetyTimeoutRef.current = null;
                }, 5000);
            } else {
                setIsAnimating(false); setIsMorphing(false);
                if (morphTimeoutRef.current) { clearTimeout(morphTimeoutRef.current); morphTimeoutRef.current = null; }
                if (morphTimeout2Ref.current) { clearTimeout(morphTimeout2Ref.current); morphTimeout2Ref.current = null; }
                if (safetyTimeoutRef.current) { clearTimeout(safetyTimeoutRef.current); safetyTimeoutRef.current = null; }
                setVisualFieldCard(c);
            }
            if (prevFieldCardId.current !== null && gs.status === 'playing') {
                let dr = c.realm;
                if (c.wasRuins) dr = 'RUINS'; else if (c.wasPlanet) dr = 'PLANET'; else if (c.wasFountain || (c.realm === 'FOUNTAIN' && c.isSpecial)) dr = 'FOUNTAIN';
                
                if (c.isSpecial || c.wasPlanet || c.wasRuins || c.wasFountain || dr === 'PLANET' || dr === 'RUINS') {
                    setShake(true); setTimeout(() => setShake(false), 500);
                    let text = "WILD";
                    if (dr === 'GEAR') text = "DOUBLE DRAW";
                    else if (dr === 'MACHINE') text = "TIME REVERSE";
                    else if (dr === 'FOUNTAIN') text = "LIMIT WILD";
                    if (c.wasPlanet || c.wasRuins) text = "REALM SHIFT";
                    
                    setCutin({ text, color: REALMS[dr].bright });
                    setTimeout(() => setCutin(null), 1500);
                } else {
                    setShake(true); setTimeout(() => setShake(false), 300);
                }
            }
            prevFieldCardId.current = gs.fieldCard.id;
        } else if (gs && gs.fieldCard && !visualFieldCard) {
            setVisualFieldCard(gs.fieldCard);
        }
        if (gs && gs.status === 'playing') {
            const prevPlayers = prevPlayersRef.current;
            if (prevPlayers.length > 0) {
                gs.players.forEach(p => {
                    const oldP = prevPlayers.find(x => x.id === p.id);
                    if (oldP && !oldP.isEliminated && p.isEliminated) { 
                        playSE('burst', muted); 
                        setVfxOverlay({ type: 'burst', color: '#EF4444' }); 
                        setTimeout(() => setVfxOverlay(null), 1000); 
                    }
                    else if (oldP && !oldP.finishBonus && p.finishBonus) { 
                        playSE('wild', muted); 
                        setVfxOverlay({ type: 'wild', color: '#FFD700' }); 
                        setTimeout(() => setVfxOverlay(null), 1000); 
                    }
                });
            }
            prevPlayersRef.current = gs.players;
        }
    }, [gs]);

    useEffect(() => { if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight; }, [gs?.logs]);
    useEffect(() => { setSelectedCardId(null); }, [gs?.currentTurnPlayerId]);
    
    // リザルト画面表示時に勝利音を鳴らす
    useEffect(() => {
        if (gs?.status === 'finished') {
            playSE('victory', muted);
        }
    }, [gs?.status, muted]);

    const currentR = gs?.fieldCard?.realm || 'GEAR';
    const me = gs?.players?.find(p => p.id === socket?.id);
    const isMyTurn = gs?.currentTurnPlayerId === socket?.id && !me?.isEliminated;
    
    // 新しく追加されたカードを検出してアニメーションを適用
    const prevHandRef = useRef([]);
    useEffect(() => {
        if (me?.hand) {
            const prevIds = new Set(prevHandRef.current.map(c => c.id));
            const newIds = me.hand.filter(c => !prevIds.has(c.id)).map(c => c.id);
            if (newIds.length > 0) {
                setNewlyDrawnCardIds(new Set(newIds));
                setTimeout(() => {
                    setNewlyDrawnCardIds(new Set());
                }, 500);
            }
            prevHandRef.current = me.hand;
        }
    }, [me?.hand]);

    // ゲーム終了時やターン変更時にWILD選択画面をクリア
    useEffect(() => {
        if (gs?.status === 'finished' || !isMyTurn) {
            setSelector(null);
        }
    }, [gs?.status, isMyTurn]);

    const sortedHand = useMemo(() => {
        if (!me?.hand) return [];
        return [...me.hand].sort((a, b) => (SORT_WEIGHT[a.realm] - SORT_WEIGHT[b.realm]) || (b.isSpecial - a.isSpecial));
    }, [me?.hand]);

    const playableRealms = useMemo(() => {
        if (!gs?.fieldCard) return [];
        const checkSim = (r) => {
            const h = r; const f = gs.fieldCard.realm;
            if (h === 'PLANET' || h === 'RUINS' || f === 'PLANET' || f === 'RUINS') return true;
            if (h === 'FOUNTAIN' && gs.fieldCard.isSpecial) return (f === 'ICEAGE' || f === 'FOUNTAIN');
            if (['ICEAGE', 'BATTERY', 'ARCHIVE'].includes(f) && f === h) return false;
            return f === h || (NEXT_MAP[f] && NEXT_MAP[f].includes(h));
        };
        return Object.keys(REALMS).filter(r => checkSim(r));
    }, [gs?.fieldCard]);

    const sortedResultPlayers = useMemo(() => {
        if (!gs?.players) return [];
        return [...gs.players].sort((a, b) => {
            if (a.isEliminated && !b.isEliminated) return 1;
            if (!a.isEliminated && b.isEliminated) return -1;
            return a.handCount - b.handCount;
        });
    }, [gs?.players]);

    const join = () => { if (room && name) { playSE('start', muted); setJoined(true); socket.emit('join-room', { roomId: room.toUpperCase(), playerName: name }); } };
    const leave = () => { if (room) { playSE('cancel', muted); socket.emit('leave-room', { roomId: room.toUpperCase() }); setJoined(false); setGs(null); } };
    const goToTopPage = () => { playSE('cancel', muted); if (room) socket.emit('leave-room', { roomId: room.toUpperCase() }); window.location.reload(); };

    const handleCardClick = (c, isPlayable) => {
        if (!isMyTurn || !isPlayable || selector) return;
        if (isAnimating || isMorphing) {
            setBufferedAction({ type: 'play', card: c, isPlayable: isPlayable });
            return;
        }
        playSE('play', muted);
        if (window.navigator.vibrate) window.navigator.vibrate(12);
        const isLastCard = me?.hand?.length === 1;
        const needsSelector = c.realm === 'PLANET' || c.realm === 'RUINS' || (c.realm === 'FOUNTAIN' && c.isSpecial);
        // 最後のカードの場合は自動的にGEARを選択して送信（上がり時は選択画面を出さない）
        if (isLastCard && needsSelector) { 
            socket.emit('play-card', { roomId: room, card: c, chosenRealm: 'GEAR' }); 
            return; 
        }
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (!isMobile) { 
            if (needsSelector) setSelector(c); 
            else socket.emit('play-card', { roomId: room, card: c }); 
        } else { 
            if (selectedCardId === c.id) { 
                if (needsSelector) setSelector(c); 
                else socket.emit('play-card', { roomId: room, card: c }); 
            } else { 
                setSelectedCardId(c.id); 
            } 
        }
    };

    const handleTouchStart = (e, card, isPlayable) => {
        if (!isMyTurn || !isPlayable || isAnimating || isMorphing || selector) return;
        setDraggingCardId(card.id);
        setTouchStartX(e.touches[0].clientX);
        setTouchStartY(e.touches[0].clientY);
        setDragOffsetX(0);
        setDragOffsetY(0);
    };

    const handleTouchMove = (e) => {
        if (!draggingCardId) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - touchStartX;
        const deltaY = currentY - touchStartY;
        
        // 2次元的に追従
        setDragOffsetX(deltaX);
        setDragOffsetY(deltaY);
    };

    const handleTouchEnd = (card, isPlayable) => {
        if (!draggingCardId) return;
        
        // 一定以上（80px）スワイプしていたらプレイ
        // 左右に振れすぎていないかもチェック（誤操作防止）
        if (dragOffsetY < -80 && Math.abs(dragOffsetX) < 150) {
            if (isAnimating || isMorphing) {
                setBufferedAction({ type: 'play', card: card, isPlayable: isPlayable });
            } else {
                playSE('play', muted);
                if (window.navigator.vibrate) window.navigator.vibrate(12);
                const needsSelector = card.realm === 'PLANET' || card.realm === 'RUINS' || (card.realm === 'FOUNTAIN' && card.isSpecial);
                if (needsSelector) {
                    setSelector(card);
                } else {
                    socket.emit('play-card', { roomId: room, card: card });
                }
            }
        }
        
        setDraggingCardId(null);
        setDragOffsetX(0);
        setDragOffsetY(0);
    };

    const canPlayCheck = (room, card) => {
        if (!room || !card || !room.fieldCard) return false;
        if (room.nextDrawAmount > 1) return (card.realm === 'GEAR' && card.isSpecial);
        const field = room.fieldCard.realm; const h = card.realm;
        if (h === 'PLANET' || h === 'RUINS' || field === 'PLANET' || field === 'RUINS') return true;
        if (h === 'FOUNTAIN' && card.isSpecial) return (field === 'ICEAGE' || field === 'FOUNTAIN');
        if (['ICEAGE', 'BATTERY', 'ARCHIVE'].includes(field) && field === h) return false;
        return field === h || (NEXT_MAP[field] && NEXT_MAP[field].includes(h));
    };

    return (
        <>
            {/* モーションレイヤーを画面揺れの影響を受けないように外側に配置 */}
            <div className="motion-overlay-layer" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10000 }}>
                {motions.map(m => (
                    <div key={m.mid} className={`motion-card-ghost ${m.type} ${getPlayerPosClass(m.playerId)}`}>
                        <div className="ghost-surface" />
                    </div>
                ))}
            </div>
            
            <div ref={wrapperRef} className={`screen-wrapper ${shake ? 'shake-active' : ''} ${isMyTurn ? 'my-turn-glow' : ''} ${bgAnim ? 'all-anim-active' : 'all-anim-off'}`} style={{ '--r-color': REALMS[currentR]?.color }}>
            {cutin && (
                <div className="special-cutin-layer">
                    <div className="special-cutin-bar" style={{ '--c': cutin.color }}>
                        <div className="special-cutin-text">{cutin.text}</div>
                    </div>
                </div>
            )}
            <AstralBackground bgAnim={bgAnim} />
            
            {isDisconnected && joined && (
                <div className="fixed inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center p-8 ">
                    <h3 className="font-black text-danger text-3xl tracking-widest mb-4 animate-pulse font-['Orbitron']">CONNECTION LOST</h3>
                    <p className="text-white/80 text-sm text-center mb-8 font-bold leading-relaxed">サーバーとの通信が切断されたため<br />部屋が消滅しました。</p>
                    <button className="w-full max-w-xs p-5 font-black bg-gradient-to-r from-red-600 to-red-900 text-white rounded-sm shadow-2xl tracking-[4px]" onClick={() => window.location.reload()}>タイトルへ戻る</button>
                </div>
            )}
            <div className="ui-viewport" style={{ transform: selector ? 'translateY(-250px)' : 'translateY(0)', transition: 'transform 0.35s cubic-bezier(0.19, 1, 0.22, 1)' }}>
                {!gs || gs.status !== 'playing' ? (
                    <div className="absolute top-3 right-3 z-[950] flex gap-2">
                        <div className="w-10 h-10 rounded-full border-2 border-accent flex items-center justify-center text-accent bg-black/80  cursor-pointer shadow-[0_0_10px_rgba(64,224,208,0.3)] transition-all" onClick={() => setMuted(!muted)}>{muted ? '🔇' : '🔊'}</div>
                    </div>
                ) : null}
                {!joined ? (
                    <div className="h-full flex flex-col no-scrollbar">
                        <div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-8 overflow-y-auto no-scrollbar">
                            <div className="top-logo-area flex-shrink-0 scale-90 sm:scale-100 origin-center mb-2 sm:mb-4">
                                <div className="field-central-zone">
                                    <div className="emblem-bg-layer"><ComplexEmblem isLogo={true} /></div>
                                    <div className="logo-text-layer">
                                        <div className="main-logo-text text-[clamp(2.5rem,10vw,4rem)]">CROSS</div>
                                        <div className="main-logo-text text-[clamp(2rem,8vw,3.2rem)]" style={{ marginTop: '-0.5rem' }}>REALM</div>
                                        <div className="text-accent font-['Audiowide'] text-[0.7rem] sm:text-[0.85rem] mt-2 tracking-[4px] sm:tracking-[6px] animate-pulse">- OMEGA SINGULARITY -</div>
                                    </div>
                                </div>
                            </div>
                            <div className="trinity-flavor-box mb-4 sm:mb-8 flex-shrink-0">
                                <div className="flavor-line"><span className="f-steam">真鍮</span>の爆鳴、<span className="f-fantasy">星界</span>の共鳴、<span className="f-cyber">電脳</span>の火花。</div>
                                <div className="mt-2 text-white/70 font-black text-[0.8rem]">次元の境界は消失し、特異点へと収束する。</div>
                            </div>
                            <div className="w-full px-6 sm:px-8 flex flex-col gap-3 sm:gap-5 flex-shrink-0">
                                <div className="relative w-full flex flex-col">
                                    <div className="absolute left-0 top-0 w-1 h-full bg-accent shadow-[0_0_15px_var(--accent)] rounded-sm"></div>
                                    <label className="input-label-tech font-['Orbitron'] text-[10px] font-black text-accent tracking-[2px] mb-1 pl-4 uppercase">パイロット識別名</label>
                                    <input type="text" className="input-field-nova w-full p-3 sm:p-4 ml-2 bg-[#0a0f23]/95 border border-accent/30 text-white font-black text-lg sm:text-xl outline-none rounded" value={name} placeholder="名前を入力..." onChange={e => setName(e.target.value)} maxLength={10} />
                                </div>
                                <div className="relative w-full flex flex-col">
                                    <div className="absolute left-0 top-0 w-1 h-full bg-accent shadow-[0_0_15px_var(--accent)] rounded-sm"></div>
                                    <label className="input-label-tech font-['Orbitron'] text-[10px] font-black text-accent tracking-[2px] mb-1 pl-4 uppercase">セクターコード</label>
                                    <input type="text" className="input-field-nova w-full p-3 sm:p-4 ml-2 bg-[#0a0f23]/95 border border-accent/30 text-white font-black text-lg sm:text-xl outline-none rounded" value={room} placeholder="合言葉を入力..." onChange={e => setRoom(e.target.value.toUpperCase())} />
                                </div>
                                <button className={`w-full mt-1 p-4 text-lg font-black rounded-sm active:scale-95 transition-transform ${(!isConnected) ? 'bg-gray-600 opacity-50' : 'bg-gradient-to-r from-amber-400 to-amber-600 text-black'}`} onClick={join} disabled={!isConnected}>{(!isConnected) ? '接続中...' : 'リンク開始'}</button>
                            </div>
                        </div>
                        <div className="system-status-bar">
                            <span>STATUS: <span className={`status-tag ${(!isConnected) ? 'bg-red-600' : ''}`}>{(!isConnected) ? 'OFFLINE' : 'ONLINE'}</span></span>
                            <span>VER: <span className="text-white/80 font-black">133.0_R</span></span>
                        </div>
                    </div>
                ) : (joined && !gs) ? (
                    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mb-8 shadow-[0_0_20px_rgba(64,224,208,0.4)]"></div>
                        <h2 className="text-accent font-black tracking-[8px] animate-pulse font-['Orbitron']">ESTABLISHING LINK...</h2>
                    </div>
                ) : (gs?.status === 'waiting') ? (
                    <div className="h-full flex flex-col items-center justify-center p-4 text-center overflow-y-auto no-scrollbar">
                        <h2 className="text-[clamp(1.2rem,6.5vw,1.875rem)] font-black mb-6 tracking-[clamp(4px,2vw,10px)] font-['Orbitron'] text-white animate-pulse uppercase w-full text-center">同期待機中...</h2>
                        <div className="w-full overflow-y-auto max-h-[320px] p-1 mx-5 mb-3 shrink-0 no-scrollbar">
                            {[...Array(5)].map((_, i) => {
                                const p = gs?.players[i];
                                return (
                                    <div key={i} className={`bg-[#140a28]/85 border px-5 py-2.5 rounded-md mb-1.5 flex justify-between items-center min-h-[56px] shadow-md  ${p ? 'border-l-8 border-l-accent border-accent/80 bg-[#0a1e28]/85 shadow-sm' : 'border-white/30 opacity-20 border-dashed'}`}>
                                        <span className="font-black text-sm tracking-wide uppercase">{p ? p.name : '--- 空きスロット ---'}</span>
                                        {p && i === 0 && <span className="bg-white text-black text-[10px] px-3 py-1 font-black rounded shadow-lg">マスター</span>}
                                        {p && p.isBot && (gs?.players[0]?.id === socket?.id || gs?.players[0]?.name === name) && <button className="text-[10px] font-black text-red-400 border border-red-400/40 px-2 py-0.5 rounded hover:bg-red-400/10 transition-all" onClick={() => socket.emit('remove-cpu', { roomId: room, botId: p.id })}>削除</button>}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="w-full mt-2 px-4 flex flex-col items-center">
                            {(gs?.players[0]?.id === socket?.id || gs?.players[0]?.name === name) && (
                                <>
                                    <div className="flex gap-3 w-full mb-3">
                                        <button className="flex-1 py-4 bg-black/80 border border-white/40 text-white font-black text-[12px] tracking-[2px] uppercase rounded-sm hover:bg-white/10 transition-all" disabled={gs?.players?.length >= 5} onClick={() => { playSE('play', muted); socket.emit('add-cpu', { roomId: room }); }}>🤖 CPU追加</button>
                                        <button className="flex-[2] py-4 bg-gradient-to-r from-amber-400 to-amber-600 text-black font-black text-base rounded-sm shadow-2xl active:scale-95 transition-all" disabled={gs?.players?.length < 2} onClick={() => { playSE('start', muted); socket.emit('start-game', { roomId: room }); }}>ミッション開始</button>
                                    </div>
                                    <p className="text-[10px] text-white/40 mb-3 font-bold">💡 CPUは中級レベルの強さで、ランダムに選ばれます</p>
                                </>
                            )}
                            <button className="mt-1 inline-block py-2.5 px-8 bg-black/90 border-2 border-accent text-white font-['Orbitron'] text-[11px] font-black tracking-[4px] rounded-full" onClick={leave}>同期を解除</button>
                        </div>
                    </div>
                ) : (gs.status === 'finished') ? (
                    <div className="result-screen">
                        <h2 className="result-title uppercase tracking-tighter" style={{ color: gs.isSeriesFinished ? '#FFD700' : 'var(--steam-gold)' }}>{gs.isSeriesFinished ? "シリーズ終了" : `第 ${gs.matchCount - 1} 戦 終了`}</h2>
                        {gs.isSeriesFinished && <div className="text-xl text-white font-black mb-6 text-center animate-pulse champion-fx py-4 px-8 rounded-full border border-[var(--steam-gold)]">総合優勝 (CHAMPION)<br /><span className="text-[clamp(1.5rem,6vw,2.25rem)] text-[var(--steam-gold)] drop-shadow-[0_0_10px_rgba(212,175,55,1)] mt-2 inline-block max-w-full truncate break-all px-2">👑 {[...gs.players].sort((a, b) => b.score - a.score)[0].name} 👑</span></div>}
                        <div className="flex flex-row items-end justify-center w-full max-w-[440px] h-[220px] gap-1 mt-4 mb-8 px-2">
                            {(gs.isSeriesFinished ? [...gs.players].sort((a, b) => b.score - a.score) : sortedResultPlayers).map((p, i) => {
                                const order = i === 0 ? 3 : i === 1 ? 2 : i === 2 ? 4 : i === 3 ? 1 : 5;
                                const height = i === 0 ? '120px' : i === 1 ? '90px' : i === 2 ? '70px' : i === 3 ? '50px' : '40px';
                                const color = i === 0 ? 'var(--steam-gold)' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--accent)';
                                return (
                                    <div key={p.id} className="flex flex-col items-center justify-end w-[20%] relative" style={{ order }}>
                                        {p.ready && <div className="absolute top-[-50px] text-[10px] text-accent font-black bg-black/90 px-2 py-0.5 rounded-full border border-accent animate-pulse z-30">READY</div>}
                                        {p.isEliminated && !gs.isSeriesFinished && <div className="absolute top-[-25px] text-[8px] text-red-500 font-bold bg-black/90 px-1 rounded border border-red-500/50 z-10">臨界突破</div>}
                                        <div className="text-[9px] md:text-[10px] font-bold truncate w-full min-w-0 px-1 text-center mb-1" style={{ color: (p.isEliminated && !gs.isSeriesFinished) ? 'gray' : 'white', textDecoration: (p.isEliminated && !gs.isSeriesFinished) ? 'line-through' : 'none' }}>{p.name}</div>
                                        {!gs.isSeriesFinished && <div className="text-[11px] md:text-[13px] font-black mb-1 font-['Orbitron']">{p.handCount}枚</div>}
                                        <div className="text-[12px] md:text-[14px] font-black text-[var(--steam-gold)] mb-2 font-['Orbitron']">★ {p.score}</div>

                                        {/* 点数計算結果の表示 - 重なりを防ぐため高さを調整 */}
                                        {p.finishBonus && !gs.isSeriesFinished && (
                                            <div className="absolute top-[-90px] text-[10px] text-[#ff88ff] font-black animate-pulse drop-shadow-[0_0_5px_rgba(255,0,255,0.8)] whitespace-nowrap z-20">
                                                ワイルドボーナス x1.5!
                                            </div>
                                        )}
                                        {p.earnedPoints > 0 && !gs.isSeriesFinished && (
                                            <div className="absolute top-[-75px] text-green-400 font-black animate-bounce z-20">
                                                +{p.finishBonus ? (
                                                    <>
                                                        {p.basePoints}
                                                        <span className="text-[#ff88ff] ml-1">+{p.bonusPoints}</span>
                                                    </>
                                                ) : p.earnedPoints}
                                            </div>
                                        )}
                                        {p.isEliminated && !gs.isSeriesFinished && (
                                            <div className="absolute top-[-75px] text-red-500 font-black animate-pulse z-20">-10</div>
                                        )}

                                        <div className="w-full flex items-start justify-center pt-2 rounded-t-md border-t-[3px] border-x border-white/10" style={{ height, background: `linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)`, borderTopColor: color }}><span className="font-['Orbitron'] font-black text-xl md:text-2xl mt-1 drop-shadow-md" style={{ color }}>{i + 1}</span></div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="w-full max-w-xs flex flex-col gap-3">
                            <button className={`w-full py-5 text-xl font-black rounded-sm shadow-2xl uppercase tracking-[2px] transition-all ${me?.ready ? 'bg-gray-600 text-white/50' : 'bg-gradient-to-r from-amber-400 to-amber-600 text-black'}`} onClick={() => { if (me?.ready) return; playSE('start', muted); socket.emit('play-again', { roomId: room }); }}>{me?.ready ? "待機中..." : (gs.isSeriesFinished ? "新しいシリーズを開始" : "次のマッチへ")}</button>
                            <button className="w-full py-3 text-xs font-black bg-black/50 border border-white/10 text-white/50 rounded-sm uppercase tracking-[2px] mt-2" onClick={goToTopPage}>タイトル画面へ戻る</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center px-4 py-2 bg-[#05010a]/90 border-b border-accent/20 shrink-0 z-50">
                            <div className="text-[11px] font-black text-accent font-['Orbitron'] tracking-[2px] sm:tracking-[4px] truncate flex-1">セクター: {room} <span className="ml-2 text-white/80">| 第{gs.matchCount}/{gs.maxMatches}戦</span> <span className="ml-2 text-[var(--steam-gold)]">★ {me?.score || 0} pts</span></div>
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ml-2 hover:bg-accent/10 ${bgAnim ? 'border-accent text-accent bg-black/80 shadow-[0_0_10px_rgba(64,224,208,0.4)]' : 'border-gray-500 text-gray-500 bg-black/60'}`} onClick={() => { playSE(bgAnim ? 'cancel' : 'start', muted); setBgAnim(!bgAnim); }} title={bgAnim ? "アニメーションOFF（軽量化）" : "アニメーションON"}>🎬</div>
                            <div className="w-8 h-8 rounded-full border-2 border-accent flex items-center justify-center text-accent bg-black/80  cursor-pointer shadow-[0_0_10px_rgba(64,224,208,0.4)] transition-all ml-2 hover:bg-accent/10" onClick={() => setMuted(!muted)} title={muted ? "音声ON" : "音声OFF"}>{muted ? '🔇' : '🔊'}</div>
                        </div>
                        <div className={`turn-status-banner ${isMyTurn ? 'my-turn' : ''}`}>
                            <div className="banner-content">
                                <span className={`banner-direction ${gs.isReversed ? 'text-danger' : 'text-accent'}`}>{gs.isReversed ? '↺' : '↻'}</span>
                                <div className="banner-divider"></div>
                                <span className="banner-text">
                                    {isMyTurn ? 'YOUR TURN' : `${gs.players[gs.turnIndex]?.name}'S TURN`}
                                </span>
                                <div className="banner-divider"></div>
                                <div className="banner-badges">
                                    {Object.keys(REALMS).filter(r => r !== 'PLANET' && r !== 'RUINS').map(r => (
                                        <div key={r} className={`realm-badge ${playableRealms.includes(r) ? 'active' : ''} ${gs.currentRealm === r ? 'current' : ''}`} style={{ '--r-color': REALMS[r].color }}><IconRenderer r={r} spec={false} /></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {isMyTurn && gs.matchCount === 1 && me?.hand?.length === 5 && (
                            <div className="w-full bg-accent/10 border-y border-accent/30 px-4 py-2 text-center shrink-0">
                                <p className="text-[11px] font-black text-accent animate-pulse">💡 光っている場のカードが出せます！</p>
                            </div>
                        )}
                        <div className="grid grid-cols-4 gap-1 p-1 bg-[#0a0f23]/90 border-b-2 border-white/15 shrink-0 ">
                            {otherPlayersInCircle.map((p, i) => {
                                if (!p) return <div key={i} className="h-16 opacity-0" />;
                                return (
                                    <div key={p.id} className={`bg-white/5 border border-white/15 rounded-md p-1.5 relative h-16 flex flex-col justify-start overflow-hidden ${gs.currentTurnPlayerId === p.id ? 'current-turn-glow-active' : ''} ${p.isEliminated ? 'grayscale brightness-50 border-danger' : ''} ${(p.handCount >= 10 && !p.isEliminated) ? 'burst-warning' : ''}`}>
                                        <div className="font-black uppercase text-white/60 tracking-tight leading-none w-full pr-6" style={{ fontSize: p.name.length > 12 ? '6px' : p.name.length > 9 ? '7px' : p.name.length > 6 ? '8px' : '9px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.name}</div>
                                        <div className="absolute top-1 right-1 text-[9px] font-black text-[var(--steam-gold)]">★{p.score}</div>
                                        <div className="absolute bottom-2 left-8 text-xl font-black text-white font-['Orbitron'] leading-none z-10">{p.handCount}<span className="text-[10px] ml-0.5">枚</span></div>
                                        {getTurnDistance(p.id) !== null && !p.isEliminated && getTurnDistance(p.id) > 0 && <div className="absolute bottom-1 right-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-black/60 border border-white/20 text-accent flex items-center gap-0.5 shadow-lg z-10">T-{getTurnDistance(p.id)}</div>}
                                        <div className="absolute bottom-2 left-1 w-[14px] h-[20px] z-0 opacity-50">{[...Array(Math.min(p.handCount, 3))].map((_, i) => <div key={i} className="absolute w-full h-full bg-[#111] border border-white/80 rounded-[1px]" style={{ transform: `translate(${i * 2}px, ${i * 2}px)`, zIndex: i, borderColor: gs.currentTurnPlayerId === p.id ? 'var(--accent)' : 'rgba(255,255,255,0.4)' }} />)}</div>
                                        {p.isEliminated && <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center text-[10px] font-black text-danger tracking-[1px] -rotate-3 z-20">BURST</div>}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="field-main-area">
                            <div className="tactical-field-viewport">
                                <CycleDiagramSmall currentRealm={gs.currentRealm} playableRealms={playableRealms} hoveredCard={null} bgAnim={bgAnim} isReversed={gs.isReversed} />
                                <div className="central-cards-overlay">
                                    <div className="flex items-center justify-center gap-4 sm:gap-6">
                                        <div className="relative w-14 h-20 sm:w-16 sm:h-24 opacity-90 transition-all cursor-help group">
                                            <div className="absolute inset-0 bg-[#111] border border-white/40 rounded-sm shadow-md">
                                                <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-black">
                                                    <div className="w-full h-full opacity-30 text-accent"><IconRenderer r="BACK" /></div>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                        <div className="text-xl font-black text-white font-['Orbitron']">{gs.deck?.length || 0}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`field-card-scale relative z-10 ${entryAnim ? 'card-play-vfx' : ''}`}>
                                            <div className={`transition-opacity duration-[1500ms] ease-in-out ${(!isAnimating && gs.fieldCard.id === displayFieldCard?.id) ? 'opacity-100' : 'opacity-0'}`}>
                                                <CardView card={gs.fieldCard} isField={true} isMyTurn={isMyTurn} hideOrnaments={isAnimating} />
                                            </div>
                                            <div className={`absolute inset-0 transition-opacity duration-[1500ms] ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
                                                <CardView card={displayFieldCard} isField={true} isMyTurn={isMyTurn} hideOrnaments={true} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="tactical-log-box no-scrollbar" ref={logContainerRef}>{gs.logs && gs.logs.length > 0 ? gs.logs.slice(-10).map(l => <div key={l.id} className="log-entry-text text-[11px] font-black mb-0.5 border-b border-white/5">≫ {l.text}</div>) : <div className="opacity-40 italic text-xs font-bold mt-1">ANALYZING...</div>}</div>
                        <div className="flex justify-between items-center px-5 py-1 shrink-0"><div className="flex items-baseline gap-2"><span className="hand-info-label text-[10px] font-black text-white/40 tracking-[2px] uppercase">Your Hand</span><span className={`hand-info-count text-2xl font-black font-['Orbitron'] leading-none ${me?.hand.length >= 8 ? 'text-danger animate-pulse' : 'text-white'}`}>{me?.hand.length || 0}<span className="text-xs ml-1 opacity-60">枚</span></span></div>{(isAnimating || isMorphing) && <div className="text-[9px] font-black text-accent animate-pulse tracking-[2px] bg-accent/10 px-3 py-1 rounded border border-accent/30 uppercase">Processing...</div>}</div>
                        <div className={`hand-container no-scrollbar ${isMyTurn ? 'my-turn-hand-fx' : ''} ${(isAnimating || isMorphing || selector) ? 'opacity-40 grayscale-[50%] pointer-events-none' : ''}`}>
                            {sortedHand.map((card, idx) => {
                                const handSize = me.hand.length;
                                const baseMargin = -8;
                                // 5枚以上から徐々に重なりを強くする
                                const dynamicMargin = handSize > 5 ? Math.max(-48, baseMargin - (handSize - 5) * 10) : baseMargin;
                                // 8枚以上でカードを少し小さくして収まりを良くする
                                const cardScale = handSize > 8 ? 0.88 : 1.0;
                                const isPlayable = isMyTurn && canPlayCheck(gs, card);
                                const isNewlyDrawn = newlyDrawnCardIds.has(card.id);
                                return (
                                    <div
                                        key={card.id || idx}
                                        className={`card-anchor ${selectedCardId === card.id ? 'selected' : ''} ${hoveredCardId === card.id ? 'hovered' : ''} ${!isMyTurn || !isPlayable ? 'not-playable' : 'playable'} ${isMyTurn ? 'is-my-turn' : ''} ${draggingCardId === card.id ? 'dragging' : ''} ${isNewlyDrawn ? 'card-draw-vfx' : ''}`}
                                        style={{ 
                                            zIndex: (draggingCardId === card.id) ? 1000 : (selectedCardId === card.id ? 100 : (hoveredCardId === card.id ? 200 : idx)), 
                                            marginRight: idx === me.hand.length - 1 ? '0' : `${dynamicMargin}px`,
                                            // ドロー中はCSSアニメーション優先のためインラインtransformを無効化
                                            transform: isNewlyDrawn ? undefined : (
                                                (draggingCardId === card.id) 
                                                    ? `translate(${dragOffsetX}px, ${dragOffsetY}px) rotate(${dragOffsetX * 0.05}deg) scale(1.1)` 
                                                    : `scale(${cardScale})`
                                            ),
                                            transition: (draggingCardId === card.id) ? 'none' : undefined,
                                            touchAction: (draggingCardId === card.id) ? 'none' : 'pan-x',
                                            filter: (draggingCardId === card.id) ? 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))' : undefined
                                        }}
                                        onClick={() => handleCardClick(card, isPlayable)}
                                        onMouseEnter={() => setHoveredCardId(card.id)}
                                        onMouseLeave={() => setHoveredCardId(null)}
                                        onTouchStart={(e) => handleTouchStart(e, card, isPlayable)}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={() => handleTouchEnd(card, isPlayable)}
                                    >
                                        <CardView card={card} playable={isPlayable} isSelected={selectedCardId === card.id} isMyTurn={isMyTurn} />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="w-full px-4 pb-4 shrink-0 flex flex-col gap-2"><button className="btn-mega-draw w-full h-16 bg-gradient-to-br from-[#FFD700] to-[#B8860B] text-black font-black text-2xl tracking-[8px] cursor-pointer transition-all active:scale-95 disabled:grayscale disabled:opacity-50" disabled={!isMyTurn || selector || isAnimating || isMorphing} onClick={() => { if (isAnimating || isMorphing) { setBufferedAction({ type: 'draw' }); return; } playSE('draw', muted); socket.emit('draw-card', { roomId: room }); }}>ドロー ({gs.nextDrawAmount}枚)</button></div>
                    </>
                )}
            </div>
            {selector && (
                <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: wrapperRef.current?.offsetWidth || '100%', maxWidth: wrapperRef.current?.offsetWidth || 480, zIndex: 9999, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div className="wild-choice-panel" style={{ pointerEvents: 'auto' }}>
                        <h3 className="font-black mb-3 text-[9px] tracking-[2px] text-accent/80 uppercase text-center">次次元を選択してください</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {['GEAR', 'ICEAGE', 'FOUNTAIN', 'BATTERY', 'MACHINE', 'ARCHIVE'].map(r => (
                                <button key={r} className="p-2 border border-white/20 font-black text-sm hover:bg-white/10 hover:border-accent transition-all active:scale-95 flex flex-col items-center gap-1.5 bg-black/40 rounded-md" style={{ color: REALMS[r].bright }} onClick={() => { playSE('play', muted); socket.emit('play-card', { roomId: room, card: selector, chosenRealm: r }); setSelector(null); }}>
                                    <div className="w-8 h-8 drop-shadow-[0_0_10px_currentColor]"><IconRenderer r={r} spec={false} /></div>
                                    <div className="tracking-[1px] text-[10px]">{REALMS[r].n}</div>
                                </button>
                            ))}
                        </div>
                        <button className="w-full mt-4 p-5 text-white/70 text-[14px] tracking-[4px] font-black border-2 border-white/30 uppercase hover:bg-white/10 hover:border-white/50 rounded transition-all active:scale-95" onClick={() => { playSE('cancel', muted); setSelector(null); }}>✕ 選択をキャンセル</button>
                    </div>
                </div>
            )}
        </div>
        </>
    );
};

export default App;