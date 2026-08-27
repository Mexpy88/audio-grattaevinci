import fs from 'node:fs';
import assert from 'node:assert/strict';

const fix=fs.readFileSync('goods-receipt-v2-fix.js','utf8');
const loader=fs.readFileSync('ux-polish-v3.js','utf8');

assert.match(fix,/goods-receipt-v2-fix2/);
assert.match(fix,/CONTEGGIO PARZIALE/);
assert.match(fix,/addGoodsReceiptPartialV2/);
assert.match(fix,/undoGoodsReceiptPartialV2/);
assert.match(fix,/resetGoodsReceiptPartialV2/);
assert.match(fix,/setImportedCheckedToZero/);
assert.match(fix,/input\.value='0'/);
assert.match(fix,/backFromGoodsReceiptNewV2/);
assert.match(fix,/openGoodsReceiptNewV1\('hub'\)/);
assert.match(fix,/Apri Entrata Merci/);
assert.match(fix,/scopedDraftObserver/);
assert.match(fix,/observeDashboardRoot/);
assert.match(fix,/dashboardObserver\.observe\(root,\{childList:true\}\)/);
assert.ok(!/observe\(document\.body/.test(fix),'fix must not install a body-wide MutationObserver');
assert.ok(!/dashboardObserver\.observe\([^\n]+subtree:true/.test(fix),'dashboard observer must stay direct-child scoped');

assert.match(loader,/loadGoodsReceiptFix/);
assert.match(loader,/goods-receipt-v2-fix\.js/);
assert.match(loader,/GoodsReceiptNoopObserver/);
assert.match(loader,/Number\(delay\)===1600/);
assert.match(loader,/Number\(delay\)===1500/);
assert.match(loader,/String\(fn\)\.includes\('renderDashboard'\)/);
assert.match(loader,/Role Dashboard V1 used to rebuild/);

console.log('Entrata Merci V2 performance + navigation + dashboard loop regression contract OK');
