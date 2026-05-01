const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.jsx');
let jsContent = fs.readFileSync(appPath, 'utf-8');

// The file might already have imports at the top if it was from previous run
const importEnd = jsContent.lastIndexOf('import ');
let actualCodeStart = jsContent.indexOf(';', importEnd) + 1;
if (actualCodeStart === 0 || actualCodeStart > 1000) actualCodeStart = 0; // fallback

// Actually let's just use regex to find components directly in jsContent
const cardViewMatch = jsContent.match(/const CardView\s*=\s*\([^)]*\)\s*=>\s*{[\s\S]*?^};/m);
let cardViewCode = '';
if (cardViewMatch) {
    cardViewCode = cardViewMatch[0];
    jsContent = jsContent.replace(cardViewCode, '');
}

const complexEmblemMatch = jsContent.match(/const ComplexEmblem\s*=\s*\([^)]*\)\s*=>\s*\([\s\S]*?^\s*\);/m);
let complexEmblemCode = '';
if (complexEmblemMatch) {
    complexEmblemCode = complexEmblemMatch[0];
    jsContent = jsContent.replace(complexEmblemCode, '');
}

const cycleDiagramSmallMatch = jsContent.match(/const CycleDiagramSmall\s*=\s*\([^)]*\)\s*=>\s*\([\s\S]*?^\s*\);/m);
let cycleDiagramSmallCode = '';
if (cycleDiagramSmallMatch) {
    cycleDiagramSmallCode = cycleDiagramSmallMatch[0];
    jsContent = jsContent.replace(cycleDiagramSmallCode, '');
}

const realmsDef = `const REALMS = { GEAR: { n: '歯車', color: '#00ffcc', bright: '#88ffff' }, ICEAGE: { n: '氷河期', color: '#00ccff', bright: '#88eeff' }, FOUNTAIN: { n: '噴水', color: '#3366ff', bright: '#88aaff' }, BATTERY: { n: '電池', color: '#ffcc00', bright: '#ffee88' }, MACHINE: { n: '機械', color: '#ff6600', bright: '#ffaa88' }, ARCHIVE: { n: '古文書', color: '#cc00ff', bright: '#ee88ff' }, PLANET: { n: '惑星', color: '#ffffff', bright: '#ffffff' }, RUINS: { n: '廃墟', color: '#aaaaaa', bright: '#dddddd' } };\n\n`;

if (cardViewCode) fs.writeFileSync(path.join(__dirname, 'src/components/CardView.jsx'), `import React from 'react';\n${realmsDef}${cardViewCode}\nexport default CardView;\n`);
if (complexEmblemCode) fs.writeFileSync(path.join(__dirname, 'src/components/ComplexEmblem.jsx'), `import React from 'react';\n${complexEmblemCode}\nexport default ComplexEmblem;\n`);
if (cycleDiagramSmallCode) fs.writeFileSync(path.join(__dirname, 'src/components/CycleDiagramSmall.jsx'), `import React from 'react';\n${realmsDef}${cycleDiagramSmallCode}\nexport default CycleDiagramSmall;\n`);

// Clean up
jsContent = jsContent.replace(/const { useState, useEffect, useMemo, useRef } = React;/g, '');
jsContent = jsContent.replace(/ReactDOM\.render\(<App \/>, document\.getElementById\('root'\)\);/g, '');

// Remove old imports
jsContent = jsContent.replace(/import .*?;\n/g, '');

const newImports = `import React, { useState, useEffect, useMemo, useRef } from 'react';\nimport io from 'socket.io-client';\nimport './index.css';\nimport CardView from './components/CardView.jsx';\nimport ComplexEmblem from './components/ComplexEmblem.jsx';\nimport CycleDiagramSmall from './components/CycleDiagramSmall.jsx';\n\n`;

fs.writeFileSync(appPath, newImports + jsContent.trim() + '\n\nexport default App;\n');
console.log('Fixed extraction done.');
