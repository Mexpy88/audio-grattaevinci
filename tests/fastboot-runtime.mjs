import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');

assert.match(index,/fastBootPreload/);
assert.match(index,/const V='20260826-fastboot1'/);
assert.match(index,/rel='preload'/);
assert.match(index,/l\.as=as/);
assert.match(index,/logo\.as='image'/);
assert.match(index,/preconnect[^>]*cdn\.jsdelivr\.net/);

for(const name of [
  'modifica.js','local-master.js','local-master-ooxml.js','super-ux.js',
  'request-cartons.js','master-generation-guard-v2.js','managerial-v2.js',
  'managerial-v2-polish.js','master-panel-minimize-v2.js','ux-polish-v3.js','sticky-top-back.js'
]) assert.match(index,new RegExp(name.replaceAll('.','\\.')),'Missing preload/runtime reference for '+name);

// Runtime execution order remains the existing sequential await chain.
assert.match(index,/await addScript\(d,'stockEditJs'/);
assert.match(index,/await addScript\(d,'stickyTopBackJs'/);
assert.ok(index.indexOf("await addScript(d,'stockEditJs'") < index.indexOf("await addScript(d,'stickyTopBackJs'"));

// Remove the old fixed 100 ms delay; finalization still waits for a paint.
assert.doesNotMatch(index,/setTimeout\(resolve,100\)/);
assert.match(index,/await new Promise\(resolve=>requestAnimationFrame\(resolve\)\)/);
assert.match(index,/await nextPaint\(\);\s*revealApp\(\);/s);
assert.match(index,/__WAREHOUSE_BOOT_MS/);

console.log('FASTBOOT preload runtime OK');
