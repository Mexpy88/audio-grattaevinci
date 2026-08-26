import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('managerial-v2-polish.js','utf8');
assert.match(src,/RETTIFICA/);
assert.match(src,/TROVATO NON PREVISTO/);
assert.match(src,/la stessa riga TROVATO NON PREVISTO è stata inserita più volte/);
assert.match(src,/questa giacenza è già prevista nella posizione verificata/);
console.log('managerial V2 polish runtime OK');
