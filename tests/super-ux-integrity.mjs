import fs from 'node:fs';

const ux=fs.readFileSync('super-ux.js','utf8');
const hard=fs.readFileSync('ui-hardening.js','utf8');
const controller=fs.readFileSync('master-controller-v1.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('super-ux.css','utf8');

const checks=[
  ['Fila/Scaffale optional validation',/window\.validateLocation=function\(\)\{[^}]*Bancale \/ Carrello/s.test(ux)],
  ['bancale-only pallet search',/!norm\(stockEditSource\.fila_scaffale\)\|\|norm\(locationOf\(s\)\)===norm\(stockEditSource\.fila_scaffale\)/.test(ux)],
  ['wrong PIN feedback',/PIN errato\. Controlla le 4 cifre e riprova\./.test(ux)],
  ['advanced stock search installed',/window\.renderStock=renderAdvancedStock/.test(ux)],
  ['registry advanced filters installed',/window\.renderRegistry=renderAdvancedRegistry/.test(ux)],
  ['barcode scanner available',/BarcodeDetector/.test(ux)&&/startBarcodeScanner/.test(ux)],
  ['pre-confirm operation modal',/Conferma carico/.test(ux)&&/Conferma scarico/.test(ux)&&/operationPreviewRows/.test(ux)],
  ['undo flow installed',/showUndo\(/.test(ux)&&/undoLastOperation/.test(ux)],
  ['autosave checkpoint installed',/CHECKPOINT_KEY/.test(ux)&&/installSaveCheckpoint/.test(ux)],
  ['master versioning installed',/master_version/.test(ux)&&/ESPORTA v/.test(ux)],
  ['legacy old-master preflight remains available',/beforeMasterImport/.test(ux)&&/Master precedente rilevato/.test(ux)],
  ['UI hardening no longer owns Master import',!/window\.importMappedMaster\s*=\s*execute/.test(hard)],
  ['authoritative Master controller validates generation guard',/async function validateGuard/.test(controller)&&/WarehouseMasterGenerationGuard/.test(controller)&&/validateInspection/.test(controller)],
  ['Master controller validates before parsing/saving',controller.indexOf('await validateGuard(selected.bytes)')<controller.indexOf('const parsed=parseV4(selected.wb)')&&controller.indexOf('const parsed=parseV4(selected.wb)')<controller.indexOf('saveDb();await idbPut')],
  ['beforeunload dirty protection',/beforeunload/.test(ux)&&/dirtyCount\(\)>0/.test(ux)],
  ['Super UX stylesheet loaded',/super-ux\.css/.test(index)],
  ['Super UX script loaded',/super-ux\.js/.test(index)],
  ['Super UX loads after UI hardening',index.indexOf("ui-hardening.js")<index.indexOf("super-ux.js")],
  ['camera permission declared',/allow="[^"]*camera/.test(index)],
  ['dirty bar styles present',/\.uxDirtyBar/.test(css)],
  ['mobile breakpoint present',/@media\(max-width:430px\)/.test(css)]
];

const failed=checks.filter(([,ok])=>!ok);
if(failed.length){
  console.error('Super UX integrity FAILED:');
  for(const [name] of failed)console.error('-',name);
  process.exit(1);
}
console.log(`Super UX integrity OK: ${checks.length} feature checks passed.`);
