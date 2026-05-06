import React, { useState, useEffect, useRef } from 'react';

const REALMS = {
    GEAR: { n: '歯車', color: '#FF8C00', bright: '#FFD700', theme: 'steam' },
    ARCHIVE: { n: '古文書', color: '#FF3131', bright: '#FF6347', theme: 'steam' },
    FOUNTAIN: { n: '噴水', color: '#0047FF', bright: '#6699FF', theme: 'fantasy' },
    ICEAGE: { n: '氷河期', color: '#00F3FF', bright: '#ADFCFF', theme: 'fantasy' },
    MACHINE: { n: '機械', color: '#E2B0FF', bright: '#DDA0DD', theme: 'cyber' },
    BATTERY: { n: '電池', color: '#ADFF2F', bright: '#7FFF00', theme: 'cyber' }
};

const MarkerIcon = ({ r, color, spec = false, scale = 1 }) => {
    const p = { fill: "none", stroke: color, strokeWidth: spec ? 3 : 2.5, strokeLinecap: "round", strokeLinejoin: "round" };
    return (
        <g transform={`scale(${scale})`}>
            {(() => {
                switch (r) {
                    case 'GEAR': return (
                        <g {...p}>
                            <circle cx="0" cy="0" r="8" />
                            <path d="M0 -10 v2 M0 8 v2 M-10 0 h2 M8 0 h2 M-7 -7 l1.5 1.5 M5.5 5.5 l1.5 1.5 M-7 7 l1.5 -1.5 M5.5 -5.5 l1.5 -1.5" />
                            <circle cx="0" cy="0" r="2.5" fill="#fff" stroke="none" />
                        </g>
                    );
                    case 'ARCHIVE': return (
                        <g {...p}>
                            <path d="M-4 -7 H6 v14 H-4 a2 2 0 0 1 0 -4 H6 M-6 7 a2 2 0 0 1 2 -2 H6" />
                            <circle cx="4" cy="0.5" r="1" fill="#fff" stroke="none" />
                        </g>
                    );
                    case 'ICEAGE': return (
                        <g {...p} strokeWidth="1.5">
                            <path d="M0 -9 v18 M-9 0 h18 M-6.5 -6.5 l13 13 M-6.5 6.5 l13 -13" opacity="0.7" />
                            <circle cx="0" cy="0" r="2.5" fill="#fff" stroke="none" />
                        </g>
                    );
                    case 'FOUNTAIN': return (
                        <g {...p}>
                            <path d="M0 8 c3 0 6 -2.5 6 -6 c0 -3.5 -6 -8 -6 -8 S-6 -0.5 -6 2 c0 3.5 3 6 6 6 z" />
                            <path d="M0 5.5 c1.8 0 3 -1.2 3 -3 c0 -2.5 -3 -4.5 -3 -4.5 S-3 0.5 -3 2.5 c0 1.8 1.2 3 3 3 z" fill="#fff" stroke="none" />
                        </g>
                    );
                    case 'MACHINE': return (
                        <g {...p}>
                            <rect x="-6" y="-6" width="12" height="12" rx="1" strokeDasharray="2 2" />
                            <rect x="-3" y="-3" width="6" height="6" fill="#fff" stroke="none" />
                        </g>
                    );
                    case 'BATTERY': return (
                        <g {...p}>
                            <rect x="-6" y="-8" width="12" height="16" rx="2" />
                            <path d="M0.5 -5 l-2 5 h3 l-2 5" stroke="#fff" strokeWidth="1.5" />
                        </g>
                    );
                    default: return <circle r="6" fill={color} />;
                }
            })()}
        </g>
    );
};

