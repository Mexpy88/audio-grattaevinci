import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('mobile-search-v2.js','utf8');
function dummy(id=''){return {id,value:'',dataset:{},classList:{add(){},remove(){},toggle(){}},childNodes:[],style:{},textContent:'',innerHTML:'',placeholder:'',closest(){return null},querySelector(){return null},querySelectorAll(){return []},appendChild(){},addEventListener(){},focus(){},setAttribute(){}}}
const els=new Map();
const document={
  documentElement:{dataset:{}},body:{classList:{add(){},remove(){}},appendChild(){}},
  getElementById(id){if(!els.has(id))els.set(id,dummy(id));return els.get(id)},
  querySelectorAll(sel){if(sel==='.screen.on')return [{id:'home'}];return []},
  createElement(tag){const e=dummy();e.tagName=tag.toUpperCase();e.showModal=()=>{};e.close=()=>{};return e},
};
class MO{observe(){}}
const context={window:null,document,MutationObserver:MO,console,setTimeout(){return 1},clearTimeout(){},decodeURIComponent,encodeURIComponent,
  alert(){},requireLogin:()=>true,stockEditSource:{fila_scaffale:'',bancale:''},stockEditRowsDraft:[],stockBuckets:()=>[],locationOf:r=>r?.fila_scaffale||'',db:{master:{rows:[]}},show(){},
};
context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'mobile-search-v2.js'});
const api=context.WarehouseMobileSearchV2;if(!api)throw new Error('API not exposed');
for(const q of ['I00215 S','I00215-S','I00215 - S']){const p=api.parseSearch(q);if(p.article!=='I00215'||p.size!=='S')throw new Error(`Wrong parse for ${q}: ${JSON.stringify(p)}`)}
const rows=[{article_base:'I00215',size:'S'},{article_base:'I00215',size:'M'},{article_base:'I002150',size:'S'}];
const p=api.parseSearch('I00215-S');const matched=rows.filter(r=>api.rowMatches(r,p));if(matched.length!==1||matched[0].size!=='S'||matched[0].article_base!=='I00215')throw new Error('Exact article+size filtering failed');
if(!api.posPresent('13','')||!api.posPresent('','A POSTO1')||!api.posPresent('13','A POSTO1')||api.posPresent('',''))throw new Error('Flexible position logic failed');
context.db.master.rows=[{article_base:'I00215',size:'S',quantity:10,state:'NUOVO',fila_scaffale:'13',bancale:''},{article_base:'I00215',size:'M',quantity:5,state:'NUOVO',fila_scaffale:'',bancale:'A POSTO1'}];
const rep=api.correctedIntegrity();if(!rep.ok||rep.blocking!==0)throw new Error('Shelf-only and pallet-only rows should both be valid');
console.log('Mobile Search V2 runtime OK: exact size parsing/filtering and flexible positions verified.');
