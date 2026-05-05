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
                transform: isMicro ? `scale(${Math.max(0.8, width/480)})` : 'none', // 極小時はSVG自体も少し縮小
                willChange: 'transform', // GPU最適化
                backfaceVisibility: 'hidden' // アンチエイリアス改善
            }}>
                <defs>
                    <marker id="arrowhead-master" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                        <path d="M0,0 L0,10 L10,5 z" fill="rgba(255,255,255,0.4)" />
                    </marker>
                    <linearGradient id="marker-copper" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#f69d3c' }} />
                        <stop offset="40%" style={{ stopColor: '#fff', stopOpacity: 0.8 }} />
                        <stop offset="50%" style={{ stopColor: '#eb5e28' }} />
                        <stop offset="100%" style={{ stopColor: '#251605' }} />
                    </linearGradient>
                    <linearGradient id="marker-silver" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#fff', stopOpacity: 0.9 }} />
                        <stop offset="50%" style={{ stopColor: 'rgba(255,255,255,0.2)' }} />
                        <stop offset="100%" style={{ stopColor: '#fff', stopOpacity: 0.9 }} />
                    </linearGradient>
                    <pattern id="marker-grid" width="8" height="8" patternUnits="userSpaceOnUse">
                        <circle cx="1.5" cy="1.5" r="0.8" fill="rgba(255,255,255,0.25)" />
                    </pattern>
                    <filter id="marker-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>
                </defs>

                <style>{`
                    @keyframes marker-rotate-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    @keyframes marker-flicker { 0%, 100% { opacity: 1; } 92% { opacity: 1; } 93% { opacity: 0.7; } 95% { opacity: 0.4; } 96% { opacity: 1; } }
                    @keyframes marker-scanline { from { transform: translateY(-${mBase/2}px); } to { transform: translateY(${mBase/2}px); } }
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
                                stroke="rgba(255,255,255,0.25)"
                                strokeWidth={isPortrait ? 1.5 : 2.5}
                                markerEnd="url(#arrowhead-master)"
                            />

                            <g transform={`translate(${pos.x}, ${pos.y})`} style={{ opacity: isCurrent ? 1 : 0.85 }}>
                                {isPlayable && !isCurrent && (
                                    <animateTransform attributeName="transform" type="scale" from="1" to="1.12" dur="0.8s" repeatCount="indefinite" additive="sum" />
                                )}
                                {rData.theme === 'steam' && (
                                    <g>
                                        <rect x={-mBase/2} y={-mBase/2} width={mBase} height={mBase} rx={isPortrait ? 6 : 10} fill="url(#marker-copper)" stroke="#3d2616" strokeWidth={isPortrait ? 1.5 : 2.5} />
                                        <circle cx={-mBase*0.4} cy={-mBase*0.4} r={isPortrait ? 2.5 : 4} fill="#251605" />
                                        <circle cx={mBase*0.4} cy={-mBase*0.4} r={isPortrait ? 2.5 : 4} fill="#251605" />
                                        <circle cx={-mBase*0.4} cy={mBase*0.4} r={isPortrait ? 2.5 : 4} fill="#251605" />
                                        <circle cx={mBase*0.4} cy={mBase*0.4} r={isPortrait ? 2.5 : 4} fill="#251605" />
                                    </g>
                                )}
                                {rData.theme === 'fantasy' && (
                                    <g>
                                        <g style={{ animation: 'marker-rotate-slow 30s linear infinite' }}>
                                            <circle r={mBase * 0.55} fill="none" stroke="url(#marker-silver)" strokeWidth={isPortrait ? 1 : 1.5} strokeDasharray={isPortrait ? "4 8" : "6 12"} opacity="0.5" />
                                        </g>
                                        <circle r={mBase * 0.45} fill={isCurrent ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.6)"} stroke={rData.bright} strokeWidth={isPortrait ? 2 : 3} filter="url(#marker-glow)" />
                                    </g>
                                )}
                                {rData.theme === 'cyber' && (
                                    <g style={{ animation: 'marker-flicker 6s infinite' }}>
                                        <path d={`M0 -${mBase*0.55} L${mBase*0.48} -${mBase*0.28} L${mBase*0.48} ${mBase*0.28} L0 ${mBase*0.55} L-${mBase*0.48} ${mBase*0.28} L-${mBase*0.48} -${mBase*0.28} Z`} fill="url(#marker-grid)" stroke={rData.bright} strokeWidth={isPortrait ? 2 : 3.5} />
                                        <rect x={-mBase*0.48} y={-mBase*0.55} width={mBase*0.96} height={isPortrait ? 2 : 3} fill="rgba(255,255,255,0.3)" style={{ animation: 'marker-scanline 2s linear infinite' }} />
                                    </g>
                                )}

                                <g transform={`translate(0, -${isPortrait ? 8 : 14})`}>
                                    <MarkerIcon r={item.k} color={isCurrent ? "#fff" : rData.bright} scale={mScale} />
                                </g>
                                <text
                                    y={isPortrait ? 32 : 50}
                                    fill={isCurrent ? "#fff" : "rgba(255,255,255,1)"}
                                    fontSize={fontSize}
                                    fontWeight="1000"
                                    textAnchor="middle"
                                    style={{ letterSpacing: isPortrait ? '1px' : '3px', paintOrder: 'stroke', stroke: '#000', strokeWidth: isPortrait ? 3 : 5, fontFamily: 'Orbitron, sans-serif' }}
                                >
                                    {item.n}
                                </text>
                                
                                {isCurrent && (
                                    <circle r={mBase * 0.65} fill="none" stroke={rData.bright} strokeWidth={isPortrait ? 2 : 3} strokeDasharray="6 6" opacity="0.6">
                                        <animate attributeName="r" from={mBase * 0.55} to={mBase * 0.75} dur="1.5s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
                                    </circle>
                                )}
                                {isPlayable && !isCurrent && (
                                    <>
                                        <circle r={mBase * 0.7} fill="none" stroke={rData.bright} strokeWidth={isPortrait ? 3 : 4.5} opacity="1">
                                            <animate attributeName="r" from={mBase * 0.6} to={mBase * 0.9} dur="1.2s" repeatCount="indefinite" />
                                            <animate attributeName="opacity" from="1" to="0" dur="1.2s" repeatCount="indefinite" />
                                        </circle>
                                        <circle r={mBase * 0.6} fill="none" stroke={rData.bright} strokeWidth={isPortrait ? 2.5 : 3.5} opacity="0.9">
                                            <animate attributeName="opacity" from="0.9" to="0.3" dur="0.8s" repeatCount="indefinite" />
                                        </circle>
                                    </>
                                )}
                            </g>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

export default React.memo(CycleDiagramSmall);
