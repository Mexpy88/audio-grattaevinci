import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('master-panel-minimize.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const storage=new Map();
const sandbox={
  console,JSON,String,Number,Math,Date,Array,
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
  db:{master:{filename:'MASTER.xlsx',rows:[{x:1}]},audits:[]},
  window:null
};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'master-panel-minimize.js'});
const api=sandbox.WarehouseMasterPanelMinimize;
assert.ok(api,'Master panel minimize API not exposed');
storage.set('so_master_generation_guard_v1',JSON.stringify({maxGeneration:12}));
storage.set('so_local_master_meta_v3',JSON.stringify({importedAt:'2026-08-26T08:00:00Z',lastExportAt:'2026-08-26T08:00:00Z'}));
let s=api.miniStatus();
assert.match(s.subtitle,/G0012/);assert.match(s.subtitle,/Nessuna modifica/);assert.equal(s.dirty,0);
sandbox.db.audits.push({at:'2026-08-26T08:01:00Z'});
s=api.miniStatus();assert.equal(s.dirty,1);assert.match(s.subtitle,/1 modifiche da esportare/);
assert.match(source,/lmMinimized/);assert.match(source,/so_master_panel_minimized_v1/);assert.match(source,/MASTER EXCEL · PRONTO/);assert.match(source,/>:not\(#lmMiniBar\)\{display:none!important\}/);
assert.ok(index.includes('master-panel-minimize.js'),'index must load Master panel minimize module');
assert.ok(index.indexOf('master-panel-minimize.js')>index.indexOf('master-generation-guard-v2.js'));
console.log('Master panel minimize OK: compact status, generation and dirty-state semantics validated.');
