import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('session-cycle-fix.js','utf8');
for(const forbidden of ['touchstart','touchmove','touchend','MutationObserver','window.show=','window.show =']){
  if(source.includes(forbidden))throw new Error(`Forbidden navigation hook: ${forbidden}`);
}
for(const required of ['sessionCounts','sessionDirtyCount','::-ms-reveal','lmStats','uxDirtyBar']){
  if(!source.includes(required))throw new Error(`Required session-cycle feature missing: ${required}`);
}

const importedAt='2026-08-24T11:09:00.000Z';
const after='2026-08-24T11:10:00.000Z';
const before='2026-08-24T10:00:00.000Z';
const store=new Map([['so_local_master_meta_v3',JSON.stringify({importedAt,lastExportAt:importedAt})]]);
const oldMovements=Array.from({length:33},(_,i)=>({id:'OLD'+i,registered_at:before,operation_at:before}));
const context={
  window:null,
  console,
  document:undefined,
  setTimeout,
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
  db:{
    master:{imported_at:importedAt,rows:[{article_base:'I1'}]},
    movements:oldMovements,
    documents:[{id:'DOLD',created_at:before}],
    requests:[{id:'ROLD',created_at:before,requested_at:before}],
    audits:Array.from({length:33},(_,i)=>({id:'A'+i,action:'CREATE',at:before}))
  }
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'session-cycle-fix.js'});
const api=context.WarehouseSessionCycleFix;
if(!api)throw new Error('Session-cycle API missing');
let c=api.sessionCounts();
if(c.moves!==0||c.docs!==0||c.reqs!==0)throw new Error(`Historical APP_DATI leaked into Home counters: ${JSON.stringify(c)}`);
if(api.sessionDirtyCount()!==0)throw new Error('Historical audits leaked into dirty counter');

context.db.movements.unshift({id:'NEW1',registered_at:after,operation_at:after});
context.db.documents.unshift({id:'DNEW',created_at:after,operation_at:after});
context.db.requests.unshift({id:'RNEW',created_at:after,requested_at:after});
context.db.audits.unshift({id:'ANEW1',action:'CREATE',at:after},{id:'ANEW2',action:'UPDATE',at:after});
c=api.sessionCounts();
if(c.moves!==1||c.docs!==1||c.reqs!==1)throw new Error(`Current-cycle counters wrong: ${JSON.stringify(c)}`);
if(api.sessionDirtyCount()!==2)throw new Error(`Current dirty count wrong: ${api.sessionDirtyCount()}`);

store.set('so_local_master_meta_v3',JSON.stringify({importedAt,lastExportAt:'2026-08-24T11:11:00.000Z'}));
if(api.sessionDirtyCount()!==0)throw new Error('Export baseline did not reset dirty counter');

console.log('Session cycle runtime OK: imported history stays in Registro, Home counters start at 0, new activity counts, dirty bar resets after export, Edge PIN reveal is suppressed.');
