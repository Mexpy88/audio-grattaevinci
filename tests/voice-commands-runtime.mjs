import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('voice-commands.js','utf8');
for(const forbidden of ['confirmOperation(', 'saveStockEdit(', 'window.alert=', 'window.confirm=', 'MutationObserver']){
  if(source.includes(forbidden))throw new Error(`Voice module must never auto-commit or override globals: ${forbidden}`);
}
for(const required of ['SpeechRecognition','webkitSpeechRecognition','getUserMedia','CERCA','CARICA','SCARICA','MODIFICA','parseItems','parseModifyRows','validateModifyReviewRows','voiceModifyReview','installUi']){
  if(!source.includes(required))throw new Error(`Voice feature missing: ${required}`);
}

const stock=[
  {article_base:'I30872MUHF',size:'L',quantity:50,state:'NUOVO',fila_scaffale:'68',bancale:'134'},
  {article_base:'I30871AGUHF',size:'M',quantity:40,state:'SCARICATO',fila_scaffale:'68',bancale:'134'},
  {article_base:'I00215',size:'S',quantity:20,state:'USATO',fila_scaffale:'69',bancale:'135'}
];
const context={
  window:null,
  console,
  document:undefined,
  normalizeArticle:v=>String(v||'').replace(/[^a-z0-9]/gi,'').toUpperCase().replace(/^1(?=\d{3,})/,'I'),
  stockBuckets:()=>stock,
  locationOf:r=>r.fila_scaffale||''
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'voice-commands.js'});
const api=context.WarehouseVoiceCommands;
if(!api)throw new Error('Voice command API missing');

let rows=api.parseItems('articolo I 3 0 8 7 2 M U H F taglia L pezzi 50 nuovo articolo I30871AGUHF taglia M pezzi 40 scaricato','CARICA');
if(rows.length!==2)throw new Error(`Expected two dictated rows, got ${rows.length}`);
if(rows[0].article!=='I30872MUHF'||rows[0].size!=='L'||rows[0].quantity!==50||rows[0].spokenState!=='NUOVO')throw new Error(`Spaced article parse failed: ${JSON.stringify(rows[0])}`);
if(rows[1].article!=='I30871AGUHF'||rows[1].size!=='M'||rows[1].quantity!==40||rows[1].spokenState!=='SCARICATO')throw new Error(`Second article parse failed: ${JSON.stringify(rows[1])}`);

let resolved=api.resolveOperationRows(rows,'SCARICA','68','134');
if(resolved.some(r=>r.error))throw new Error(`Valid pallet rows rejected: ${JSON.stringify(resolved)}`);
resolved=api.resolveOperationRows(api.parseItems('articolo I30872MUHF taglia L pezzi 60 nuovo','SCARICA'),'SCARICA','68','134');
if(!resolved[0].error.includes('Quantità insufficiente'))throw new Error(`Insufficient stock was not blocked: ${JSON.stringify(resolved[0])}`);

let mods=api.parseModifyRows('elimina articolo I30872MUHF taglia L pezzi 20 nuovo modifica articolo I30871AGUHF taglia M quantita 10 stato usato');
if(mods.length!==2||mods[0].action!=='ELIMINA'||mods[1].action!=='MODIFICA')throw new Error(`Modify actions parse failed: ${JSON.stringify(mods)}`);
let checked=api.validateModifyReviewRows(mods,stock.filter(r=>r.fila_scaffale==='68'&&r.bancale==='134'));
if(checked.some(r=>r.error))throw new Error(`Valid modify batch rejected: ${JSON.stringify(checked)}`);
if(checked[0].sourceState!=='NUOVO'||checked[1].sourceState!=='SCARICATO'||checked[1].targetState!=='USATO')throw new Error(`Modify source/target state resolution failed: ${JSON.stringify(checked)}`);

mods=api.parseModifyRows('elimina articolo I99999 taglia L pezzi 5 nuovo');
checked=api.validateModifyReviewRows(mods,stock.filter(r=>r.fila_scaffale==='68'&&r.bancale==='134'));
if(!checked[0].error.includes('non presente'))throw new Error(`Missing pallet article was not rejected: ${JSON.stringify(checked[0])}`);

if(api.normalizedArticle('1 30872 M U H F')!=='I30872MUHF'||api.normalizedArticle('30872MUHF')!=='I30872MUHF')throw new Error('Warehouse I/1 article normalization failed');

console.log('Voice commands runtime OK: contextual multi-row dictation, spaced I-codes, pallet validation, stock limits and modify review safety all work.');