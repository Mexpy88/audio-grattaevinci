import fs from 'node:fs';
import assert from 'node:assert/strict';

const ux=fs.readFileSync('stock-control-assisted-ux-v4.js','utf8');
const polish=fs.readFileSync('managerial-v2-polish.js','utf8');

assert.match(ux,/2026\.08\.26-stock-control-assisted-ux4/);
assert.match(ux,/＋ AGGIUNGI/);
assert.match(ux,/scaCollapseBtn/);
assert.match(ux,/scaCollapsed/);
assert.match(ux,/scaStateBadge\.NUOVO/);
assert.match(ux,/scaStateBadge\.SCARICATO/);
assert.match(ux,/scaStateBadge\.USATO/);
assert.match(ux,/scaStateBadge\.DISMESSO/);
assert.match(ux,/scaCheckState pending/);
assert.match(ux,/scaCheckState ok/);
assert.match(ux,/scaCountTools/);
assert.match(ux,/Cerca articolo nella fila/);
assert.match(ux,/scaProgressFillV4/);
assert.match(ux,/Come funziona il conteggio/);
assert.match(ux,/Riepilogo verifica/);
assert.match(ux,/IN DIFETTO/);
assert.match(ux,/IN ECCEDENZA/);
assert.match(ux,/MutationObserver/);
assert.match(ux,/observer\.observe\(root,\{childList:true,subtree:true\}\)/);
assert.doesNotMatch(ux,/window\.confirmPhysicalCountAssistV3\s*=/);
assert.doesNotMatch(ux,/db\.rectifications/);
assert.doesNotMatch(ux,/saveDb\(/);
assert.match(polish,/stock-control-assisted-ux-v4\.js/);
assert.match(polish,/loadAssistedUxV4/);

console.log('assisted count UX V4 runtime OK');
