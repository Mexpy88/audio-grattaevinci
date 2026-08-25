import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('optional-pallet-fix.js','utf8');
for(const required of ['Bancale/Carrello può rimanere vuoto','positionRows','validateLocationOnly','stockEditRowsAtSource','loadStockPallet','saveStockEdit']){
  if(!source.includes(required))throw new Error(`Optional pallet feature missing: ${required}`);
}

const stock=[
  {article_base:'I100',size:'M',quantity:10,state:'NUOVO',fila_scaffale:'63',bancale:''},
  {article_base:'I200',size:'L',quantity:20,state:'NUOVO',fila_scaffale:'63',bancale:'134'},
  {article_base:'I300',size:'S',quantity:30,state:'NUOVO',fila_scaffale:'64',bancale:''}
];
const elements={
  filaScaffale:{value:'63'},bancale:{value:'',placeholder:'',closest:()=>null},
  stockEditLocation:{value:'63'},stockEditPallet:{value:'',placeholder:'',closest:()=>null},
  stockEditEditor:{classList:{add(){},remove(){}}},stockEditRows:{innerHTML:''},stockEditSummary:{textContent:''},
  stockEditSearchStatus:{classList:{add(){},remove(){}}},stockEditScreen:{querySelector:()=>null}
};
let built=[];let status='';let alertText='';
const document={
  getElementById:id=>elements[id]||null,
  querySelectorAll:()=>[],
  querySelector:()=>null
};
const context={
  window:null,document,console,
  structuredClone:v=>JSON.parse(JSON.stringify(v)),
  stockBuckets:()=>stock,
  locationOf:r=>r.fila_scaffale||'',
  normalizeArticle:v=>String(v||'').toUpperCase(),
  requireLogin:()=>true,
  stockEditSource:{fila_scaffale:'',bancale:''},
  stockEditRowsDraft:[],
  stockEditBuildDraft:rows=>{built=rows},
  stockEditRowHtml:()=>'',
  setStatus:(id,msg)=>{status=msg},
  alert:msg=>{alertText=msg},
  confirm:()=>true,
  db:{rectifications:[]},uid:()=>String(Math.random()),operatorName:()=>'TEST',audit(){},saveDb(){},
  WarehouseVoiceCommands:null
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'optional-pallet-fix.js'});
const api=context.WarehouseOptionalPalletFix;
if(!api)throw new Error('WarehouseOptionalPalletFix API missing');
if(!api.validateLocationOnly())throw new Error('Fila with blank pallet should be valid');
const direct=api.positionRows('63','');
if(direct.length!==1||direct[0].article_base!=='I100')throw new Error(`Blank pallet matched wrong stock: ${JSON.stringify(direct)}`);
const pallet=api.positionRows('63','134');
if(pallet.length!==1||pallet[0].article_base!=='I200')throw new Error(`Specified pallet matched wrong stock: ${JSON.stringify(pallet)}`);
context.loadStockPallet();
if(built.length!==1||built[0].article_base!=='I100')throw new Error(`Shelf-only editor loaded wrong rows: ${JSON.stringify(built)}`);
if(!/senza Bancale\/Carrello/i.test(status))throw new Error(`Shelf-only status is unclear: ${status}`);
if(alertText)throw new Error(`Blank pallet unexpectedly raised validation error: ${alertText}`);
console.log('Optional pallet runtime OK: Fila is required, pallet may be blank, and blank pallet matches only direct shelf stock.');
