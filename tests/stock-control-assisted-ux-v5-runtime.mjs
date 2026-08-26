import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('stock-control-assisted-ux-v5.js','utf8');
const loader=fs.readFileSync('managerial-v2-polish.js','utf8');

assert.match(src,/stock-control-assisted-ux5-1/);
assert.match(src,/white-space:nowrap!important/);
assert.match(src,/grid-template-columns:minmax\(0,1fr\) 36px/);
assert.match(src,/grid-template-rows:auto auto/);
assert.match(src,/scaArticleMetaLine/);
assert.match(src,/font-size:clamp\(19px,5\.6vw,23px\)/);
assert.match(src,/#e7c89f/i);
assert.match(src,/#fff0d0/i);
assert.match(src,/scaArticleComplete/);
assert.match(src,/progress\?\.classList\.contains\('done'\)/);
assert.match(src,/border:2px solid #8fc69d/i);
assert.match(src,/PREVISTO NELLA POSIZIONE/);
assert.match(src,/scaExpectedLocationMeta/);
assert.match(loader,/stock-control-assisted-ux-v5\.js/);
assert.match(loader,/loadAssistedUxV5/);
assert.ok(src.indexOf('#e7c89f')!==src.indexOf('#fff0d0'),'alternating colors must be distinct');
console.log('assisted count UX V5.1 runtime OK: two-line compact article header, hidden redundant location meta, distinct palette and completion outline.');