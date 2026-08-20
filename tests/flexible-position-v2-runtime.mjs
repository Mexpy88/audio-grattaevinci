import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('flexible-position-v2.js','utf8');
let id=0,saved=0,alerts=[];
const document={getElementById(){return {innerHTML:'',classList:{add(){},remove(){}},remove(){}}},createElement(){return {id:'',className:'',innerHTML:'',querySelector(){return {onclick:null}},remove(){}}},body:{appendChild(){}}};
const context={window:null,document,console,setTimeout(){return 1},clearTimeout(){},
  db:{rectifications:[],master:{rows:[]}},stockEditRowsDraft:[],stockEditSource:{fila_scaffale:'13',bancale:''},
  normalizeArticle:v=>String(v||'').trim().toUpperCase(),locationOf:r=>r?.fila_scaffale||r?.fila||'',requireLogin:()=>true,
  stockBuckets:()=>[{article_base:'I00215',size:'S',quantity:10,state:'NUOVO',fila_scaffale:'13',bancale:''}],
  uid:()=>`id-${++id}`,operatorName:()=> 'Mattia',audit(){},saveDb(){saved++},alert:m=>alerts.push(m),confirm:()=>true,
  stockEditBuildDraft(){},renderStockEditRows(){},setStatus(){},LocalMaster:{renderPanel(){}},warehouseToast(){},renderRegistry(){},renderStock(){},
};context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'flexible-position-v2.js'});
context.stockEditRowsDraft=[{deleted:false,original:{article_base:'I00215',size:'S',quantity:10,state:'NUOVO',fila_scaffale:'13',bancale:''},article_base:'I00215',size:'S',quantity:12,state:'NUOVO',fila_scaffale:'13',bancale:''}];
context.saveStockEdit();
if(alerts.length)throw new Error('Shelf-only row was rejected: '+alerts.join('; '));
if(context.db.rectifications.length!==1)throw new Error('Expected one rectification for shelf-only row');
if(context.db.movements?.length)throw new Error('Unexpected movement created');
if(context.db.rectifications[0].after?.bancale!=='')throw new Error('Empty pallet should remain valid');
if(context.db.rectifications[0].after?.fila_scaffale!=='13')throw new Error('Shelf position lost');
if(!saved)throw new Error('Database was not saved');
console.log('Flexible Position V2 runtime OK: shelf-only rectification is accepted and persisted.');
