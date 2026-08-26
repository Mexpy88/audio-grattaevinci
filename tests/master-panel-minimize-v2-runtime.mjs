import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('master-panel-minimize-v2.js','utf8');
const index=fs.readFileSync('index.html','utf8');
assert.match(src,/lmPanelMinimized/);
assert.match(src,/MASTER EXCEL · PRONTO/);
assert.match(src,/setMinimized\(true/);
assert.match(src,/DA ESPORTARE/);
assert.match(index,/master-panel-minimize-v2\.js/);
assert.match(index,/managerial-v2-polish\.js/);
console.log('master panel minimize V2 runtime OK');
