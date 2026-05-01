const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.jsx');
let content = fs.readFileSync(appPath, 'utf-8');

function extractComponent(name) {
    const regex = new RegExp(`const\\s+${name}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*{[\\s\\S]*?^};`, 'm');
    const match = content.match(regex);
    if (match) {
        let compCode = match[0];
        content = content.replace(compCode, '');
        return compCode;
    }
    return null;
}

const comps = ['CardView', 'ComplexEmblem', 'CycleDiagramSmall'];
const outDir = path.join(__dirname, 'src', 'components');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

let importsForApp = '';

comps.forEach(c => {
    // try different regex if first one fails because of inner blocks or different formatting
    // A simpler way since these components are well-known:
    // We can just use split or substring if regex fails
});

// Actually, since React component extraction by regex is brittle due to nested braces, 
// let's do a simple brace counting parser.

function extractWithBraceCounting(name) {
    const declStr = `const ${name} = (`;
    const startIdx = content.indexOf(declStr);
    if (startIdx === -1) return null;
    
    let braceCount = 0;
    let foundFirstBrace = false;
    let endIdx = -1;
    
    for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '{') {
            braceCount++;
            foundFirstBrace = true;
        } else if (content[i] === '}') {
            braceCount--;
        }
        
        if (foundFirstBrace && braceCount === 0) {
            endIdx = i + 1;
            // might have trailing semicolon
            if (content[endIdx] === ';') endIdx++;
            break;
        }
    }
    
    if (endIdx !== -1) {
        const compStr = content.substring(startIdx, endIdx);
        content = content.replace(compStr, '');
        return compStr;
    }
    return null;
}

comps.forEach(c => {
    const compStr = extractWithBraceCounting(c);
    if (compStr) {
        let compFile = `import React from 'react';\n\n`;
        // CardView uses REALMS
        if (c === 'CardView') {
            compFile += `const REALMS = { GEAR: { n: '歯車', color: '#00ffcc', bright: '#88ffff' }, ICEAGE: { n: '氷河期', color: '#00ccff', bright: '#88eeff' }, FOUNTAIN: { n: '噴水', color: '#3366ff', bright: '#88aaff' }, BATTERY: { n: '電池', color: '#ffcc00', bright: '#ffee88' }, MACHINE: { n: '機械', color: '#ff6600', bright: '#ffaa88' }, ARCHIVE: { n: '古文書', color: '#cc00ff', bright: '#ee88ff' }, PLANET: { n: '惑星', color: '#ffffff', bright: '#ffffff' }, RUINS: { n: '廃墟', color: '#aaaaaa', bright: '#dddddd' } };\n\n`;
        }
        if (c === 'CycleDiagramSmall') {
            compFile += `const REALMS = { GEAR: { n: '歯車', color: '#00ffcc', bright: '#88ffff' }, ICEAGE: { n: '氷河期', color: '#00ccff', bright: '#88eeff' }, FOUNTAIN: { n: '噴水', color: '#3366ff', bright: '#88aaff' }, BATTERY: { n: '電池', color: '#ffcc00', bright: '#ffee88' }, MACHINE: { n: '機械', color: '#ff6600', bright: '#ffaa88' }, ARCHIVE: { n: '古文書', color: '#cc00ff', bright: '#ee88ff' }, PLANET: { n: '惑星', color: '#ffffff', bright: '#ffffff' }, RUINS: { n: '廃墟', color: '#aaaaaa', bright: '#dddddd' } };\n\n`;
        }
        compFile += compStr + `\n\nexport default ${c};\n`;
        fs.writeFileSync(path.join(outDir, `${c}.jsx`), compFile, 'utf-8');
        importsForApp += `import ${c} from './components/${c}.jsx';\n`;
        console.log(`Extracted ${c}.jsx`);
    } else {
        console.log(`Could not extract ${c}`);
    }
});

// Update App.jsx
// Need to insert imports after the existing imports
const importIdx = content.lastIndexOf('import ');
let endOfImports = content.indexOf('\\n', importIdx);
if (endOfImports === -1) endOfImports = content.indexOf(';', importIdx) + 1;
if (endOfImports === 0) endOfImports = 0; // fallback

content = importsForApp + '\\n' + content;
fs.writeFileSync(appPath, content, 'utf-8');
console.log('App.jsx updated.');
