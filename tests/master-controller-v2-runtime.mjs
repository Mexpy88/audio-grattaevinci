import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync('master-controller-v2.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const hardening=fs.readFileSync('ui-hardening.js','utf8');

assert.match(src,/single authoritative import path/i);
assert.match(src,/directImportV4/);
assert.match(src,/window\.renderRegistry=function\(\)\{return true\}/);
assert.match(src,/LocalMaster\.renderPanel=async function\(\)\{return true\}/);
assert.match(src,/rdMasterAddPlusV2/);
assert.doesNotMatch(hardening,/window\.importMappedMaster\s*=/,'ui-hardening must never own Master import');
assert.doesNotMatch(index,/addScript\(d,'localMasterUxJs'/,'retired local-master-ux must not load');
assert.doesNotMatch(index,/addScript\(d,'masterImportUiCleanupJs'/,'retired master-import-ui-cleanup must not load');
const schemaPos=index.indexOf("addScript(d,'masterSchemaV4Js'");
const controllerPos=index.indexOf("addScript(d,'masterControllerV2Js'");
const guardPos=index.indexOf("addScript(d,'masterGenerationGuardJs'");
assert.ok(schemaPos>=0&&controllerPos>schemaPos&&guardPos>controllerPos,'Master load order must be V4 -> Controller -> Generation Guard');

class ClassList{
  constructor(){this.s=new Set()}add(...x){x.forEach(v=>this.s.add(v))}remove(...x){x.forEach(v=>this.s.delete(v))}contains(x){return this.s.has(x)}toggle(x,on){if(on===undefined)on=!this.s.has(x);on?this.s.add(x):this.s.delete(x);return on}
}
class FakeEl{
  constructor(id=''){this.id=id;this.textContent='';this.innerHTML='';this.className='';this.classList=new ClassList();this.dataset={};this.style={};this.disabled=false;this.listeners={};this.title='';this.parentNode=null;this.open=false}
  addEventListener(t,fn){(this.listeners[t]??=[]).push(fn)}
  querySelector(){return null}querySelectorAll(){return[]}setAttribute(){}removeAttribute(){}replaceWith(){}insertAdjacentElement(){}close(){this.open=false}
}
class MO{constructor(fn){this.fn=fn}observe(){}}

const listeners={};
const body=new FakeEl('body'),head=new FakeEl('head');head.appendChild=()=>{};
const info=new FakeEl('masterPreviewInfo');
const elements=new Map([['masterPreviewInfo',info]]);
const document={
  body,head,
  addEventListener(type,fn){listeners[type]=fn},
  createElement(tag){const el=new FakeEl(tag);if(tag==='div')Object.defineProperty(el,'innerHTML',{set(v){this._html=String(v);this.textContent=this._html.replace(/<[^>]*>/g,' ')},get(){return this._html||''}});return el},
  getElementById(id){return elements.get(id)||null},
  querySelector(){return null},querySelectorAll(){return[]}
};

const store=new Map();
const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
let wrapperCalls=0,registryCalls=0,panelCalls=0,saveCalls=0;
const db={master:{rows:[],filename:'',imported_at:null},audits:[],movements:[],documents:[],requests:[],counters:{}};
const directImporter=async()=>{
  // These calls would reach historical wrappers without transaction isolation.
  window.renderRegistry();
  await window.LocalMaster.renderPanel();
  db.master={rows:[{article_base:'I00001',size:'M',quantity:10,state:'NUOVO'}],filename:'MASTER.xlsx',imported_at:'2026-08-27T22:30:00.000Z',sheet:'MAGAZZINO',operator:'Mattia',schema:'MASTER_V4'};
  return true;
};
const window={
  importMappedMaster:directImporter,
  confirm:()=>true,alert:()=>{},audit:()=>{},
  renderRegistry:()=>{registryCalls++},
  LocalMaster:{renderPanel:async()=>{panelCalls++},chooseImport:()=>true},
  addEventListener:()=>{}
};
const context={window,document,localStorage,db,console,structuredClone:globalThis.structuredClone,MutationObserver:MO,requestAnimationFrame:fn=>fn(),setInterval:()=>1,setTimeout:fn=>{fn();return 1},warehouseToast:()=>{},saveDb:()=>{saveCalls++},uid:()=>`ID-${saveCalls}`,operatorName:()=> 'Mattia',renderMasterStatus:()=>{}};
Object.assign(window,context);window.window=window;
vm.createContext(context);vm.runInContext(src,context,{filename:'master-controller-v2.js'});
const api=window.WarehouseMasterControllerV2;assert.ok(api,'Master Controller API missing');
assert.equal(api.directImportV4,directImporter,'Controller did not capture direct V4 importer');

// Simulate the later Generation Guard installing a legacy wrapper around the global.
window.importMappedMaster=async()=>{wrapperCalls++;throw new RangeError('Maximum call stack size exceeded')};
api.decorate();
assert.equal(window.importMappedMaster,directImporter,'Controller must restore direct global importer');

const file={name:'MASTER.xlsx',arrayBuffer:async()=>new ArrayBuffer(8)};
listeners.change({target:{id:'masterInput',files:[file]}});
const ok=await api.executeImport(null,null);
assert.notEqual(ok,false,'Direct Master import should succeed');
assert.equal(wrapperCalls,0,'Legacy wrapper was executed');
assert.equal(registryCalls,0,'Registry wrapper must be isolated during critical import');
assert.equal(panelCalls,0,'Legacy Master panel wrapper must be isolated during critical import');
assert.equal(db.master.rows.length,1,'Master data was not committed');
assert.equal(db.audits.length,1,'Compact MASTER_IMPORT audit missing');
assert.equal(db.audits[0].action,'MASTER_IMPORT');
assert.equal(db.audits[0].after.rows_count,1,'Compact audit must not contain full row arrays');
assert.ok(saveCalls>=1,'Import audit was not persisted');

console.log('Master Controller V2 runtime OK: direct importer, wrapper bypass, isolated render transaction, compact audit.');
