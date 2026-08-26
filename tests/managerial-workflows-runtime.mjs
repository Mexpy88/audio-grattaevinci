import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('managerial-workflows.js','utf8');
const index=fs.readFileSync('index.html','utf8');

function context(){
  let seq=0;
  const elements={};
  const mk=(value='')=>({value,innerHTML:'',textContent:'',title:'',classList:{add(){},remove(){},toggle(){}},querySelector(){return null},querySelectorAll(){return []}});
  for(const [id,v] of Object.entries({moveSourceLoc:'64',moveSourcePallet:'135',moveDestLoc:'70',moveDestPallet:'200',moveSourceStatus:'',moveRowsWrap:'',moveRows:'',inventoryLoc:'64',inventoryPallet:'135',inventoryStatus:'',inventoryRowsWrap:'',inventoryRows:''}))elements[id]=mk(v);
  const storage=new Map();
  const sandbox={
    console,JSON,String,Number,Math,Date,Array,Map,Set,RegExp,Error,
    structuredClone:v=>JSON.parse(JSON.stringify(v)),
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    db:{master:{filename:'MASTER.xlsx',rows:[1]},rectifications:[],stock_transfers:[],inventory_sessions:[],audits:[]},
    currentUser:'Mattia',
    requireLogin:()=>true,
    LocalMaster:{requireMaster:()=>true,renderPanel:()=>{}},
    normalizeArticle:v=>String(v||'').trim().toUpperCase().replace(/^1(?=[A-Z0-9])/,'I'),
    locationOf:r=>r.fila_scaffale||r.fila||'',
    operatorName:()=> 'Mattia',
    uid:()=>`U${++seq}`,
    confirm:()=>true,
    alert:msg=>{throw new Error('Unexpected alert: '+msg)},
    audit:(action,entity,id,before,after)=>sandbox.db.audits.push({action,entity,id,before,after}),
    saveDb:()=>{sandbox.saved=(sandbox.saved||0)+1},
    renderStock:()=>{},renderRegistry:()=>{},show:id=>{sandbox.shown=id},warehouseToast:()=>{},setStatus:()=>{},
    stockBuckets:()=>sandbox.baseStock.map(x=>({...x})),
    baseStock:[],
    window:null
  };
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{filename:'managerial-workflows.js'});
  sandbox.document={getElementById:id=>elements[id]||null,querySelector(){return null},querySelectorAll(){return []}};
  return {sandbox,elements};
}

{
  const {sandbox}=context();
  sandbox.baseStock=[{article_base:'I30861',size:'M',state:'NUOVO',quantity:100,fila_scaffale:'64',fila:'64',bancale:'135'}];
  sandbox.loadMoveSource();
  sandbox.updateMoveRow(0,'selected',true);
  sandbox.updateMoveRow(0,'quantity',30);
  sandbox.confirmStockMove();
  assert.equal(sandbox.db.stock_transfers.length,1);
  assert.equal(sandbox.db.stock_transfers[0].type,'SPOSTA');
  assert.equal(sandbox.db.stock_transfers[0].pieces,30);
  assert.equal(sandbox.db.rectifications.length,2,'partial move must split source remainder and destination addition');
  assert.ok(sandbox.db.rectifications.every(r=>r.semantic_type==='SPOSTA'));
  const remainder=sandbox.db.rectifications.find(r=>r.before&&r.after&&r.after.fila_scaffale==='64');
  const destination=sandbox.db.rectifications.find(r=>!r.before&&r.after?.fila_scaffale==='70');
  assert.equal(remainder.before.quantity,100);assert.equal(remainder.after.quantity,70);
  assert.equal(destination.after.quantity,30);assert.equal(destination.after.bancale,'200');
  assert.equal(sandbox.shown,'managerialMoveHub');
}

{
  const {sandbox,elements}=context();
  sandbox.baseStock=[{article_base:'I00215',size:'L',state:'USATO',quantity:50,fila_scaffale:'64',fila:'64',bancale:'135'}];
  sandbox.loadInventoryPosition();
  sandbox.updateInventoryRow(0,'counted',47);
  sandbox.confirmInventorySession();
  assert.equal(sandbox.db.inventory_sessions.length,1);
  assert.equal(sandbox.db.inventory_sessions[0].type,'INVENTARIO');
  assert.equal(sandbox.db.inventory_sessions[0].expected_pieces,50);
  assert.equal(sandbox.db.inventory_sessions[0].counted_pieces,47);
  assert.equal(sandbox.db.inventory_sessions[0].differences,1);
  assert.equal(sandbox.db.rectifications.length,1);
  assert.equal(sandbox.db.rectifications[0].semantic_type,'INVENTARIO');
  assert.equal(sandbox.db.rectifications[0].before.quantity,50);
  assert.equal(sandbox.db.rectifications[0].after.quantity,47);
  assert.match(sandbox.db.rectifications[0].note,/INVENTARIO INV-/);
  assert.equal(sandbox.shown,'managerialStockHub');
  elements.inventoryLoc.value='99';elements.inventoryPallet.value='999';sandbox.baseStock=[];
  sandbox.loadInventoryPosition();
  sandbox.confirmInventorySession();
  assert.equal(sandbox.db.inventory_sessions.length,2,'empty position must still be inventory-confirmable');
  assert.equal(sandbox.db.inventory_sessions[0].expected_pieces,0);
  assert.equal(sandbox.db.inventory_sessions[0].counted_pieces,0);
}

assert.match(source,/MOVIMENTA/);assert.match(source,/GIACENZE/);assert.match(source,/RETTIFICA/);assert.match(source,/semantic_type:semantic/);
assert.match(source,/SPOSTA\\s\+SP-/);assert.match(source,/INVENTARIO\\s\+INV-/);
assert.ok(index.indexOf('managerial-workflows.js')>index.indexOf('master-generation-guard-v2.js'),'managerial module must load after existing operational wrappers');
console.log('Managerial workflows OK: taxonomy, partial SPOSTA, INVENTARIO and semantic records validated.');
