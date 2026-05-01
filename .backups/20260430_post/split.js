const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(indexPath, 'utf-8');

const styleStart = content.indexOf('<style>') + 7;
const styleEnd = content.indexOf('</style>');
const cssContent = content.substring(styleStart, styleEnd).trim();

const scriptStartMatch = content.match(/<script type="text\/babel"[^>]*>/);
const scriptStart = scriptStartMatch.index + scriptStartMatch[0].length;
const scriptEnd = content.indexOf('</script>', scriptStart);
const jsContent = content.substring(scriptStart, scriptEnd).trim();

fs.mkdirSync(path.join(__dirname, 'src'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'src', 'index.css'), cssContent, 'utf-8');

const imports = `import React, { useState, useEffect, useRef } from 'react';\nimport io from 'socket.io-client';\nimport './index.css';\n\n`;
fs.writeFileSync(path.join(__dirname, 'src', 'App.jsx'), imports + jsContent + '\n\nexport default App;\n', 'utf-8');

console.log('Successfully extracted CSS to src/index.css and JS to src/App.jsx');
