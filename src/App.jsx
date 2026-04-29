import React, { useState, useEffect, useMemo, useRef } from 'react';
import io from 'socket.io-client';
import './index.css';

// const socket = io('https://crossrealm-server.onrender.com');
// const socket = io('https://crossrealm-server.onrender.com');
const socket = io(
    (window.location.port !== '3000' && window.location.hostname !== 'cross-realm.onrender.com')
        ? `http://${window.location.hostname}:3000`
        : undefined
);


const REALMS = {
    GEAR: { n: '歯車', color: '#FF8C00', bright: '#FFD700', glow: 'rgba(255,140,0,1)', theme: 'steam', font: 'Special Elite' },
    ARCHIVE: { n: '古文書', color: '#FF3131', bright: '#FF6347', glow: 'rgba(255,49,49,1)', theme: 'steam', font: 'Special Elite' },
    FOUNTAIN: { n: '噴水', color: '#1E90FF', bright: '#87CEFA', glow: 'rgba(30,144,255,1)', theme: 'fantasy', font: 'Cinzel Decorative' },
    ICEAGE: { n: '氷河期', color: '#00F3FF', bright: '#ADFCFF', glow: 'rgba(0,243,255,1)', theme: 'fantasy', font: 'Cinzel Decorative' },
    MACHINE: { n: '機械', color: '#E2B0FF', bright: '#DDA0DD', glow: 'rgba(226,176,255,1)', dim: 'rgba(226,176,255,0.4)', theme: 'cyber', font: 'Orbitron' },
    BATTERY: { n: '電池', color: '#ADFF2F', bright: '#7FFF00', glow: 'rgba(173,255,47,1)', dim: 'rgba(173,255,47,0.4)', theme: 'cyber', font: 'Orbitron' },
    PLANET: { n: '惑星', color: '#FFFFFF', bright: '#F0F8FF', glow: 'rgba(255,255,255,1)', theme: 'void-planet', font: 'Audiowide' },
    RUINS: { n: '廃墟', color: '#CCCCCC', bright: '#D3D3D3', glow: 'rgba(204,204,204,1)', theme: 'void-ruins', font: 'Audiowide' }
};

const NEXT_MAP = { GEAR: ['GEAR', 'ICEAGE'], ICEAGE: ['FOUNTAIN', 'BATTERY'], FOUNTAIN: ['FOUNTAIN', 'BATTERY'], BATTERY: ['MACHINE', 'ARCHIVE'], MACHINE: ['MACHINE', 'ARCHIVE'], ARCHIVE: ['GEAR', 'ICEAGE'] };
const SORT_WEIGHT = { GEAR: 1, ICEAGE: 2, FOUNTAIN: 3, BATTERY: 4, MACHINE: 5, ARCHIVE: 6, PLANET: 7, RUINS: 8 };

// === SE再生機能 ===
let audioCtx = null;
const playSE = (type, muted) => {
    if (muted) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
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
        }
    } catch (e) { }
};

// === 究極のエンブレム ===
const ComplexEmblem = ({ isLogo = false }) => (
    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <defs>
            <filter id="emblem-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
            <filter id="core-glow"><feGaussianBlur stdDeviation="6" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
        </defs>
        <g filter="url(#emblem-glow)">
            <circle cx="50" cy="50" r="48" fill="none" stroke="var(--accent)" strokeWidth="0.8" strokeDasharray="4 8 12 4" opacity="0.6" style={{ animation: 'rotate-outer 20s linear infinite', transformOrigin: 'center' }} />
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="0.3" strokeDasharray="2 2" opacity="0.4" style={{ animation: 'rotate-inner 15s linear infinite', transformOrigin: 'center' }} />
            <circle cx="50" cy="50" r="38" fill="none" stroke="var(--magic-purple)" strokeWidth="1" strokeDasharray="1 4" opacity="0.8" style={{ animation: 'rotate-inner 30s linear infinite', transformOrigin: 'center' }} />
            {isLogo && (
                <g style={{ animation: 'rotate-outer 40s linear infinite', transformOrigin: 'center' }}>
                    <polygon points="50,12 55,32 75,32 60,45 65,65 50,53 35,65 40,45 25,32 45,32" fill="none" stroke="var(--magic-purple)" strokeWidth="0.5" opacity="0.6" />
                </g>
            )}
            <path d="M50 16 L79.4 33 L79.4 67 L50 84 L20.6 67 L20.6 33 Z" fill="none" stroke="var(--steam-gold)" strokeWidth="1.5" opacity="0.5" style={{ animation: 'rotate-inner 45s linear infinite', transformOrigin: 'center' }} />
            <path d="M50 20 L76 35 L76 65 L50 80 L24 65 L24 35 Z" fill="none" stroke="var(--steam-gold)" strokeWidth="0.5" opacity="0.3" style={{ animation: 'rotate-outer 55s linear infinite', transformOrigin: 'center' }} />
            {isLogo && <g style={{ animation: 'rotate-inner 45s linear infinite', transformOrigin: 'center' }}>{[...Array(6)].map((_, i) => <circle key={i} cx="50" cy="16" r="1.5" fill="var(--steam-gold)" opacity="0.9" transform={`rotate(${i * 60} 50 50)`} />)}</g>}
            <circle cx="50" cy="50" r="12" fill="var(--danger)" opacity="0.3" filter="url(#core-glow)" style={{ animation: 'pulse-shimmer 3s infinite' }} />
            <path d="M36 36 L64 64 M64 36 L36 64" stroke="#fff" strokeWidth="4" strokeLinecap="square" opacity="0.9" />
            <path d="M30 30 L70 70 M70 30 L30 70" stroke="var(--accent)" strokeWidth="1" strokeLinecap="square" opacity="0.5" />
            <text x="50" y="54" fill="var(--accent)" fontSize="10" fontWeight="1000" font-family="Orbitron" textAnchor="middle" style={{ animation: 'pulse-shimmer 2s infinite' }}>X</text>
        </g>
    </svg>
);