const CycleDiagramSmall = ({ currentRealm, playableRealms = [], isReversed }) => {
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({
        width: 400,
        height: 600,
        isPortrait: true,
        isMicro: false
    });

    useEffect(() => {
        if (!containerRef.current) return;
        
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({
                    width,
                    height,
                    isPortrait: height > width,
                    isMicro: width < 480,
                    isMedium: width >= 480 && width < 768
                });
            }
        });
        
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const { width, isPortrait, isMicro, isMedium } = dimensions;

    const items = [
        { k: 'GEAR', n: '歯車' }, { k: 'ICEAGE', n: '氷河期' }, { k: 'FOUNTAIN', n: '噴水' },
        { k: 'BATTERY', n: '電池' }, { k: 'MACHINE', n: '機械' }, { k: 'ARCHIVE', n: '古文書' }
    ];

    // --- ダイナミック・レイアウト計算 ---
    
    // ウィンドウ幅が狭いほど、rx (水平広がり) を大きくして端に寄せる (最大370)
    const rxBase = isPortrait ? 330 : 380;
    const rx = isMicro ? Math.min(365, rxBase + (480 - width) * 0.2) : rxBase;

    // ウィンドウ高さが低いほど、ry (垂直高さ) を圧縮する
    const ry = isPortrait ? 220 : 270;

    // ウィンドウサイズに合わせて枠サイズ (mBase) をスケーリング
    // 極小画面では 90px まで縮小する
    const mBase = isPortrait
        ? (isMicro ? Math.max(90, 110 - (480 - width) * 0.1) : (isMedium ? 108 : 130))
        : 180;

    const mScale = isPortrait ? (isMicro ? 1.4 : (isMedium ? 1.5 : 1.8)) : 3.0;
    const fontSize = isPortrait ? (isMicro ? 16 : (isMedium ? 17 : 20)) : 28;

    const getPos = (i) => {
        const cx = 400;
        const cy = 300;
        switch(i) {
            case 0: return { x: cx, y: cy - ry };      
            case 1: return { x: cx + rx, y: cy - ry }; 
            case 2: return { x: cx + rx, y: cy + ry }; 
            case 3: return { x: cx, y: cy + ry };      
            case 4: return { x: cx - rx, y: cy + ry }; 
            case 5: return { x: cx - rx, y: cy - ry }; 
            default: return { x: cx, y: cy };
        }
    };

    return (
        <div ref={containerRef} className="tactical-cycle-wheel" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}>
            <svg viewBox="0 0 800 600" style={{ 
                width: isPortrait ? '100%' : '120%', 
                height: isPortrait ? '100%' : '120%', 
                overflow: 'visible',
                transform: isMicro ? `scale(${Math.max(0.8, width/480)})` : 'none',
                willChange: 'transform'
            }}>
                <defs>
                    <marker id="arrowhead-master" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                        <path d="M0,0 L0,10 L10,5 z" fill="rgba(255,255,255,0.3)" />
                    </marker>
                    <linearGradient id="marker-copper" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#d4af37' }} />
                        <stop offset="50%" style={{ stopColor: '#b8860b' }} />
                        <stop offset="100%" style={{ stopColor: '#4b3c00' }} />
                    </linearGradient>
                    <pattern id="marker-grid" width="8" height="8" patternUnits="userSpaceOnUse">
                        <circle cx="1.5" cy="1.5" r="0.8" fill="rgba(255,255,255,0.15)" />
                    </pattern>
                </defs>

                <style>{`
                    @keyframes eco-pulse-ring { 
                        0% { transform: scale(0); opacity: 0; }
                        10% { opacity: 0.8; }
                        100% { transform: scale(1.3); opacity: 0; } 
                    }
                    @keyframes eco-rotate-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    @keyframes eco-marker-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
                    .playable-pulse { 
                        animation: eco-pulse-ring 2s infinite cubic-bezier(0.25, 0.46, 0.45, 0.94); 
                        transform-origin: center;
                        transform-box: fill-box;
                    }
                    .marker-rotate { 
                        animation: eco-rotate-slow 30s linear infinite; 
                        transform-origin: center;
                        transform-box: fill-box;
                    }
                    .marker-float { animation: eco-marker-float 3s ease-in-out infinite; }
                `}</style>

                {items.map((item, i) => {
                    const pos = getPos(i);
                    const nextPos = getPos((i + 1) % 6);
                    const isCurrent = item.k === currentRealm;
                    const isPlayable = playableRealms.includes(item.k);
                    const rData = REALMS[item.k];
                    
                    const dx = nextPos.x - pos.x;
                    const dy = nextPos.y - pos.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    const margin = mBase * 0.52;
                    const startX = pos.x + (dx / dist) * margin;
                    const startY = pos.y + (dy / dist) * margin;
                    const endX = nextPos.x - (dx / dist) * margin;
                    const endY = nextPos.y - (dy / dist) * margin;

                    return (
                        <g key={item.k}>
                            <line
                                x1={startX} y1={startY} x2={endX} y2={endY}
                                stroke="rgba(255,255,255,0.15)"
                                strokeWidth={isPortrait ? 1.5 : 2.5}
                                markerEnd="url(#arrowhead-master)"
                            />

                            <g transform={`translate(${pos.x}, ${pos.y})`}>
                                {isPlayable && (
                                    <g>
                                        <circle r={mBase * 0.6} fill="none" stroke={rData.bright} strokeWidth="3.5" className="playable-pulse" style={{ animationDelay: '0s' }} />
                                        <circle r={mBase * 0.6} fill="none" stroke={rData.bright} strokeWidth="2.2" className="playable-pulse" style={{ animationDelay: '0.6s' }} />
                                        <circle r={mBase * 0.6} fill="none" stroke={rData.bright} strokeWidth="1.2" className="playable-pulse" style={{ animationDelay: '1.2s' }} />
                                    </g>
                                )}
                                
                                <g className={isCurrent ? "marker-float" : ""}>
                                    {rData.theme === 'steam' && (
                                        <rect x={-mBase/2} y={-mBase/2} width={mBase} height={mBase} rx={isPortrait ? 4 : 8} fill="url(#marker-copper)" stroke="#3d2616" strokeWidth="1" />
                                    )}
                                    {rData.theme === 'fantasy' && (
                                        <g>
                                            <circle r={mBase * 0.52} fill="none" stroke={rData.bright} strokeWidth="1" strokeDasharray="4 4" className="marker-rotate" opacity="0.4" />
                                            <circle r={mBase * 0.45} fill="rgba(0,0,0,0.6)" stroke={rData.bright} strokeWidth="1.5" />
                                        </g>
                                    )}
                                    {rData.theme === 'cyber' && (
                                        <path d={`M0 -${mBase*0.52} L${mBase*0.45} -${mBase*0.26} L${mBase*0.45} ${mBase*0.26} L0 ${mBase*0.52} L-${mBase*0.45} ${mBase*0.26} L-${mBase*0.45} -${mBase*0.26} Z`} fill="rgba(0,0,0,0.7)" stroke={rData.bright} strokeWidth="2" />
                                    )}

                                    <g transform={`translate(0, -${isPortrait ? 8 : 14})`}>
                                        <MarkerIcon r={item.k} color={isCurrent ? "#fff" : rData.bright} scale={mScale} />
                                    </g>
                                    
                                    <text
                                        y={isPortrait ? 32 : 50}
                                        fill={isCurrent ? "#fff" : "rgba(255,255,255,0.95)"}
                                        fontSize={fontSize}
                                        fontWeight="900"
                                        textAnchor="middle"
                                        style={{ fontFamily: 'Orbitron, sans-serif', paintOrder: 'stroke', stroke: '#000', strokeWidth: isPortrait ? '3px' : '5px' }}
                                    >
                                        {item.n}
                                    </text>
                                </g>
                            </g>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

// currentRealm、playableRealms、isReversedが変わった時だけ再描画
export default React.memo(CycleDiagramSmall, (prev, next) => {
    if (prev.currentRealm !== next.currentRealm) return false;
    if (prev.isReversed !== next.isReversed) return false;
    if (prev.playableRealms.length !== next.playableRealms.length) return false;
    if (!prev.playableRealms.every((r, i) => r === next.playableRealms[i])) return false;
    return true;
});
