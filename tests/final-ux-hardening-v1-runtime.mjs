import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('final-ux-hardening-v1.js','utf8');
const css=fs.readFileSync('final-ux-hardening-v1.css','utf8');
const polish=fs.readFileSync('ux-polish-v3.js','utf8');

// ACCEDI is literal first-paint HTML, while the iframe remains hidden until user action.
assert.match(index,/id="bootSplash"[\s\S]*Accesso operatori[\s\S]*id="firstAccessBtn"[\s\S]*>ACCEDI</);
assert.match(index,/body\.appEntered #warehouseApp/);
assert.match(index,/function requestAccess\(\)/);
assert.match(index,/if\(appReady\)enterApp\(\)/);
assert.match(index,/frame\.contentWindow\?\.openLogin\?\.\(\)/);
assert.doesNotMatch(index,/Caricamento in corso…/,'loading copy must not be visible in first-paint HTML');
assert.doesNotMatch(index,/bootDots/,'old loading dots must not be the first screen');

// Final layer is loaded after the core chain and can be reapplied after async premium/registry loaders.
assert.match(index,/final-ux-hardening-v1\.js/);
assert.match(polish,/loadFinalHardening/);
assert.match(polish,/loadRegistryFix[\s\S]*loadFinalHardening/);
assert.match(js,/2026\.08\.27-final-ux-hardening1\.2/);

// Old permanent bottom export bar is retired. Export is contextual inside Master.
assert.match(css,/#uxDirtyBar\{display:none!important\}/);
assert.match(js,/rdPendingExportBtn/);
assert.match(js,/openExportDialog/);
assert.match(js,/ESPORTA MASTER/);
assert.match(js,/Ultimo export/);
assert.match(js,/suppressPrelogin/);

// Filename is hidden on dashboard; missing Master exposes an explicit load CTA.
assert.match(css,/#rdDashboardV1 \.rdMasterFile\{display:none!important\}/);
assert.match(js,/CARICA MASTER EXCEL/);
assert.match(js,/DA CARICARE/);
assert.match(js,/masterInput/);

// MOVIMENTI renderer is self-contained and includes all operational event stores.
assert.match(js,/window\.renderRegistry=renderSafeRegistry/);
assert.match(js,/window\.setRegistryTab=setSafeRegistryTab/);
assert.match(js,/window\.openRoleRegistryMovementsV1=openMovements/);
assert.match(js,/d\.movements/);
assert.match(js,/d\.rectifications/);
assert.match(js,/d\.stock_transfers/);
assert.match(js,/d\.stock_verifications/);
for(const type of ['CARICA','SCARICA','SPOSTA','RETTIFICA','VERIFICA FISICA'])assert.ok(js.includes(type),`missing registry type ${type}`);
assert.match(js,/Nessun movimento trovato con i filtri selezionati/);
assert.doesNotMatch(js,/Impossibile aprire Movimenti/,'final renderer must not use the old failure fallback');

// No replacement of warehouse persistence or stock calculation engines.
assert.doesNotMatch(js,/window\.saveDb\s*=/);
assert.doesNotMatch(js,/window\.stockBuckets\s*=/);

console.log('Final UX Hardening V1 contract OK');
