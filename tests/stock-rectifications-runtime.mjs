import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('stock-rectifications.js','utf8');
let id=0;
const els=new Map();
function el(idv=''){return {id:idv,classList:{add(){},remove(){}},style:{},dataset:{},innerHTML:'',textContent:'',value:'',appendChild(){},remove(){},querySelector(){return {onclick:null}},querySelectorAll(){return []}}}
const document={
  getElementById(idv){if(!els.has(idv))els.set(idv,el(idv));return els.get(idv)},
  querySelector(){return null},
  createElement(){return el()},
  body:{appendChild(){}}
};
class DummyParser{parseFromString(){return {documentElement:{},getElementsByTagName(){return []}}}}
class DummySerializer{serializeToString(){return '<x/>'}}
function JSZip(){}
JSZip.prototype.generateAsync=async()=>new Uint8Array();
JSZip.loadAsync=async()=>({});

const context={
  console,window:null,document,DOMParser:DummyParser,XMLSerializer:DummySerializer,JSZip,XLSX:{},Blob,
  setTimeout(){return 1},clearTimeout(){},indexedDB:{},
  LocalMaster:{exportUpdatedMaster:async()=>true,renderPanel:async()=>true,requireMaster:()=>true},
  db:{master:{imported_at:'2026-08-20T07:00:00.000Z',rows:[{article_base:'I62452BO',size:'S',quantity:100,state:'NUOVO',fila_scaffale:'',bancale:'A POSTO1'}]},movements:[],rectifications:[],audits:[]},
  stockEditRowsDraft:[],stockEditSource:{fila_scaffale:'',bancale:'A POSTO1'},
  normalizeArticle:v=>String(v||'').trim().toUpperCase(),locationOf:r=>r?.fila_scaffale||r?.fila||'',requireLogin:()=>true,
  uid:()=>`id-${++id}`,operatorName:()=> 'Mattia',audit(){},saveDb(){},warehouseToast(){},alert(msg){throw new Error('Unexpected alert: '+msg)},confirm:()=>true,
  stockEditBuildDraft(){},renderStockEditRows(){},setStatus(){},registryDateMatch:()=>true,fmtDateTime:v=>v,openMovementEdit(){},cancelMovement(){},esc:v=>String(v),
};
context.window=context;
context.window.renderRegistry=()=>{};
context.window.stockEditRowsAtSource=()=>context.window.stockBuckets().filter(r=>r.bancale==='A POSTO1');
vm.createContext(context);
vm.runInContext(source,context,{filename:'stock-rectifications.js'});

context.stockEditRowsDraft=[{
  edit_id:'x',deleted:false,
  original:{article_base:'I62452BO',size:'S',quantity:100,state:'NUOVO',fila_scaffale:'',bancale:'A POSTO1'},
  article_base:'I62452BO',size:'S',quantity:100,state:'NUOVO',fila_scaffale:'TRA FILA 23 E 24',bancale:'A POSTO1'
}];
context.window.saveStockEdit();

if(context.db.movements.length!==0)throw new Error('MODIFICA created fake movements');
if(context.db.rectifications.length!==1)throw new Error('Expected exactly one rectification');
const r=context.db.rectifications[0];
if((r.before?.fila_scaffale||'')!=='')throw new Error('Wrong old location');
if(r.after?.fila_scaffale!=='TRA FILA 23 E 24')throw new Error('New location not saved');
if(Number(r.after?.quantity)!==100)throw new Error('Quantity changed unexpectedly');
const stock=context.window.stockBuckets();
if(stock.length!==1)throw new Error('Expected one active stock bucket, got '+stock.length);
if(stock[0].fila_scaffale!=='TRA FILA 23 E 24'||stock[0].quantity!==100)throw new Error('Stock was not moved logically by rectification');
if(stock.some(x=>!x.fila_scaffale&&x.bancale==='A POSTO1'))throw new Error('Old unassigned bucket remained active');
console.log('Stock rectification runtime OK: location-only MODIFICA creates one RETTIFICA, zero movements, and preserves 100 pieces.');
