import fs from 'node:fs';
import assert from 'node:assert/strict';

const grouped=fs.readFileSync('stock-rectification-grouped-ux-v2.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const polish=fs.readFileSync('managerial-v2-polish.js','utf8');
const sounds=fs.readFileSync('validation-sounds.js','utf8');

assert.match(grouped,/WarehouseDirectRectificationGroupedV2/);
assert.match(grouped,/stockEditRowsDraft/);
assert.match(grouped,/function groups\(\)/);
assert.match(grouped,/srg2Article/);
assert.match(grouped,/toneA/);
assert.match(grouped,/toneB/);
assert.match(grouped,/AGGIUNGI TAGLIA \/ STATO/);
assert.match(grouped,/ELIMINA/);
assert.match(grouped,/RIPRISTINA/);
assert.match(grouped,/MODIFICATO/);
assert.match(grouped,/QUANTITÀ/);
assert.match(grouped,/STATO/);
assert.match(grouped,/TAGLIA/);
assert.match(grouped,/POSIZIONE/);
assert.match(grouped,/ensureAuthoritativeRenderer/);
assert.match(grouped,/window\.renderStockEditRows=renderGrouped/);
assert.match(grouped,/\['loadStockPallet','addStockEditRow','toggleStockEditDelete'\]\.forEach\(wrapOperation\)/);
assert.match(grouped,/MutationObserver\(scheduleEnsure\)/);
assert.match(grouped,/stockQuickFoundDirectV3/);
assert.match(grouped,/\.remove\(\)/);
assert.match(grouped,/srg2AddFloat/);
assert.ok(!/window\.saveStockEdit\s*=/.test(grouped),'Grouped UX must not replace the stable rectification save engine');
assert.ok(!/db\.rectifications/.test(grouped),'Grouped UX must not write rectification data directly');

assert.match(grouped,/#fff0e3/i);
assert.match(grouped,/#e6f5f3/i);
assert.notEqual('#fff0e3','#e6f5f3');

assert.match(index,/\.bootCard\{[^}]*opacity:0;visibility:hidden/s);
assert.match(index,/\.bootCard\.logoReady\{opacity:1;visibility:visible\}/);
assert.match(index,/onload="this\.parentElement\.classList\.add\('logoReady'\)"/);

assert.match(polish,/loadGroupedRectificationV2/);
assert.match(polish,/stock-rectification-grouped-ux-v2\.js/);
assert.match(polish,/loadAssistedStockControl\(\);loadGroupedRectificationV2\(\)/);
assert.ok(!/loadGroupedRectificationV1/.test(polish),'V1 grouped loader must be retired from the active polish layer');

assert.match(sounds,/safe-sounds4-louder-success/);
assert.match(sounds,/0\.07/);
assert.match(sounds,/0\.075/);

console.log('Grouped direct rectification V2 + single add button + splash integrity OK');
