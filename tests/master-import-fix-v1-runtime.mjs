import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync('master-import-fix-v1.js','utf8');
const polish=fs.readFileSync('ux-polish-v3.js','utf8');

assert.match(src,/2026\.08\.27-master-import-fix1/);
assert.match(src,/CARICA MASTER EXCEL/);
assert.match(src,/function safeRenderPanel/);
assert.match(src,/if\(!loaded\(\)\)return 0/);
assert.match(src,/api\.install=function\(\)\{return true\}/);
assert.match(src,/fresh\.dataset\.hardImportBound='1'/);
assert.match(src,/^([\s\S]*)Importazione non riuscita:/);
assert.doesNotMatch(src,/window\.importMappedMaster\s*=\s*runImport/);
assert.match(polish,/master-import-fix-v1\.js/);
assert.match(polish,/loadMasterImportFix/);

const classes=new Set();
const document={
  body:{classList:{toggle:(name,on)=>{on?classes.add(name):classes.delete(name)}},querySelector:()=>null},
  getElementById:()=>null,
  querySelector:()=>null,
  addEventListener:()=>{}
};
const local=new Map();
const localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)};
let oldRenderCalled=0,oldSchemaInstallCalled=0;
const window={
  LocalMaster:{renderPanel:()=>{oldRenderCalled++;throw new Error('recursive legacy renderer must not run')}},
  WarehouseMasterSchemaV4:{install:()=>{oldSchemaInstallCalled++;throw new Error('late V4 reinstall must not run')}},
  WarehouseRoleDashboardV1:{can:()=>true},
  addEventListener:()=>{}
};
const db={master:{rows:[],filename:'',imported_at:null},audits:[{at:'2026-08-27T10:00:00Z'}],movements:[],documents:[],requests:[]};
const context={window,document,localStorage,db,console,MutationObserver:class{observe(){}},requestAnimationFrame:fn=>fn(),setInterval:()=>1,setTimeout:fn=>{fn();return 1}};
vm.createContext(context);
vm.runInContext(src,context);

const api=window.WarehouseMasterImportFixV1;
assert.ok(api,'Master fix API must install');
assert.equal(api.dirtyCount(),0,'No Master means zero export-pending count even with stale audits');
await window.LocalMaster.renderPanel();
assert.equal(oldRenderCalled,0,'Safe renderer must replace the recursive legacy renderer');
assert.equal(classes.has('lmNoMaster'),true,'Empty state should be marked as no Master');
assert.equal(window.WarehouseMasterSchemaV4.install(),true,'Late V4 install becomes idempotent');
assert.equal(oldSchemaInstallCalled,0,'Old V4 installer must not be called again');

localStorage.setItem('so_local_master_meta_v3',JSON.stringify({importedAt:'2026-08-27T09:00:00Z',lastExportAt:'2026-08-27T09:00:00Z'}));
db.master={rows:[{article_base:'I00001',quantity:1}],filename:'MASTER.xlsx',imported_at:'2026-08-27T09:00:00Z'};
db.audits=[{at:'2026-08-27T10:00:00Z'},{at:'2026-08-27T11:00:00Z'}];
assert.equal(api.dirtyCount(),2,'Loaded Master should still report real pending changes');
await window.LocalMaster.renderPanel();
assert.equal(classes.has('lmNoMaster'),false,'Loaded Master clears no-Master state');

console.log('Master import recursion + empty-state fix OK');
