import fs from 'node:fs';
import assert from 'node:assert/strict';

const grouped=fs.readFileSync('stock-rectification-grouped-ux-v1.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const polish=fs.readFileSync('managerial-v2-polish.js','utf8');
const sounds=fs.readFileSync('validation-sounds.js','utf8');

assert.match(grouped,/WarehouseDirectRectificationGroupedV1/);
assert.match(grouped,/stockEditRowsDraft/);
assert.match(grouped,/groupRows\(\)/);
assert.match(grouped,/srgArticleGroup/);
assert.match(grouped,/toneA/);
assert.match(grouped,/toneB/);
assert.match(grouped,/AGGIUNGI TAGLIA \/ STATO/);
assert.match(grouped,/ELIMINA/);
assert.match(grouped,/RIPRISTINA/);
assert.match(grouped,/QUANTITÀ/);
assert.match(grouped,/STATO/);
assert.match(grouped,/TAGLIA/);
assert.match(grouped,/POSIZIONE/);
assert.match(grouped,/renderStockEditRows/);
assert.ok(!/window\.saveStockEdit\s*=/.test(grouped),'Grouped UX must not replace the stable rectification save engine');
assert.ok(!/db\.rectifications/.test(grouped),'Grouped UX must not write rectification data directly');

assert.match(grouped,/#fff0e3/i);
assert.match(grouped,/#e6f5f3/i);
assert.notEqual('#fff0e3','#e6f5f3');

assert.match(index,/\.bootCard\{[^}]*opacity:0;visibility:hidden/s);
assert.match(index,/\.bootCard\.logoReady\{opacity:1;visibility:visible\}/);
assert.match(index,/onload="this\.parentElement\.classList\.add\('logoReady'\)"/);
assert.match(index,/stock-rectification-grouped-ux-v1\.js/);
assert.match(index,/WarehouseDirectRectificationGroupedV1\?\.install/);

assert.match(polish,/loadGroupedRectificationV1/);
assert.match(polish,/stock-rectification-grouped-ux-v1\.js/);
assert.match(polish,/loadAssistedStockControl\(\);loadGroupedRectificationV1\(\)/);

assert.match(sounds,/safe-sounds4-louder-success/);
assert.match(sounds,/0\.07/);
assert.match(sounds,/0\.075/);

console.log('Grouped direct rectification + splash integrity OK');
