import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('voice-commands.js','utf8');
for(const forbidden of ['confirmOperation(', 'saveStockEdit(', 'window.alert=', 'window.confirm=', 'MutationObserver']){
  if(source.includes(forbidden))throw new Error(`Voice module must never auto-commit or override globals: ${forbidden}`);
}
for(const required of ['SpeechRecognition','webkitSpeechRecognition','CERCA','CARICA','SCARICA','MODIFICA','targetState','sourcePallet','targetPallet','installUi']){
  if(!source.includes(required))throw new Error(`Voice feature missing: ${required}`);
}

const stock=[
  {article_base:'I30861',size:'M',quantity:50,state:'NUOVO',fila_scaffale:'64',bancale:'135'},
  {article_base:'I00215',size:'S',quantity:20,state:'USATO',fila_scaffale:'A/64',bancale:'22'}
];
const context={
  window:null,
  console,
  document:undefined,
  normalizeArticle:v=>String(v||'').replace(/\s+/g,'').toUpperCase().replace(/^1(?=\d{3,}$)/,'I'),
  stockBuckets:()=>stock,
  locationOf:r=>r.fila_scaffale||''
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'voice-commands.js'});
const api=context.WarehouseVoiceCommands;
if(!api)throw new Error('Voice command API missing');

let c=api.parseCommand('Cerca articolo I 30861 taglia M');
if(c.action!=='CERCA'||c.article!=='I30861'||c.size!=='M')throw new Error(`Search parse failed: ${JSON.stringify(c)}`);

c=api.parseCommand('Carica articolo 30861 taglia L quantità cinquanta nuovo fila 64 bancale 135');
if(c.action!=='CARICA'||c.article!=='I30861'||c.size!=='L'||c.quantity!==50||c.state!=='NUOVO'||c.location!=='64'||c.pallet!=='135')throw new Error(`Load parse failed: ${JSON.stringify(c)}`);

c=api.parseCommand('Scarica articolo I00215 taglia S 18 pezzi usato fila A scaffale 64 bancale 22 produzione');
if(c.action!=='SCARICA'||c.article!=='I00215'||c.size!=='S'||c.quantity!==18||c.state!=='USATO'||c.location!=='A/64'||c.pallet!=='22'||c.destination!=='PRODUZIONE')throw new Error(`Unload parse failed: ${JSON.stringify(c)}`);

c=api.parseCommand('Modifica articolo I30861 taglia M quantità 32 stato usato bancale 140');
if(c.action!=='MODIFICA'||c.article!=='I30861'||c.size!=='M'||c.quantity!==32||c.targetState!=='USATO'||c.state!==''||c.targetPallet!=='140')throw new Error(`Modify target parse failed: ${JSON.stringify(c)}`);

c=api.parseCommand('Modifica articolo I30861 taglia M da bancale 135 a bancale 140');
if(c.sourcePallet!=='135'||c.targetPallet!=='140')throw new Error(`Pallet move parse failed: ${JSON.stringify(c)}`);

c=api.parseCommand('articolo I30861 taglia M','CERCA');
if(c.action!=='CERCA')throw new Error('Contextual voice button did not infer CERCA');

if(api.normalizedArticle('1 30861')!=='I30861'||api.normalizedArticle('30861')!=='I30861')throw new Error('Warehouse I/1 article normalization failed');

console.log('Voice commands runtime OK: search/load/unload/modify parsing works, I/1 codes normalize correctly, target changes stay review-only.');
