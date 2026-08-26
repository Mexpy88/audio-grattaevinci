import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('stock-control-assisted-v3.js','utf8');
assert.match(src,/stock-control-assisted3/);
assert.match(src,/CONTEGGIO ASSISTITO/);
assert.match(src,/＋ TROVATO/);
assert.match(src,/partials/);
assert.match(src,/addCountPartialV3/);
assert.match(src,/markCountZeroV3/);
assert.match(src,/grouped\(assistDraft\)/);
assert.match(src,/toneA/);
assert.match(src,/toneB/);
assert.match(src,/renderStockEditRows=function/);
assert.match(src,/AGGIUNGI TAGLIA \/ STATO/);
assert.match(src,/confirmPhysicalCountAssistV3/);
assert.match(src,/VERIFICA_FISICA/);
assert.match(src,/Se è la stessa merce ubicata male/);
console.log('stock control assisted V3 runtime OK');