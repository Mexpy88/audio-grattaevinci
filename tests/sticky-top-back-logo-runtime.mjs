import fs from 'node:fs';
import assert from 'node:assert/strict';

const nav=fs.readFileSync('sticky-top-back.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(fs.existsSync('logo-transparent.png'),'Transparent logo asset must exist');
assert.match(index,/logo-transparent\.png\?v=/);
assert.doesNotMatch(index,/logo-full\.svg\?v=20260814-0756/);
assert.match(index,/sticky-top-back\.js\?v=/);
assert.match(index,/WarehouseStickyTopBack\?\.install\?\.\(\)/);
assert.match(nav,/id='stickyTopBack'|id="stickyTopBack"|stickyTopBack/);
assert.match(nav,/currentScreen\(\)/);
assert.match(nav,/screen\.querySelector\(':scope > \.back'\)/);
assert.match(nav,/nativeBack\.click\(\)/);
assert.match(nav,/screen\.id==='home'/);
assert.match(nav,/body\.stickyTopBackReady main>\.screen>\.back\{display:none!important\}/);
assert.match(nav,/MutationObserver\(sync\)/);

console.log('sticky top back + transparent logo runtime OK');
