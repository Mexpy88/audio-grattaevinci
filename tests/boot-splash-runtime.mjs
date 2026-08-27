import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');

assert.match(index,/id="bootSplash"/);
assert.match(index,/Accesso operatori/);
assert.match(index,/id="firstAccessBtn"/);
assert.match(index,/>ACCEDI</);
assert.match(index,/#warehouseApp\{[^}]*opacity:0;visibility:hidden;pointer-events:none/s);
assert.match(index,/body\.appEntered #warehouseApp\{opacity:1;visibility:visible;pointer-events:auto\}/);
assert.ok(index.indexOf('id="bootSplash"') < index.indexOf('id="warehouseApp"'),'Access landing must exist before iframe');
assert.match(index,/await addScript\(d,'uxPolishV3Js','ux-polish-v3\.js\?v=/);
assert.match(index,/await addScript\(d,'finalUxHardeningV1Js','final-ux-hardening-v1\.js\?v=/);
assert.match(index,/WarehouseFinalUxHardeningV1\?\.install\?\.\(\)/);
assert.match(index,/await nextPaint\(\);markAppReady\(\);/);
assert.match(index,/function requestAccess\(\)/);
assert.match(index,/function failBoot\(err\)/);
assert.doesNotMatch(index,/Caricamento in corso…/);

console.log('Access-first boot runtime OK');
