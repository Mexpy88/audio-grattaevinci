import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');

assert.match(index,/fastBootPreload/);
assert.match(index,/const V='20260827-firstpaint1'/);
assert.match(index,/rel='preload'/);
assert.match(index,/l\.as=as/);
assert.match(index,/logo\.as='image'/);
assert.match(index,/preconnect[^>]*cdn\.jsdelivr\.net/);

for(const name of [
  'modifica.js','local-master.js','local-master-ooxml.js','super-ux.js',
  'request-cartons.js','master-generation-guard-v2.js','managerial-v2.js',
  'managerial-v2-polish.js','master-panel-minimize-v2.js','ux-polish-v3.js','sticky-top-back.js',
  'final-ux-hardening-v1.js'
]) assert.match(index,new RegExp(name.replaceAll('.','\\.')),'Missing preload/runtime reference for '+name);

// Runtime execution order remains sequential; final hardening is last.
assert.match(index,/await addScript\(d,'stockEditJs'/);
assert.match(index,/await addScript\(d,'stickyTopBackJs'/);
assert.match(index,/await addScript\(d,'finalUxHardeningV1Js'/);
assert.ok(index.indexOf("await addScript(d,'stockEditJs'") < index.indexOf("await addScript(d,'stickyTopBackJs'"));
assert.ok(index.indexOf("await addScript(d,'stickyTopBackJs'") < index.indexOf("await addScript(d,'finalUxHardeningV1Js'"));

assert.doesNotMatch(index,/setTimeout\(resolve,100\)/);
assert.match(index,/await new Promise\(resolve=>requestAnimationFrame\(resolve\)\)/);
assert.match(index,/await nextPaint\(\);markAppReady\(\);/);
assert.match(index,/__WAREHOUSE_BOOT_MS/);
assert.match(index,/requestAccess/);

console.log('FASTBOOT access-first preload runtime OK');
