import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('request-floating-confirm-v1.js','utf8');
const css=fs.readFileSync('request-floating-confirm-v1.css','utf8');
const polish=fs.readFileSync('ux-polish-v3.js','utf8');

assert.match(js,/2026\.08\.27-request-floating-confirm1/);
assert.match(js,/requestFloatConfirmV1/);
assert.match(js,/requestFloatDialogV1/);
assert.match(js,/CONFERMA PRELIEVO/);
assert.match(js,/CHIUDI \/ COMPLETA RICHIESTA/);
assert.match(js,/ANNULLA/);
assert.match(js,/selectedDraft/);
assert.match(js,/Cartoni/);
assert.match(js,/Pezzi/);
assert.match(js,/Articoli/);
assert.match(js,/WarehouseRequestCompletionWorkflow\?\.completeRequest/);
assert.match(js,/window\.confirmPicking/);
assert.match(js,/visibleExportPanel/);
assert.match(js,/ESPORTA\\s\+ORA/);
assert.match(js,/innerHeight-panel\.top\+14/);
assert.match(js,/REQUEST_PROCESS/);

assert.match(css,/@media\(max-width:899px\)/);
assert.match(css,/#requestFloatConfirmV1\{position:fixed/);
assert.match(css,/bottom:var\(--rf-bottom,22px\)/);
assert.match(css,/#requestDetail #confirmPickBtn,#requestDetail \[data-request-close-button\]\{display:none!important\}/);
assert.match(css,/rfDialogActions/);
assert.match(css,/rfConfirm/);
assert.match(css,/rfComplete/);
assert.match(css,/@media\(min-width:900px\)\{#requestFloatConfirmV1\{display:none!important\}\}/);

assert.match(polish,/request-floating-confirm-v1\.js/);
assert.match(polish,/request-floating-confirm-v1\.css/);
assert.match(polish,/loadFloatingConfirm/);
assert.match(polish,/premium2-floating-confirm1/);

// This layer delegates to existing engines; it must not replace stock/request storage primitives.
assert.ok(!/window\.saveDb\s*=/.test(js));
assert.ok(!/window\.confirmPicking\s*=/.test(js));
assert.ok(!/window\.completeRequest\s*=/.test(js));

console.log('Request Floating Confirm V1 contract OK');
