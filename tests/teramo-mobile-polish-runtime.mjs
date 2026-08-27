import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('premium-dashboard-v2-fix.js','utf8');

assert.match(src,/premium-dashboard2-fix2-teramo1/);
assert.match(src,/MAGAZZINO TERAMO/);
assert.match(src,/grid-template-columns:minmax\(0,1fr\) 52px!important/);
assert.match(src,/rdMasterMain\{grid-column:1!important;grid-row:1!important/);
assert.match(src,/rdMasterDetails\.rdMasterAddV2\{grid-column:2!important;grid-row:1!important/);
assert.match(src,/rdMasterTopline\{display:flex!important;align-items:center!important;flex-wrap:wrap!important/);
assert.match(src,/rdReady\{position:static!important;transform:none!important;white-space:nowrap!important/);
assert.match(src,/headerSub&&headerSub\.textContent==='Dashboard'/);

console.log('Teramo title + mobile Master add layout OK');
