import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('ux-polish-v3.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(src,/2026\.08\.27-ux-polish-v3/);
assert.match(src,/#E7F6EE/,'CARICA must use delicate green');
assert.match(src,/#FDEBEA/,'SCARICA must use delicate red');
assert.match(src,/#FFF6D8/,'SPOSTA must use delicate yellow');
assert.match(src,/#E8F4FC/,'CERCA must use delicate light blue');
assert.match(src,/#FFF0E2/,'RETTIFICA\/VERIFICA must use delicate orange');
assert.match(src,/masterInput/);
assert.match(src,/closest\?\.\('#registryScreen \.card'\)/);
assert.match(src,/mgrRegistryMasterDuplicate/);
assert.match(src,/display:none!important/);
assert.match(src,/loadFinalHardening/);
assert.doesNotMatch(src,/card\.remove\(\)/,'Registry Master card must stay in DOM for LocalMaster input reuse');
assert.match(index,/ux-polish-v3\.js/);

console.log('UX polish V3 runtime OK');
