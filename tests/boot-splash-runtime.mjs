import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');

assert.match(index,/id="bootSplash"/);
assert.match(index,/#warehouseApp\{[^}]*opacity:0;visibility:hidden;pointer-events:none/s);
assert.match(index,/body\.bootReady #warehouseApp\{opacity:1;visibility:visible;pointer-events:auto\}/);
assert.ok(index.indexOf('id="bootSplash"') < index.indexOf('id="warehouseApp"'),'Splash must exist before iframe');
assert.match(index,/await addScript\(d,'uxPolishV3Js','ux-polish-v3\.js\?v='/);
assert.match(index,/WarehouseUxPolishV3\?\.install\?\.\(\)/);
assert.match(index,/await nextPaint\(\);\s*revealApp\(\);/s,'App must reveal only after final paint');
assert.match(index,/function failBoot\(err\)/);

console.log('Boot splash runtime OK');