const CycleDiagramSmall = ({ currentRealm, playableRealms = [], hoveredCard, bgAnim, isReversed }) => {
    const items = [
        { k: 'GEAR', n: '歯車' }, { k: 'ICEAGE', n: '氷河期' }, { k: 'FOUNTAIN', n: '噴水' },
        { k: 'BATTERY', n: '電池' }, { k: 'MACHINE', n: '機械' }, { k: 'ARCHIVE', n: '古文書' }
    ];

    const rx = 130;
    const ry = 90;

    const renderNodeShape = (k, isCurrent, isPlayable, isHoveredNode) => {
        const baseSize = isCurrent ? 16 : 13;
        const color = isCurrent ? REALMS[k].color : "rgba(5, 1, 10, 0.95)";
        const stroke = isCurrent ? "#fff" : (isPlayable || isHoveredNode ? REALMS[k].bright : REALMS[k].color);

        let theme = 'steam';
        if (k === 'FOUNTAIN' || k === 'ICEAGE') theme = 'fantasy';
        if (k === 'MACHINE' || k === 'BATTERY') theme = 'cyber';

        const isDimmed = !isCurrent && !isPlayable && !isHoveredNode;
        const opacity = isCurrent ? 1 : (isPlayable || isHoveredNode ? 0.95 : 0.3);

        const props = {
            fill: color,
            stroke: stroke,
            strokeWidth: isCurrent ? 2 : (isPlayable || isHoveredNode ? 1.5 : 1),
            filter: isCurrent ? "url(#node-glow)" : ((isPlayable || isHoveredNode) ? `drop-shadow(0 0 8px ${REALMS[k].color})` : "none"),
        };

        return (
            <g opacity={opacity} className="transition-all duration-500 ease-out">
                {theme === 'steam' && (
                    <g opacity={isDimmed ? "0.2" : "0.6"}>
                        {[0, 60, 120, 180, 240, 300].map(deg => (
                            <circle key={deg} cx={(baseSize + 1.5) * Math.cos(deg * Math.PI / 180)} cy={(baseSize + 1.5) * Math.sin(deg * Math.PI / 180)} r="0.8" fill={stroke} />
                        ))}
                    </g>
                )}
                {theme === 'cyber' && (
                    <g opacity={isDimmed ? "0.2" : "0.9"}>
                        <path d={`M -${baseSize + 4} -${baseSize + 1} L -${baseSize + 4} -${baseSize + 4} L -${baseSize + 1} -${baseSize + 4} M ${baseSize + 1} -${baseSize + 4} L ${baseSize + 4} -${baseSize + 4} L ${baseSize + 4} -${baseSize + 1} M ${baseSize + 4} ${baseSize + 1} L ${baseSize + 4} ${baseSize + 4} L ${baseSize + 1} ${baseSize + 4} M -${baseSize + 1} ${baseSize + 4} L -${baseSize + 4} ${baseSize + 4} L -${baseSize + 4} ${baseSize + 1}`} fill="none" stroke={stroke} strokeWidth="1" />
                    </g>
                )}
                <g opacity="0.8">
                    {(k === 'GEAR' || k === 'ARCHIVE') && <polygon points="0,-1.15 1,-0.57 1,0.57 0,1.15 -1,0.57 -1,-0.57" transform={`scale(${baseSize})`} {...props} />}
                    {(k === 'ICEAGE' || k === 'FOUNTAIN') && <circle r={baseSize * 1.15} {...props} />}
                    {(k === 'BATTERY' || k === 'MACHINE') && <polygon points="-0.7,-1.05 0.7,-1.05 1.05,-0.7 1.05,0.7 0.7,1.05 -0.7,1.05 -1.05,0.7 -1.05,-0.7" transform={`scale(${baseSize})`} {...props} />}
                </g>
                <g transform="scale(0.65)" opacity={isDimmed ? "0.4" : "1"} style={{ color: isCurrent ? '#000' : '#fff' }}>
                    <IconRenderer r={k} spec={false} x="-12" y="-15" width="24" height="24" />
                </g>
            </g>
        );
    };

    return (
        <div className="tactical-cycle-wheel">
            <svg viewBox="0 0 320 240" className="w-full h-full overflow-visible">
                <defs>
                    <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <marker id="arrowhead-master" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M0,0 L0,8 L8,4 z" fill="rgba(255,255,255,0.5)" />
                    </marker>
                </defs>
                {items.map((item, i) => {
                    const angle = (i * 60 - 90) * (Math.PI / 180);
                    const x = 160 + rx * Math.cos(angle);
                    const y = 120 + ry * Math.sin(angle);
                    const isCurrent = item.k === currentRealm;
                    const isPlayable = playableRealms.includes(item.k);
                    let isHoveredNode = false;
                    if (hoveredCard) {
                        const hr = hoveredCard.realm;
                        if (hr === 'PLANET' || hr === 'RUINS') isHoveredNode = playableRealms.includes(item.k);
                        else if (hr === 'FOUNTAIN' && hoveredCard.isSpecial) isHoveredNode = (item.k === 'ICEAGE' || item.k === 'FOUNTAIN');
                        else isHoveredNode = (hr === item.k);
                    }
                    const startA = (i * 60 - 90 + (isReversed ? 48 : 12)) * (Math.PI / 180);
                    const endA = (i * 60 - 90 + (isReversed ? 12 : 48)) * (Math.PI / 180);
                    return (
                        <g key={item.k}>
                            <path
                                d={`M ${160 + rx * Math.cos(startA)} ${120 + ry * Math.sin(startA)} A ${rx} ${ry} 0 0 ${isReversed ? 0 : 1} ${160 + rx * Math.cos(endA)} ${120 + ry * Math.sin(endA)}`}
                                fill="none"
                                stroke={isCurrent ? "rgba(255,255,255,0.6)" : (isHoveredNode ? "var(--accent)" : "rgba(255,255,255,0.15)")}
                                strokeWidth={isCurrent ? 1.5 : (isHoveredNode ? 1.2 : 0.8)}
                                markerEnd="url(#arrowhead-master)"
                                className="transition-all duration-500 ease-out"
                            />                            <g transform={`translate(${x}, ${y})`} className="transition-all duration-500 ease-out">
                                {renderNodeShape(item.k, isCurrent, isPlayable, isHoveredNode)}
                                <text
                                    className="transition-all duration-500 ease-out"
                                    y={isCurrent ? "32" : "28"}
                                    fill={isCurrent ? "#fff" : (isHoveredNode ? "var(--accent)" : (isPlayable ? "#fff" : "rgba(255,255,255,0.5)"))}
                                    fontSize={isCurrent ? "13" : "10"}
                                    fontWeight="1000"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontFamily="'Noto Sans JP', sans-serif"
                                    style={{ 
                                        textShadow: `0 0 6px rgba(0,0,0,1), 0 0 12px rgba(0,0,0,0.8)${isCurrent ? `, 0 0 10px ${REALMS[item.k].color}` : (isHoveredNode ? `, 0 0 8px var(--accent)` : '')}`,
                                        paintOrder: 'stroke fill',
                                        stroke: 'rgba(0,0,0,0.6)',
                                        strokeWidth: '3px'
                                    }}
                                >
                                    {item.n}
                                </text>
                            </g>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const IconRenderer = ({ r, spec, className, ...rest }) => {
    const p = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: spec ? 4 : 2, strokeLinecap: "round", strokeLinejoin: "round", className: className || "w-full h-full", ...rest };
    switch (r) {
        case 'GEAR': // Steampunk: Complex Gear with Steam
            return <svg {...p}>
                {/* Ambient Steam Clouds */}
                <path d="M6 16a3.5 3.5 0 0 1 3.5-3.5 4.5 4.5 0 0 1 8.5 1 3.5 3.5 0 0 1 0 7H9.5A3.5 3.5 0 0 1 6 16z" fill="currentColor" opacity="0.1" stroke="none" />
                <path d="M12 5a2.5 2.5 0 0 1 2.5 2.5 2 2 0 0 1-3.5 1 2.5 2.5 0 0 1 1-3.5z" fill="currentColor" opacity="0.1" stroke="none" />
                {/* Solid Brass Body */}
                <circle cx="12" cy="12" r="7" fill="currentColor" opacity="0.2" stroke="none" />
                <circle cx="12" cy="12" r="7" />
                <path d="M12 2v3 M12 19v3 M2 12h3 M19 12h3" />
                <path d="M4.9 4.9l2.1 2.1 M17.1 17.1l2.1 2.1 M4.9 19.1l2.1-2.1 M17.1 4.9l2.1 2.1" />
                {/* Glowing Core */}
                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
            </svg>;
        case 'ARCHIVE': // Steampunk: Mechanical Tome with Steam
            return <svg {...p}>
                {/* Ambient Steam Clouds */}
                <path d="M4 17a3 3 0 0 1 3-3 5 5 0 0 1 9 1 3 3 0 0 1 0 6H7a3 3 0 0 1-3-3z" fill="currentColor" opacity="0.1" stroke="none" />
                {/* Leather Book Body */}
                <path d="M8.5 5H20v15.5H8.5a2.5 2.5 0 0 1 0-5H20" fill="currentColor" opacity="0.2" stroke="none" />
                <path d="M6 20.5A2.5 2.5 0 0 1 8.5 18H20" />
                <path d="M8.5 5H20v15.5H8.5a2.5 2.5 0 0 1 0-5H20" />
                {/* Brass Lock (Glowing) */}
                <rect x="15" y="10" width="6" height="5" rx="1" fill="currentColor" opacity="0.4" stroke="none" />
                <rect x="15" y="10" width="6" height="5" rx="1" />
                <circle cx="18" cy="12.5" r="1.5" fill="currentColor" stroke="none" style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
            </svg>;
        case 'FOUNTAIN': // Fantasy: Magical Water Jewel Crest
            return <svg {...p}>
                {/* Ambient Magic Aura */}
                <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.1" stroke="none" />
                {/* Dotted magic boundary */}
                <circle cx="12" cy="12" r="9" strokeDasharray="2 4" opacity="0.6" />
                {/* Water Jewel Glass Body (Transparent) */}
                <path d="M12 19c3.8 0 7-3.2 7-7 0-4.5-7-10-7-10S5 7.5 5 12c0 3.8 3.2 7 7 7z" fill="currentColor" opacity="0.25" stroke="none" />
                <path d="M12 19c3.8 0 7-3.2 7-7 0-4.5-7-10-7-10S5 7.5 5 12c0 3.8 3.2 7 7 7z" />
                {/* Glowing Core */}
                <path d="M12 16c2 0 3.5-1.5 3.5-3.5 0-2.5-3.5-5.5-3.5-5.5S8.5 10 8.5 12.5c0 2 1.5 3.5 3.5 3.5z" fill="currentColor" stroke="none" style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
                {/* Crescent Aura */}
                <path d="M7 6a7 7 0 0 1 10 0" opacity="0.8" />
            </svg>;
        case 'ICEAGE': // Fantasy: Absolute Zero Crystal
            return <svg {...p}>
                {/* Ambient Frost Aura */}
                <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.1" stroke="none" />
                {/* 8-axis frost spears */}
                <path d="M12 3v18 M3 12h18 M5.6 5.6l12.8 12.8 M5.6 18.4l12.8-12.8" strokeWidth="1.2" opacity="0.7" />
                {/* Inner magic bounds (Glassy Ice) */}
                <polygon points="12 7 17 12 12 17 7 12" fill="currentColor" opacity="0.25" stroke="none" />
                <polygon points="12 7 17 12 12 17 7 12" fill="none" strokeWidth="1.2" />
                <polygon points="12 4 15.5 8.5 20 12 15.5 15.5 12 20 8.5 15.5 4 12 8.5 8.5" fill="none" strokeWidth="1.2" opacity="0.5" />
                {/* Solid frost core (Glowing) */}
                <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
            </svg>;
        case 'MACHINE': // Cyber: CPU Core Circuit with Glitch Noise
            return <svg {...p}>
                {/* Digital Noise / Glitch Blocks */}
                <rect x="3" y="4" width="4" height="2" fill="currentColor" opacity="0.15" stroke="none" />
                <rect x="17" y="6" width="3" height="3" fill="currentColor" opacity="0.1" stroke="none" />
                <rect x="4" y="17" width="5" height="1" fill="currentColor" opacity="0.15" stroke="none" />
                <rect x="15" y="16" width="4" height="2" fill="currentColor" opacity="0.1" stroke="none" />
                {/* Solid PCB Body */}
                <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" opacity="0.2" stroke="none" />
                <rect x="6" y="6" width="12" height="12" rx="1" />
                {/* Traces */}
                <path d="M10 6V2 M14 6V2 M10 18v4 M14 18v4 M6 10H2 M6 14H2 M18 10h4 M18 14h4" />
                {/* Inner core chip (Glowing) */}
                <rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none" style={{ filter: 'drop-shadow(0 0 3px currentColor)' }} />
                <path d="M9 9l-3-3 M15 9l3-3 M9 15l-3 3 M15 15l3 3" />
            </svg>;
        case 'BATTERY': // Cyber: Energy Cell with Glitch Noise
            return <svg {...p}>
                {/* Digital Noise / Scanlines */}
                <rect x="2" y="7" width="4" height="1" fill="currentColor" opacity="0.2" stroke="none" />
                <rect x="18" y="15" width="3" height="2" fill="currentColor" opacity="0.15" stroke="none" />
                <rect x="5" y="4" width="14" height="14" fill="currentColor" opacity="0.08" stroke="none" />
                {/* Holographic Battery Body */}
                <rect x="5" y="3" width="14" height="18" rx="2" fill="currentColor" opacity="0.2" stroke="none" />
                <rect x="5" y="3" width="14" height="18" rx="2" />
                <path d="M9 1h6 M5 8h14 M5 16h14" />
                {/* Energy Lightning (Glowing) */}
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

const CardView = ({ card, playable, onClick, isField, isSelected, isMyTurn, onMouseEnter, onMouseLeave }) => {
    if (!card?.realm) return null;
    let dr = card.realm;
    if (card.wasRuins) dr = 'RUINS'; else if (card.wasPlanet) dr = 'PLANET'; else if (card.wasFountain || (card.realm === 'FOUNTAIN' && card.isSpecial)) dr = 'FOUNTAIN';
    const spec = card.isSpecial || card.wasFountain;
    const rData = REALMS[dr] || REALMS.GEAR;

    let specialLabel = "";
    if (spec) {
        if (card.realm === 'GEAR') specialLabel = "DRAW 2";
        else if (card.realm === 'MACHINE') specialLabel = "REVERSE";
        else if (card.realm === 'FOUNTAIN') specialLabel = "LIMIT WILD";
        else specialLabel = "WILD";
    }

    return (
        <div className={`card-anchor flex-shrink-0 ${!playable && !isField ? 'not-playable' : 'playable'} ${isSelected ? 'selected' : ''} ${isMyTurn ? 'is-my-turn' : ''}`} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
            <div className={`card-surface mat-${rData.theme}`}
                style={{ '--r-color': rData.color, '--r-color-bright': rData.bright, '--r-color-glow': rData.glow, '--r-color-dim': rData.dim || 'rgba(0,0,0,0.5)', width: 'var(--card-w)', height: 'var(--card-h)', borderRadius: '8px', overflow: 'hidden', position: 'relative', border: 'none' }}>
                <CardOrnaments theme={rData.theme} />
                <div className="card-content">
                    <div className="card-info-top"><span>{dr}</span></div>
                    <div className="card-icon-overload" style={{ color: rData.bright, filter: `drop-shadow(0 0 10px ${rData.glow})`, position: 'absolute', top: '55%', left: '50%', transform: 'translate(-50%, -50%)', width: '55%', height: '55%' }}>
                        <IconRenderer r={dr} spec={spec} />
                    </div>
                    <div className={`card-footer-peak font-['${rData.font}']`}>{rData.n}</div>
                    {spec && <div className="special-badge-base">{specialLabel.split(' ').map((word, i) => <div key={i}>{word}</div>)}</div>}
                </div>
            </div>
        </div>
    );
};

const GearSVG = ({ color }) => (
    <svg viewBox="0 0 100 100" className="w-full h-full"><defs><linearGradient id={`grad-gear-${color}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} /><stop offset="100%" style={{ stopColor: '#4b2f1c', stopOpacity: 1 }} /></linearGradient></defs><path fill={`url(#grad-gear-${color})`} d="M100 56.5v-13l-12.7-2.1c-1.1-4.5-3-8.6-5.4-12.3l7.4-10.4-9.2-9.2-10.4 7.4c-3.7-2.4-7.8-4.3-12.3-5.4L55.3 0h-13l-2.1 12.7c-4.5 1.1-8.6 3-12.3 5.4l-10.4-7.4-9.2 9.2 7.4 10.4c-2.4 3.7-4.3 7.8-5.4 12.3L0 43.5v13l12.7 2.1c1.1 4.5 3 8.6 5.4 12.3l-7.4 10.4 9.2 9.2 10.4-7.4c3.7 2.4 7.8 4.3 12.3 5.4l2.1 12.7h13l2.1-12.7c4.5-1.1 8.6-3 12.3-5.4l10.4 7.4 9.2-9.2-7.4-10.4c2.4-3.7 4.3-7.8 5.4-12.3l12.7-2.1zM50 71c-11.6 0-21-9.4-21-21s9.4-21 21-21 21 9.4 21 21-9.4 21-21 21z" /><circle cx="50" cy="50" r="12" fill="#000" /></svg>
);
const MagicCircleSVG = ({ color }) => (
    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible"><defs><filter id="magic-glow"><feGaussianBlur stdDeviation="2" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter></defs><g filter="url(#magic-glow)"><g style={{ animation: 'rotate-outer 10s linear infinite', transformOrigin: 'center' }}><circle cx="50" cy="50" r="48" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="10 5" /></g><g style={{ animation: 'rotate-inner 15s linear infinite', transformOrigin: 'center' }}><circle cx="50" cy="50" r="35" fill="none" stroke={color} strokeWidth="1" /><path d="M50 15 L80 70 L20 70 Z M50 85 L20 30 L80 30 Z" fill="none" stroke={color} strokeWidth="1" /><circle cx="50" cy="50" r="10" fill="none" stroke={color} strokeWidth="2" /></g></g></svg>
);

const AstralBackground = ({ bgAnim }) => {
    const rainColors = ['#FF8C00', '#FF3131', '#1E90FF'];
    const items = useMemo(() => {
        if (!bgAnim) return [];
        const arr = [];
        for (let i = 0; i < 3; i++) arr.push({ id: `m${i}`, type: 'magic', color: i % 2 ? '#00F3FF' : '#1E90FF', sx: `${(Math.random() * 60) - 30}vw`, ex: `${(Math.random() * 20) - 10}vw`, delay: `${Math.random() * 20}s`, dur: `${16 + Math.random() * 12}s`, op: 0.3, rot: `${360 + Math.random() * 720}deg` });
        for (let i = 0; i < 8; i++) {
            const isLtr = Math.random() > 0.5;
            const sx = isLtr ? '-300px' : 'calc(100vw + 300px)';
            const ex = isLtr ? 'calc(100vw + 300px)' : '-300px';
            const sy = `${Math.random() * 90}vh`;
            const rot = isLtr ? `${360 + Math.random() * 720}deg` : `-${360 + Math.random() * 720}deg`;
            const size = 80 + Math.random() * 100;
            arr.push({
                id: `g${i}`, type: 'gear', color: i % 3 === 0 ? '#8B4513' : (i % 3 === 1 ? '#B22222' : '#555555'),
                sx, ex, sy, ey: sy, size: `${size}px`,
                delay: `${Math.random() * 20}s`, dur: `${20 + Math.random() * 30}s`, op: 0.2 + Math.random() * 0.3, rot: rot
            });
        }
        return arr;
    }, [bgAnim]);

    useEffect(() => {
        const canvas = document.getElementById('matrixCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!bgAnim) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        const cols = Math.floor(canvas.width / 16); const heads = new Array(cols).fill(0);
        const draw = () => {
            if (!bgAnim) return;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = '900 16px Orbitron';
            for (let i = 0; i < cols; i++) {
                if (Math.random() > 0.98) {
                    ctx.fillStyle = rainColors[Math.floor(Math.random() * rainColors.length)];
                    ctx.fillText(Math.floor(Math.random() * 2).toString(), i * 16, heads[i] * 16);
                    heads[i]++;
                    if (heads[i] * 16 > canvas.height && Math.random() > 0.9) heads[i] = 0;
                }
            }
            requestAnimationFrame(draw);
        };
        const animId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animId);
    }, [bgAnim]);

    return (
        <div className="astral-canvas">
            {bgAnim && <canvas id="matrixCanvas" className="matrix-code-canvas" />}
            {bgAnim && items.map(it => {
                if (it.type === 'gear') {
                    return (
                        <div key={it.id} className="flow-gear" style={{ '--sx': it.sx, '--ex': it.ex, '--sy': it.sy, '--ey': it.ey, '--delay': it.delay, '--dur': it.dur, '--op': it.op, '--rot': it.rot, '--glow-color': it.color, width: it.size, height: it.size, animationDelay: it.delay, animationDuration: it.dur }}>
                            <GearSVG color={it.color} />
                        </div>
                    );
                } else {
                    return (
                        <div key={it.id} className="flow-magic" style={{ '--sx': it.sx, '--ex': it.ex, '--op': it.op, '--rot': it.rot, '--glow-color': it.color, width: '130px', height: '130px', animationDelay: it.delay, animationDuration: it.dur }}>
                            <MagicCircleSVG color={it.color} />
                        </div>
                    );
                }
            })}
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
            setTimeout(() => setMotions(prev => prev.filter(m => m.mid !== mid)), 1000);
            lastActionRef.current = act;
        }
    }, [gs]);

    const getPlayerPosClass = (pid) => {
        if (!gs) return "pos-center";
        if (pid === socket.id) return "pos-bottom";
        const others = gs.players.filter(p => p.id !== socket.id);
        const idx = others.findIndex(p => p.id === pid);
        // 相手プレイヤーの配置変更（2人は上、2人は下）に合わせて位置定義を更新
        if (idx === 0) return "pos-top-left";
        if (idx === 1) return "pos-top-right";
        if (idx === 2) return "pos-side-left";
        if (idx === 3) return "pos-side-right";
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
        if (!gs.isReversed) {
            return (targetSurvivorIdx - currentSurvivorIdx + diff) % diff;
        } else {
            return (currentSurvivorIdx - targetSurvivorIdx + diff) % diff;
        }
    };

    const [room, setRoom] = useState('');
    const [name, setName] = useState('');
    const [joined, setJoined] = useState(false);
    const [selector, setSelector] = useState(null);
    const [muted, setMuted] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [hoveredCard, setHoveredCard] = useState(null);
    const [vfxOverlay, setVfxOverlay] = useState(null);
    const [isDisconnected, setIsDisconnected] = useState(false);
    const [isConnected, setIsConnected] = useState(socket.connected);

    const [shake, setShake] = useState(false);
    const [flash, setFlash] = useState(false);
    const [bgAnim, setBgAnim] = useState(true);
    const [cutin, setCutin] = useState(null);
    const prevFieldCardId = useRef(null);
    const prevPlayersRef = useRef([]);

    const logContainerRef = useRef(null);

    useEffect(() => {
        console.log("[SOCKET] Initializing listeners...");

        socket.on('connect', () => {
            console.log("[SOCKET] Connected! ID:", socket.id);
            setIsConnected(true);
            setIsDisconnected(false);
        });

        socket.on('connect_error', (err) => {
            console.error("[SOCKET] Connection Error:", err.message);
        });

        socket.on('update-game', (data) => {
            console.log("[SOCKET] Game Update Received", data);
            setGs(data);
        });

        socket.on('disconnect', (reason) => {
            console.warn("[SOCKET] Disconnected:", reason);
            setIsConnected(false);
            setIsDisconnected(true);
        });

        const initAudio = () => {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            document.removeEventListener('click', initAudio);
            document.removeEventListener('touchstart', initAudio);
        };
        document.addEventListener('click', initAudio);
        document.addEventListener('touchstart', initAudio);

        return () => {
            socket.off('update-game'); socket.off('disconnect'); socket.off('connect');
            document.removeEventListener('click', initAudio); document.removeEventListener('touchstart', initAudio);
        };
    }, []);

    useEffect(() => {
        if (gs && gs.fieldCard && gs.fieldCard.id !== prevFieldCardId.current) {
            if (prevFieldCardId.current !== null && gs.status === 'playing') {
                const c = gs.fieldCard;
                let dr = c.realm;
                if (c.wasRuins) dr = 'RUINS'; else if (c.wasPlanet) dr = 'PLANET'; else if (c.wasFountain || (c.realm === 'FOUNTAIN' && c.isSpecial)) dr = 'FOUNTAIN';

                if (c.isSpecial || dr === 'PLANET' || dr === 'RUINS') {
                    setFlash(true); setTimeout(() => setFlash(false), 600);
                    let text = "WILD";
                    if (dr === 'GEAR') text = "DRAW 2";
                    else if (dr === 'MACHINE') text = "REVERSE";
                    else if (dr === 'FOUNTAIN') text = "LIMIT WILD";
                    setCutin({ text, color: REALMS[dr].bright });
                    setTimeout(() => setCutin(null), 1500);
                } else {
                    setShake(true); setTimeout(() => setShake(false), 300);
                }
            }
            prevFieldCardId.current = gs.fieldCard.id;
        }

        if (gs && gs.status === 'playing') {
            const prevPlayers = prevPlayersRef.current;
            if (prevPlayers.length > 0) {
                gs.players.forEach(p => {
                    const oldP = prevPlayers.find(x => x.id === p.id);
                    if (oldP && !oldP.isEliminated && p.isEliminated) {
                        setVfxOverlay({ type: 'burst', color: '#EF4444' });
                        setTimeout(() => setVfxOverlay(null), 1000);
                    } else if (oldP && !oldP.finishBonus && p.finishBonus) {
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

    const currentR = gs?.fieldCard?.realm || 'GEAR';
    const me = gs?.players?.find(p => p.id === socket?.id);
    const isMyTurn = gs?.currentTurnPlayerId === socket?.id && !me?.isEliminated;

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
        if (!isMyTurn || !isPlayable) return;
        playSE('play', muted);

        const isLastCard = me?.hand?.length === 1;
        const needsSelector = c.realm === 'PLANET' || c.realm === 'RUINS' || (c.realm === 'FOUNTAIN' && c.isSpecial);

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
            } else { setSelectedCardId(c.id); }
        }
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
        <div className={`screen-wrapper ${shake ? 'shake-active' : ''} ${isMyTurn ? 'my-turn-glow' : ''}`} style={{ '--r-color': REALMS[currentR]?.color }}>
            {flash && <div className="flash-overlay" />}
            {cutin && (
                <div className="cutin-container">
                    <div className="cutin-bar" style={{ '--c': cutin.color }}>
                        <div className="cutin-text">{cutin.text}</div>
                    </div>
                </div>
            )}

            <AstralBackground bgAnim={bgAnim} />

            {isDisconnected && joined && (
                <div className="fixed inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center p-8 backdrop-blur-md">
                    <h3 className="font-black text-danger text-3xl tracking-widest mb-4 animate-pulse font-['Orbitron']">CONNECTION LOST</h3>
                    <p className="text-white/80 text-sm text-center mb-8 font-bold leading-relaxed">
                        サーバーとの通信が切断されたため<br />部屋が消滅しました。<br /><br />
                        <span className="text-xs text-white/50">※スマホのスリープや別アプリへの切り替えが原因の可能性があります。</span>
                    </p>
                    <button className="w-full max-w-xs p-5 font-black bg-gradient-to-r from-red-600 to-red-900 text-white rounded-sm shadow-2xl tracking-[4px]" onClick={() => window.location.reload()}>タイトルへ戻る</button>
                </div>
            )}

            <div className="ui-viewport">
                {!gs || gs.status !== 'playing' ? (
                    <div className="absolute top-3 right-3 z-[950] flex gap-2">
                        <div className="w-10 h-10 rounded-full border-2 border-accent flex items-center justify-center text-accent bg-black/80 backdrop-blur-sm cursor-pointer shadow-[0_0_10px_rgba(64,224,208,0.3)] transition-all" onClick={() => setMuted(!muted)}>
                            {muted ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 opacity-40"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>}
                        </div>
                    </div>
                ) : null}

                <div className="motion-overlay-layer">
                    {motions.map(m => (
                        <div key={m.mid} className={`motion-card-ghost ${m.type} ${getPlayerPosClass(m.playerId)}`}>
                            <div className="ghost-surface" />
                        </div>
                    ))}
                </div>

                {!joined ? (
                    <div className="h-full flex flex-col items-center justify-center overflow-y-auto no-scrollbar py-12">
                        <div className="top-logo-area">
                            <div className="field-central-zone">
                                <div className="emblem-bg-layer"><ComplexEmblem isLogo={true} /></div>
                                <div className="logo-text-layer">
                                    <div className="main-logo-text">CROSS</div>
                                    <div className="main-logo-text" style={{ fontSize: '3.2rem', marginTop: '-0.5rem' }}>REALM</div>
                                    <div className="text-accent font-['Audiowide'] text-[0.85rem] mt-2 tracking-[6px] animate-pulse">- OMEGA SINGULARITY -</div>
                                </div>
                            </div>
                        </div>
                        <div className="trinity-flavor-box mb-8">
                            <div className="flavor-line"><span className="f-steam">真鍮</span>の爆鳴、<span className="f-fantasy">星界</span>の共鳴、<span className="f-cyber">電脳</span>の火花。</div>
                            <div className="mt-2 text-white/70 font-black text-[0.8rem]">次元の境界は消失し、特異点へと収束する。</div>
                        </div>
                        <div className="w-full px-8 flex flex-col gap-5 flex-shrink-0">
                            <div className="relative w-full flex flex-col">
                                <div className="absolute left-0 top-0 w-1 h-full bg-accent shadow-[0_0_15px_var(--accent)] rounded-sm"></div>
                                <label className="font-['Orbitron'] text-[11px] font-black text-accent tracking-[3px] mb-2 pl-4 uppercase text-shadow-[0_0_10px_rgba(64,224,208,0.5)]">パイロット識別名</label>
                                <input type="text" className="w-full p-4 ml-2 bg-[#0a0f23]/95 border border-accent/30 text-white font-black text-xl outline-none rounded shadow-[inset_0_0_20px_#000] focus:border-accent focus:bg-[#141e32]/98 focus:shadow-[0_0_20px_rgba(64,224,208,0.2),inset_0_0_15px_#000] transition-colors" value={name} placeholder="名前を入力..." onChange={e => setName(e.target.value)} maxLength={10} />
                            </div>
                            <div className="relative w-full flex flex-col">
                                <div className="absolute left-0 top-0 w-1 h-full bg-accent shadow-[0_0_15px_var(--accent)] rounded-sm"></div>
                                <label className="font-['Orbitron'] text-[11px] font-black text-accent tracking-[3px] mb-2 pl-4 uppercase text-shadow-[0_0_10px_rgba(64,224,208,0.5)]">セクターコード</label>
                                <input type="text" className="w-full p-4 ml-2 bg-[#0a0f23]/95 border border-accent/30 text-white font-black text-xl outline-none rounded shadow-[inset_0_0_20px_#000] focus:border-accent focus:bg-[#141e32]/98 focus:shadow-[0_0_20px_rgba(64,224,208,0.2),inset_0_0_15px_#000] transition-colors" value={room} placeholder="合言葉を入力..." onChange={e => setRoom(e.target.value.toUpperCase())} />
                            </div>
                            <button className={`w-full mt-2 p-5 text-xl font-black rounded-sm shadow-xl active:scale-95 transition-transform ${(!isConnected) ? 'bg-gray-600 opacity-50 cursor-not-allowed' : 'bg-gradient-to-r from-amber-400 to-amber-600 text-black'}`} onClick={join} disabled={!isConnected}>
                                {(!isConnected) ? '接続中...' : 'リンク開始'}
                            </button>
                        </div>
                        <div className="mt-auto w-full p-4 border-t-2 border-white/15 font-['Orbitron'] text-[11px] text-white/70 flex justify-between items-center bg-[#0a0519]/90 shrink-0">
                            <span>SYSTEM_STATUS: <span className={`px-2 py-0.5 rounded-sm font-black ${(!isConnected) ? 'bg-red-600' : 'bg-accent animate-[pulse-shimmer_1.5s_infinite]'} text-white`}>{(!isConnected) ? 'OFFLINE' : 'ONLINE'}</span></span>
                            <span>VER: <span className="text-white/80 font-black ml-1">133.0_REFINED</span></span>
                        </div>
                    </div>
                ) : (joined && !gs) ? (
                    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mb-8 shadow-[0_0_20px_rgba(64,224,208,0.4)]"></div>
                        <h2 className="text-accent font-black tracking-[8px] animate-pulse font-['Orbitron'] mb-2">ESTABLISHING LINK...</h2>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-[2px]">Syncing with sector {room}</p>
                        <button className="mt-12 py-2.5 px-8 bg-white/5 border border-white/10 text-white/30 text-[10px] font-black rounded-full hover:bg-white/10 transition-colors uppercase tracking-[4px]" onClick={() => window.location.reload()}>Abort Link</button>
                    </div>
                ) : (gs?.status === 'waiting') ? (
                    <div className="h-full flex flex-col items-center justify-center p-4 text-center overflow-y-auto no-scrollbar">
                        <h2 className="text-[clamp(1.2rem,6.5vw,1.875rem)] font-black mb-6 tracking-[clamp(4px,2vw,10px)] font-['Orbitron'] text-white animate-pulse uppercase w-full text-center">同期待機中...</h2>
                        <div className="w-full overflow-y-auto max-h-[48vh] p-1 mx-5 mb-3 shrink-0 no-scrollbar">
                            {[...Array(5)].map((_, i) => {
                                const p = gs?.players[i];
                                const isMe = p && (p.id === socket?.id || p.name === name);
                                return (
                                    <div key={i} className={`bg-[#140a28]/85 border px-5 py-2.5 rounded-md mb-1.5 flex justify-between items-center min-h-[56px] shadow-[0_8px_25px_rgba(0,0,0,0.8)] backdrop-blur-md ${p ? 'border-l-8 border-l-accent border-accent/80 bg-[#0a1e28]/85 shadow-[0_0_15px_rgba(64,224,208,0.2)]' : 'border-white/30 opacity-20 border-dashed'}`}>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-sm tracking-wide uppercase">{p ? p.name : '--- 空きスロット ---'}</span>
                                            {p && p.isBot && (
                                                <button className="cpu-remove-btn" onClick={() => socket.emit('remove-cpu', { roomId: room, botId: p.id })}>
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                        {p && i === 0 && <span className="bg-white text-black text-[10px] px-3 py-1 font-black rounded shadow-lg">マスター</span>}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="w-full mt-2 px-4 flex flex-col items-center">
                            {(gs?.players[0]?.id === socket?.id || gs?.players[0]?.name === name) && (
                                <div className="flex gap-3 w-full mb-3">
                                    <button className="flex-1 p-5 bg-black/80 border border-white/40 backdrop-blur-md text-white font-black text-[12px] tracking-[2px] uppercase rounded-sm" disabled={gs?.players?.length >= 5} onClick={() => {
                                        playSE('play', muted);
                                        const botNames = ['X-TREME', 'A.L.I.C.E', 'G.E.A.R', 'N.U.L.L'];
                                        socket.emit('add-cpu', { roomId: room.toUpperCase(), botName: botNames[Math.floor(Math.random() * botNames.length)] });
                                    }}>CPU追加</button>
                                    <button className="flex-[2] p-5 bg-gradient-to-r from-amber-400 to-amber-600 text-black font-black text-xl rounded-sm shadow-2xl" disabled={gs?.players?.length < 2} onClick={() => { playSE('start', muted); socket.emit('start-game', { roomId: room }); }}>ミッション開始</button>
                                </div>
                            )}
                            <button className="inline-block py-2.5 px-8 bg-black/90 border-2 border-accent text-white font-['Orbitron'] text-[11px] font-black tracking-[4px] rounded-full cursor-pointer" onClick={leave}>同期を解除</button>
                        </div>
                    </div>
                ) : (gs.status === 'finished') ? (
                    <div className="result-screen">
                        <h2 className="result-title uppercase tracking-tighter" style={{ color: gs.isSeriesFinished ? '#FFD700' : 'var(--steam-gold)' }}>
                            {gs.isSeriesFinished ? "シリーズ終了" : `第 ${gs.matchCount - 1} 戦 終了`}
                        </h2>
                        {gs.isSeriesFinished && <div className="text-xl md:text-2xl text-white font-black mb-6 text-center animate-pulse champion-fx py-4 px-8 rounded-full border border-[var(--steam-gold)]">総合優勝 (CHAMPION)<br /><span className="text-[clamp(1.5rem,6vw,2.25rem)] text-[var(--steam-gold)] drop-shadow-[0_0_10px_rgba(212,175,55,1)] mt-2 inline-block max-w-full truncate break-all px-2">👑 {[...gs.players].sort((a, b) => b.score - a.score)[0].name} 👑</span></div>}

                        <div className="flex flex-row items-end justify-center w-full max-w-[440px] h-[220px] gap-1 mt-4 mb-8 px-2">
                            {(gs.isSeriesFinished ? [...gs.players].sort((a, b) => b.score - a.score) : sortedResultPlayers).map((p, i) => {
                                const order = i === 0 ? 3 : i === 1 ? 2 : i === 2 ? 4 : i === 3 ? 1 : 5;
                                const height = i === 0 ? '120px' : i === 1 ? '90px' : i === 2 ? '70px' : i === 3 ? '50px' : '40px';
                                const color = i === 0 ? 'var(--steam-gold)' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--accent)';

                                return (
                                    <div key={p.id} className="flex flex-col items-center justify-end w-[20%] relative" style={{ order }}>
                                        {p.isEliminated && !gs.isSeriesFinished && <div className="absolute top-[-20px] text-[8px] text-red-500 font-bold bg-black/90 px-1 rounded border border-red-500/50 z-10">臨界突破</div>}
                                        <div className="text-[9px] md:text-[10px] font-bold truncate w-full min-w-0 px-1 text-center mb-1" style={{ color: (p.isEliminated && !gs.isSeriesFinished) ? 'gray' : 'white', textDecoration: (p.isEliminated && !gs.isSeriesFinished) ? 'line-through' : 'none' }}>{p.name}</div>
                                        {!gs.isSeriesFinished && <div className="text-[11px] md:text-[13px] font-black mb-1 font-['Orbitron']">{p.handCount}枚</div>}
                                        <div className="text-[12px] md:text-[14px] font-black text-[var(--steam-gold)] mb-2 font-['Orbitron']">★ {p.score}</div>

                                        {p.finishBonus && !gs.isSeriesFinished && <div className="absolute top-[-55px] text-[10px] text-[#ff88ff] font-black animate-pulse drop-shadow-[0_0_5px_rgba(255,0,255,0.8)] whitespace-nowrap z-20">ワイルドボーナス x1.5!</div>}
                                        {p.earnedPoints > 0 && !gs.isSeriesFinished && <div className="absolute top-[-40px] text-green-400 font-black animate-bounce">+{p.earnedPoints}</div>}
                                        {p.isEliminated && !gs.isSeriesFinished && <div className="absolute top-[-40px] text-red-500 font-black animate-pulse">-10</div>}

                                        <div className="w-full flex items-start justify-center pt-2 rounded-t-md border-t-[3px] border-x border-white/10" style={{ height, background: `linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)`, borderTopColor: color }}>
                                            <span className="font-['Orbitron'] font-black text-xl md:text-2xl mt-1 drop-shadow-md" style={{ color }}>{i + 1}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="w-full max-w-xs flex flex-col gap-3">
                            <button className="w-full py-5 text-xl font-black bg-gradient-to-r from-amber-400 to-amber-600 text-black rounded-sm shadow-2xl uppercase tracking-[2px]" onClick={() => { playSE('start', muted); gs.isSeriesFinished ? socket.emit('play-again', { roomId: room }) : socket.emit('start-game', { roomId: room }); }}>
                                {gs.isSeriesFinished ? "新しいシリーズを開始" : "次のマッチへ"}
                            </button>
                            <button className="w-full py-3 text-xs font-black bg-black/50 border border-white/10 text-white/50 hover:bg-white/5 transition-colors rounded-sm uppercase tracking-[2px] mt-2" onClick={goToTopPage}>タイトル画面へ戻る</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center px-4 py-2 bg-[#05010a]/90 border-b border-accent/20 shrink-0 z-50">
                            <div className="text-[11px] font-black text-accent font-['Orbitron'] tracking-[2px] sm:tracking-[4px] truncate flex-1">セクター: {room} <span className="ml-2 text-white/80">| 第{gs.matchCount}/{gs.maxMatches}戦</span> <span className="ml-2 text-[var(--steam-gold)]">★ {me?.score || 0} pts</span></div>
                            <div className="w-8 h-8 rounded-full border-2 border-accent flex items-center justify-center text-accent bg-black/80 backdrop-blur-sm cursor-pointer shadow-[0_0_10px_rgba(64,224,208,0.4)] transition-all ml-2" onClick={() => setBgAnim(!bgAnim)} title={bgAnim ? "演出をオフにする" : "演出をオンにする"}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 ${!bgAnim ? 'opacity-40' : ''}`}><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /><circle cx="12" cy="12" r="4" /></svg>
                            </div>
                            <div className="w-8 h-8 rounded-full border-2 border-accent flex items-center justify-center text-accent bg-black/80 backdrop-blur-sm cursor-pointer shadow-[0_0_10px_rgba(64,224,208,0.4)] transition-all ml-2" onClick={() => setMuted(!muted)}>
                                {muted ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 opacity-40"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>}
                            </div>
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
                                        <div key={r} className={`realm-badge ${playableRealms.includes(r) ? 'active' : ''} ${gs.currentRealm === r ? 'current' : ''}`} style={{ '--r-color': REALMS[r].color }} title={REALMS[r].n}>
                                            <IconRenderer r={r} spec={false} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-2 bg-[#0a0f23]/90 border-b-2 border-white/15 shrink-0 backdrop-blur-md">

                            {gs.players.filter(p => p.id !== socket?.id && p.name !== name).slice(0, 2).map(p => (
                                <div key={p.id} className={`bg-white/5 border border-white/15 rounded-md p-2 relative h-16 flex flex-col justify-center ${gs.currentTurnPlayerId === p.id ? 'current-turn-glow-active' : ''} ${p.isEliminated ? 'grayscale brightness-50 border-danger' : ''} ${(p.handCount >= 8 && !p.isEliminated) ? 'burst-warning' : ''}`}>
                                    <div className="text-[10px] font-black uppercase text-white/60 mb-0.5 tracking-wider w-[85%] truncate">{p.name}</div>
                                    <div className="absolute top-1 right-2 text-[10px] font-black text-[var(--steam-gold)]">★ {p.score}</div>
                                    <div className="text-xl font-black text-white font-['Orbitron'] leading-none">{p.handCount}枚</div>
                                    {getTurnDistance(p.id) !== null && !p.isEliminated && getTurnDistance(p.id) > 0 && (
                                        <div className="absolute bottom-1 right-2 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-black/60 border border-white/20 text-accent flex items-center gap-1 shadow-lg">
                                            <span className="opacity-50 font-['Orbitron'] text-[8px]">T-</span>{getTurnDistance(p.id)}
                                        </div>
                                    )}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[14px] h-[20px] z-0 opacity-40">
                                        {[...Array(Math.min(p.handCount, 5))].map((_, i) => (
                                            <div key={i} className="absolute w-full h-full bg-[#111] border border-white/80 rounded-[1px] shadow-[2px_2px_5px_rgba(0,0,0,1)]" style={{ transform: `translate(${i * 2.5}px, ${i * 2.5}px)`, zIndex: i, borderColor: gs.currentTurnPlayerId === p.id ? 'var(--accent)' : 'rgba(255,255,255,0.4)' }} />
                                        ))}
                                    </div>
                                    {p.isEliminated && <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center text-sm font-black text-danger tracking-[4px] -rotate-3 text-shadow-[0_0_10px_#000] z-20">BURST</div>}
                                </div>
                            ))}
                        </div>

                        <div className="field-main-area">
                            <div className="tactical-field-viewport">
                                <CycleDiagramSmall currentRealm={gs.currentRealm} playableRealms={playableRealms} hoveredCard={hoveredCard} bgAnim={bgAnim} isReversed={gs.isReversed} />

                                {vfxOverlay && (
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none z-50 flex items-center justify-center">
                                        <div className="absolute w-full h-full rounded-full border-[8px] animate-ping opacity-0" style={{ borderColor: vfxOverlay.color, animationDuration: '0.8s' }} />
                                        <div className="absolute w-40 h-40 rounded-full blur-[20px] opacity-0 animate-pulse" style={{ backgroundColor: vfxOverlay.color, animationDuration: '0.4s' }} />
                                    </div>
                                )}

                                <div className="central-cards-overlay">
                                    <div className="flex items-center justify-center gap-4 sm:gap-6">
                                        <div className="relative w-14 h-20 sm:w-16 sm:h-24 opacity-90 transition-all hover:scale-110 cursor-help group" title="残り山札">
                                            {[...Array(Math.min(5, Math.ceil((gs.deck?.length || 0) / 10)))].map((_, i) => (
                                                <div key={i} className="absolute inset-0 bg-[#111] border border-white/40 rounded-sm shadow-md" style={{ transform: `translate(${-i * 3}px, ${-i * 3}px)`, zIndex: -i }}>
                                                    {i === 0 && (
                                                        <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-black">
                                                            <div className="w-full h-full opacity-30 text-accent"><IconRenderer r="BACK" /></div>
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                                <div className="text-[10px] font-black text-white/50 mb-0.5 tracking-tighter">DECK</div>
                                                                <div className="text-xl font-black text-white font-['Orbitron']">{gs.deck?.length || 0}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="field-card-scale relative z-10 card-play-vfx" key={gs.fieldCard.id}>
                                            <CardView card={gs.fieldCard} isField={true} isMyTurn={isMyTurn} />
                                        </div>
                                    </div>

                                    {gs.nextDrawAmount > 1 && (
                                        <div className="draw-stack-alert-text">次ドロー: {gs.nextDrawAmount}枚</div>
                                    )}
                                </div>

                                <div className="field-kanji-text" style={{ color: REALMS[gs.fieldCard.realm].color }}>
                                    {REALMS[gs.fieldCard.realm].n}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 p-2 bg-[#0a0f23]/90 border-t-2 border-white/15 shrink-0 backdrop-blur-md">
                            {gs.players.filter(p => p.id !== socket?.id && p.name !== name).slice(2, 4).map(p => (
                                <div key={p.id} className={`bg-white/5 border border-white/15 rounded-md p-2 relative h-16 flex flex-col justify-center ${gs.currentTurnPlayerId === p.id ? 'current-turn-glow-active' : ''} ${p.isEliminated ? 'grayscale brightness-50 border-danger' : ''} ${(p.handCount >= 8 && !p.isEliminated) ? 'burst-warning' : ''}`}>
                                    <div className="text-[10px] font-black uppercase text-white/60 mb-0.5 tracking-wider w-[85%] truncate">{p.name}</div>
                                    <div className="absolute top-1 right-2 text-[10px] font-black text-[var(--steam-gold)]">★ {p.score}</div>
                                    <div className="text-xl font-black text-white font-['Orbitron'] leading-none">{p.handCount}枚</div>
                                    {getTurnDistance(p.id) !== null && !p.isEliminated && getTurnDistance(p.id) > 0 && (
                                        <div className="absolute bottom-1 right-2 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-black/60 border border-white/20 text-accent flex items-center gap-1 shadow-lg">
                                            <span className="opacity-50 font-['Orbitron'] text-[8px]">T-</span>{getTurnDistance(p.id)}
                                        </div>
                                    )}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[14px] h-[20px] z-0 opacity-40">
                                        {[...Array(Math.min(p.handCount, 5))].map((_, i) => (
                                            <div key={i} className="absolute w-full h-full bg-[#111] border border-white/80 rounded-[1px] shadow-[2px_2px_5px_rgba(0,0,0,1)]" style={{ transform: `translate(${i * 2.5}px, ${i * 2.5}px)`, zIndex: i, borderColor: gs.currentTurnPlayerId === p.id ? 'var(--accent)' : 'rgba(255,255,255,0.4)' }} />
                                        ))}
                                    </div>
                                    {p.isEliminated && <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center text-sm font-black text-danger tracking-[4px] -rotate-3 text-shadow-[0_0_10px_#000] z-20">BURST</div>}
                                </div>
                            ))}
                        </div>

                        <div className="tactical-log-box no-scrollbar" ref={logContainerRef}>
                            {gs.logs && gs.logs.length > 0 ? (
                                gs.logs.slice(-10).map(l => {
                                    let typeClass = 'log-type-play';
                                    if (l.text.includes('ドロー')) typeClass = 'log-type-draw';
                                    if (l.text.includes('特殊') || l.text.includes('ワイルド')) typeClass = 'log-type-special';
                                    if (l.text.includes('脱落') || l.text.includes('バースト')) typeClass = 'log-type-danger';
                                    return <div key={l.id} className={`text-[11px] font-black mb-0.5 border-b border-white/5 ${typeClass}`}>≫ {l.text}</div>;
                                })
                            ) : (
                                <div className="opacity-40 italic text-xs font-bold mt-1">ANALYZING...</div>
                            )}
                        </div>


                        <div className={`flex flex-row flex-nowrap justify-start items-end w-full pt-5 pb-4 px-2 overflow-x-auto bg-gradient-to-b from-[#1e0a32]/80 to-[#05010a] border-t-[2.5px] border-accent/20 min-h-[135px] shrink-0 no-scrollbar transition-all duration-500 ${isMyTurn ? 'my-turn-hand-fx' : ''} ${(me?.handCount >= 8 && !me?.isEliminated) ? 'burst-warning' : ''}`}>
                            {sortedHand.map((c, i) => {
                                const isPlayable = isMyTurn ? canPlayCheck(gs, c) : false;
                                return <CardView key={c.id} card={c} playable={isPlayable} isSelected={selectedCardId === c.id} isMyTurn={isMyTurn} onClick={() => handleCardClick(c, isPlayable)} onMouseEnter={() => isPlayable && setHoveredCard(c)} onMouseLeave={() => setHoveredCard(null)} className="card-draw-vfx" />;
                            })}
                        </div>

                        <div className="w-full px-4 pb-4 shrink-0">
                            <button className="w-full h-16 bg-gradient-to-br from-[#FFD700] to-[#B8860B] text-black font-black text-2xl tracking-[8px] cursor-pointer transition-all shadow-[0_0_25px_rgba(212,175,55,0.4)] active:scale-95 disabled:bg-[#1a1a1a] disabled:bg-none disabled:text-[#444] disabled:grayscale disabled:opacity-50 disabled:cursor-not-allowed disabled:border disabled:border-[#333] disabled:shadow-none" style={{ clipPath: isMyTurn ? 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)' : 'none' }} disabled={!isMyTurn} onClick={() => { playSE('draw', muted); socket.emit('draw-card', { roomId: room }); }}>ドロー ({gs.nextDrawAmount}枚)</button>
                        </div>

                        {selector && (
                            <div className="wild-choice-overlay">
                                <div className="wild-choice-panel">
                                    <h3 className="font-black mb-2 text-[9px] tracking-[2px] text-accent/80 uppercase text-center">次元属性を選択してください</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['GEAR', 'ICEAGE', 'FOUNTAIN', 'BATTERY', 'MACHINE', 'ARCHIVE'].map(r => (
                                            <button key={r} className="p-2 border border-white/20 font-black text-sm hover:bg-white/10 hover:border-accent transition-all active:scale-95 flex flex-col items-center gap-1.5 bg-black/40 rounded-md shadow-lg" style={{ color: REALMS[r].bright }} onClick={() => { playSE('play', muted); socket.emit('play-card', { roomId: room, card: selector, chosenRealm: r }); setSelector(null); }}>
                                                <div className="w-8 h-8 drop-shadow-[0_0_10px_currentColor]"><IconRenderer r={r} spec={false} /></div>
                                                <div className="tracking-[1px] text-[10px]">{REALMS[r].n}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <button className="w-full mt-2 p-1.5 text-white/30 text-[8px] tracking-[2px] font-black border border-white/10 uppercase hover:bg-white/5 transition-colors" onClick={() => { playSE('cancel', muted); setSelector(null); }}>選択をキャンセル</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default App;