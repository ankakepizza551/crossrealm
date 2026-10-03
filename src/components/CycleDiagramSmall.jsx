import React, { useState, useEffect, useRef } from 'react';
import { RealmIconPaths } from './realmIcons';

const REALMS = {
    GEAR: { n: '歯車', color: '#FF8C00', bright: '#FFD700', theme: 'steam' },
    ARCHIVE: { n: '古文書', color: '#FF3131', bright: '#FF6347', theme: 'steam' },
    FOUNTAIN: { n: '噴水', color: '#0047FF', bright: '#6699FF', theme: 'fantasy' },
    ICEAGE: { n: '氷河期', color: '#00F3FF', bright: '#ADFCFF', theme: 'fantasy' },
    MACHINE: { n: '機械', color: '#E2B0FF', bright: '#DDA0DD', theme: 'cyber' },
    BATTERY: { n: '電池', color: '#ADFF2F', bright: '#7FFF00', theme: 'cyber' }
};

// アイコンはカードと共通（realmIcons.jsx）。24x24 の絵を中心 (0,0) に合わせて描く
const MarkerIcon = ({ r, color, spec = false, scale = 1 }) => (
    <g transform={`scale(${scale}) translate(-12 -12)`} style={{ color }} fill="none" stroke="currentColor"
        strokeWidth={spec ? 2.8 : 2.2} strokeLinecap="round" strokeLinejoin="round">
        <RealmIconPaths r={r} />
    </g>
);

// 中心 (0,0)・外接半径 r の縦長六角形
const hexPath = (r) => {
    const pts = [-90, -30, 30, 90, 150, 210].map(a => `${(r * Math.cos(a * Math.PI / 180)).toFixed(1)} ${(r * Math.sin(a * Math.PI / 180)).toFixed(1)}`);
    return `M${pts.join(' L')} Z`;
};

const CycleDiagramSmall = ({ currentRealm, playableRealms = [], isReversed, isMyTurn = true }) => {
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

    const mScale = isPortrait ? (isMicro ? 1.6 : (isMedium ? 1.7 : 2.0)) : 3.3;
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
                    // 形は世界観ごとに残し、質感（暗い地＋属性色の太枠）をそろえる。今の場は属性色で塗る
                    const nodeFill = isCurrent ? `${rData.color}50` : 'rgba(10,6,24,0.88)';
                    const nodeStroke = isCurrent ? 4 : 2.5;
                    
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
                                {/* 出せる場: 自分の番は広がる光の輪、ほかの人の番は薄く動かない輪（次の展開は読めるが、操作の合図と紛れないように） */}
                                {isPlayable && isMyTurn && (
                                    <g>
                                        <circle r={mBase * 0.6} fill="none" stroke={rData.bright} strokeWidth="3.5" className="playable-pulse" style={{ animationDelay: '0s' }} />
                                        <circle r={mBase * 0.6} fill="none" stroke={rData.bright} strokeWidth="2.2" className="playable-pulse" style={{ animationDelay: '0.6s' }} />
                                        <circle r={mBase * 0.6} fill="none" stroke={rData.bright} strokeWidth="1.2" className="playable-pulse" style={{ animationDelay: '1.2s' }} />
                                    </g>
                                )}
                                {isPlayable && !isMyTurn && (
                                    <circle r={mBase * 0.6} fill="none" stroke={rData.bright} strokeWidth="1.5" opacity="0.35" />
                                )}
                                
                                <g className={isCurrent ? "marker-float" : ""}>
                                    {/* 今の場: 外側の白い点線リング */}
                                    {isCurrent && (
                                        <circle r={mBase * 0.66} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6 6" opacity="0.9" />
                                    )}
                                    {rData.theme === 'steam' && (
                                        <g>
                                            <rect x={-mBase * 0.48} y={-mBase * 0.48} width={mBase * 0.96} height={mBase * 0.96} rx={mBase * 0.08} fill={nodeFill} stroke="#d4af37" strokeWidth={nodeStroke} />
                                            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => (
                                                <circle key={`${sx}${sy}`} cx={sx * mBase * 0.38} cy={sy * mBase * 0.38} r={mBase * 0.03} fill="#d4af37" />
                                            ))}
                                        </g>
                                    )}
                                    {rData.theme === 'fantasy' && (
                                        <g>
                                            <circle r={mBase * 0.52} fill="none" stroke={rData.bright} strokeWidth="1" strokeDasharray="4 4" className="marker-rotate" opacity="0.6" />
                                            <circle r={mBase * 0.46} fill={nodeFill} stroke={rData.bright} strokeWidth={nodeStroke} />
                                        </g>
                                    )}
                                    {rData.theme === 'cyber' && (
                                        <g>
                                            <path d={hexPath(mBase * 0.54)} fill={nodeFill} stroke={rData.bright} strokeWidth={nodeStroke} />
                                            <path d={hexPath(mBase * 0.46)} fill="none" stroke={rData.bright} strokeWidth="1" opacity="0.5" />
                                        </g>
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
    if (prev.isMyTurn !== next.isMyTurn) return false;
    if (prev.playableRealms.length !== next.playableRealms.length) return false;
    if (!prev.playableRealms.every((r, i) => r === next.playableRealms[i])) return false;
    return true;
});
