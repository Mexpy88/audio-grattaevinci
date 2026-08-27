import fs from 'node:fs';
import assert from 'node:assert/strict';

const fix=fs.readFileSync('goods-receipt-v2-fix.js','utf8');
const loader=fs.readFileSync('ux-polish-v3.js','utf8');

assert.match(fix,/goods-receipt-v2-fix1/);
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
assert.ok(!/observe\(document\.body/.test(fix),'fix must not install a body-wide MutationObserver');

assert.match(loader,/loadGoodsReceiptFix/);
assert.match(loader,/goods-receipt-v2-fix\.js/);
assert.match(loader,/GoodsReceiptNoopObserver/);
assert.match(loader,/Number\(delay\)===1600/);
assert.match(loader,/decorateDashboard/);

console.log('Entrata Merci V2 performance + navigation + partial counter contract OK');