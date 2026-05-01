import React from 'react';
const REALMS = { GEAR: { n: '歯車', color: '#00ffcc', bright: '#88ffff' }, ICEAGE: { n: '氷河期', color: '#00ccff', bright: '#88eeff' }, FOUNTAIN: { n: '噴水', color: '#3366ff', bright: '#88aaff' }, BATTERY: { n: '電池', color: '#ffcc00', bright: '#ffee88' }, MACHINE: { n: '機械', color: '#ff6600', bright: '#ffaa88' }, ARCHIVE: { n: '古文書', color: '#cc00ff', bright: '#ee88ff' }, PLANET: { n: '惑星', color: '#ffffff', bright: '#ffffff' }, RUINS: { n: '廃墟', color: '#aaaaaa', bright: '#dddddd' } };

const CardView = ({ card, playable, onClick, isField, isSelected, isMyTurn })
export default CardView;
