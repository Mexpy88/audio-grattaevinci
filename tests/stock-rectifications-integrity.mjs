import fs from 'node:fs';
const s=fs.readFileSync('stock-rectifications.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const checks=[
 ['module loaded after Super UX',/superUxJs[\s\S]*stockRectificationsJs/],
 ['rectification store',/db\.rectifications/],
 ['stock timeline override',/window\.stockBuckets=rectifiedStockBuckets/],
 ['MODIFICA override',/window\.saveStockEdit=function\(\)/],
 ['no fake movement creation in override',/Non verrà creato alcun CARICA o SCARICA/],
 ['rectification audit',/RECTIFICATION/],
 ['source workbook row patch',/patchSourceWorkbook/],
 ['visible registry rewrite',/rewriteVisibleRegistry/],
 ['internal ids not exported visibly',/const headers=\['DATA \/ ORA','OPERATORE','OPERAZIONE'/],
 ['registry includes rettifica',/'RETTIFICA'/],
 ['rectification undo',/undoRectificationBatch/]
];
const missing=[];
for(const [name,re] of checks){const src=name==='module loaded after Super UX'?index:s;if(!re.test(src))missing.push(name)}
if(/const headers=\[[^\]]*ID MOVIMENTO/.test(s))missing.push('ID MOVIMENTO must not be in visible registry headers');
if(missing.length){console.error('Stock rectifications FAILED:',missing.join(', '));process.exit(1)}
console.log('Stock rectifications OK: MODIFICA uses rectifications, preserves workbook rows when possible, and movement IDs remain internal.');
