import React from 'react';

// 属性アイコンの絵柄（24x24 の座標・currentColor で描く）。
// カード・ターン表示（App.jsx の IconRenderer）とサイクル図（CycleDiagramSmall）で共通に使う。
const F = { fill: 'currentColor', stroke: 'none' };

const gearTeeth = (n, r, w) => [...Array(n)].map((_, i) => (
    <rect key={i} x={12 - w / 2} y={12 - r} width={w} height="4" rx="0.6" {...F} transform={`rotate(${(i * 360) / n} 12 12)`} />
));

export const REALM_ICON_PATHS = {
    // 歯のある輪
    GEAR: () => <>
        {gearTeeth(10, 10.5, 2.6)}
        <circle cx="12" cy="12" r="6.8" />
        <circle cx="12" cy="12" r="2.4" />
    </>,
    // 巻物
    ARCHIVE: () => <>
        <path d="M6 4h11a2 2 0 0 1 2 2v12" />
        <path d="M4 6a2 2 0 1 1 4 0v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1H10v1a2 2 0 0 1-4 0" />
        <path d="M11 8h5 M11 11h5 M11 14h3" strokeWidth="1.6" />
    </>,
    // しずく（従来どおり）
    FOUNTAIN: () => <>
        <path d="M12 19c3.8 0 7-3.2 7-7 0-4.5-7-10-7-10S5 7.5 5 12c0 3.8 3.2 7 7 7z" />
        <path d="M12 16c2 0 3.5-1.5 3.5-3.5 0-2.5-3.5-5.5-3.5-5.5S8.5 10 8.5 12.5c0 2 1.5 3.5 3.5 3.5z" {...F} />
    </>,
    // 雪の結晶
    ICEAGE: () => <>
        {[0, 60, 120].map(a => (
            <g key={a} transform={`rotate(${a} 12 12)`}>
                <path d="M12 2v20" />
                <path d="M9.5 4.5L12 7l2.5-2.5 M9.5 19.5L12 17l2.5 2.5" />
            </g>
        ))}
    </>,
    // チップ
    MACHINE: () => <>
        <rect x="6" y="6" width="12" height="12" rx="1.5" />
        <rect x="9.5" y="9.5" width="5" height="5" {...F} />
        <path d="M9 2.5v3.5 M12 2.5v3.5 M15 2.5v3.5 M9 18v3.5 M12 18v3.5 M15 18v3.5 M2.5 9h3.5 M2.5 12h3.5 M2.5 15h3.5 M18 9h3.5 M18 12h3.5 M18 15h3.5" />
    </>,
    // 電池＋稲妻
    BATTERY: () => <>
        <rect x="6" y="4" width="12" height="18" rx="2" />
        <path d="M10 2h4" />
        <path d="M13 8l-3 5h4l-3 5" />
    </>,
    // 輪のある惑星
    PLANET: () => <>
        <circle cx="12" cy="12" r="6.5" />
        <ellipse cx="12" cy="12" rx="11" ry="3.6" transform="rotate(-20 12 12)" />
    </>,
    // 崩れた柱
    RUINS: () => <>
        <path d="M2 21h20" />
        <path d="M4 21V9h4v12 M3 9h6" />
        <path d="M10 21v-7h4v7 M9 14h6" />
        <path d="M16 21V6l1.5 1.5L19 5.5 20 8v13" />
        <path d="M3 6l3-2 3 2" opacity="0.6" />
    </>,
};

// カード左上のジャンルの印（スチーム／幻想／サイバー／ワイルド）
export const GENRE_MARK_PATHS = {
    steam: () => <>
        <circle cx="12" cy="12" r="6" />
        {[...Array(6)].map((_, i) => <rect key={i} x="11" y="2.5" width="2" height="4" {...F} transform={`rotate(${i * 60} 12 12)`} />)}
    </>,
    fantasy: () => <path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.6h7.6z" {...F} />,
    cyber: () => <>
        <polygon points="12 2 21 7 21 17 12 22 3 17 3 7" />
        <circle cx="12" cy="12" r="3" {...F} />
    </>,
    wild: () => <>
        <circle cx="12" cy="12" r="7" />
        <ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-20 12 12)" />
    </>,
};

export const RealmIconPaths = ({ r }) => {
    const draw = REALM_ICON_PATHS[r];
    return draw ? draw() : null;
};
