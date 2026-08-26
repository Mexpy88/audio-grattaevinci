import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('master-panel-minimize-v2.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(src,/master-panel-min-v2\.1-freezefix1/);
assert.match(src,/lmPanelMinimized/);
assert.match(src,/MASTER EXCEL · PRONTO/);
assert.match(src,/setMinimized\(true/);
assert.match(src,/DA ESPORTARE/);
assert.match(index,/master-panel-minimize-v2\.js/);
assert.match(index,/managerial-v2-polish\.js/);
assert.match(index,/fastboot1/);

// Regression guard: refresh must not rewrite text/classes on every observer callback.
assert.match(src,/if\(el&&el\.textContent!==next\)el\.textContent=next/);
assert.match(src,/if\(el&&el\.classList\.contains\(name\)!==!!on\)el\.classList\.toggle/);

// The observer is bootstrap-only: once the panel exists it must disconnect.
assert.match(src,/waitObserver\.disconnect\(\);waitObserver=null/);
assert.doesNotMatch(src,/new MutationObserver\(\(\)=>\{ensure\(\);refresh\(\)\}\)/);

console.log('master panel minimize V2 freeze regression OK');
