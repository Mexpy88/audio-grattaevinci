import fs from 'node:fs';
import vm from 'node:vm';

const v4=fs.readFileSync('warehouse-master-schema-v4.js','utf8');
const fix=fs.readFileSync('rectification-uppercase-fix.js','utf8');

// 1) Logical rectification semantics: 100 -> 50 must leave exactly one active 50 bucket.
const ctx={
  window:null,console,structuredClone:globalThis.structuredClone,document:undefined,DOMParser:undefined,XMLSerializer:undefined,
  db:{master:{imported_at:'2026-08-24T07:00:00.000Z',rows:[{article_base:'I00215',size:'L',quantity:100,state:'NUOVO',fila_scaffale:'23',bancale:'38',master_note:''}]},movements:[],rectifications:[{registered_at:'2026-08-24T07:10:00.000Z',cancelled_at:null,before:{article_base:'I00215',size:'L',quantity:100,state:'NUOVO',fila_scaffale:'23',bancale:'38',master_note:''},after:{article_base:'I00215',size:'L',quantity:50,state:'NUOVO',fila_scaffale:'23',bancale:'38',master_note:''}}]}
};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(v4,ctx,{filename:'warehouse-master-schema-v4.js'});
const stock=ctx.WarehouseMasterSchemaV4.stockBuckets();
if(stock.length!==1)throw new Error(`Quantity rectification created ${stock.length} active buckets instead of 1`);
if(Number(stock[0].quantity)!==50)throw new Error(`Quantity rectification expected 50, got ${stock[0].quantity}`);

// 2) Export fix must contain a final consolidation pass that rewrites the canonical row and removes duplicates.
for(const required of ['currentIdentityQuantitiesV4','consolidateMainSheetV4','removeDuplicateExportRowsV4','setNumber(doc,row,4','setNumber(doc,row,5','setNumber(doc,row,6']){
  if(!fix.includes(required))throw new Error(`Missing export consolidation guard: ${required}`);
}
if(/addEventListener\s*\(\s*['\"]touch/i.test(fix))throw new Error('Touch listener must not be introduced');

// 3) Uppercase must change the actual field value, while JSON bridge stays untouched.
const listeners={};
const fakeDoc={
  documentElement:{dataset:{}},head:{appendChild(){}},
  getElementById(){return null},createElement(){return {id:'',textContent:''}},querySelectorAll(){return []},
  addEventListener(type,fn){listeners[type]=fn}
};
const upCtx={window:null,console,document:fakeDoc,DOMParser:undefined,XMLSerializer:undefined,JSZip:undefined,db:{master:{rows:[]}}};upCtx.window=upCtx;
vm.createContext(upCtx);vm.runInContext(fix,upCtx,{filename:'rectification-uppercase-fix.js'});
const field={id:'requestReference',tagName:'INPUT',disabled:false,readOnly:false,value:'capi modificati',getAttribute:n=>n==='type'?'text':'',classList:{contains(){return false}},selectionStart:4,selectionEnd:4,setSelectionRange(){}};
listeners.input({target:field});if(field.value!=='CAPI MODIFICATI')throw new Error('Text input was not converted to uppercase');
const json={id:'jsonInput',tagName:'TEXTAREA',disabled:false,readOnly:false,value:'{"article_base":"I00215"}',getAttribute(){return ''},classList:{contains(){return true}}};listeners.input({target:json});if(json.value!=='{"article_base":"I00215"}')throw new Error('JSON bridge textarea must never be uppercased');

console.log('Rectification quantity/export consolidation/global uppercase runtime OK.');
