import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const controller=fs.readFileSync('master-controller-v1.js','utf8');
const hardening=fs.readFileSync('ui-hardening.js','utf8');
const localUx=fs.readFileSync('local-master-ux.js','utf8');
const cleanup=fs.readFileSync('master-import-ui-cleanup.js','utf8');
const polish=fs.readFileSync('ux-polish-v3.js','utf8');

assert.match(controller,/2026\.08\.28-master-controller1/);
assert.match(controller,/validateGuard/);
assert.match(controller,/WarehouseMasterGenerationGuard/);
assert.match(controller,/WarehouseMasterSchemaV4/);
assert.match(controller,/parseMasterRows/);
assert.match(controller,/window\.importMappedMaster=confirmImport/);
assert.match(controller,/safeLegacyRenderPanel/);
assert.match(controller,/rdMaster\.rdNoMaster \.rdMasterDetails:before\{content:'\+'/);
assert.match(polish,/master-controller-v1\.js/);
assert.doesNotMatch(localUx,/window\.importMappedMaster\s*=/,'legacy local-master UX must not wrap importMappedMaster');
assert.doesNotMatch(cleanup,/window\.confirm\s*=/,'cleanup must not override confirm');
assert.doesNotMatch(cleanup,/window\.alert\s*=/,'cleanup must not override alert');
assert.doesNotMatch(hardening,/window\.importMappedMaster\s*=\s*execute/,'UI hardening must not own Master import');

class MO{observe(){}}
const classes=new Set();
const body={classList:{toggle:(n,on)=>on?classes.add(n):classes.delete(n)},appendChild(){},querySelector(){return null}};
const document={
  body,
  head:{appendChild(){}},
  getElementById(){return null},
  querySelector(){return null},
  createElement(tag){return {tagName:tag.toUpperCase(),id:'',className:'',textContent:'',innerHTML:'',dataset:{},style:{},setAttribute(){},appendChild(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},classList:{add(){},remove(){},toggle(){},contains(){return false}}}}
};
const local=new Map();
const localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)};
const db={master:{rows:[]},audits:[{at:'2026-08-28T05:00:00Z'}],movements:[],documents:[],requests:[]};
const window={LocalMaster:{renderPanel(){throw new Error('legacy renderPanel should be replaced')}},addEventListener(){}};
const sandbox={window,document,localStorage,db,console,MutationObserver:MO,requestAnimationFrame:fn=>fn(),setTimeout:fn=>{fn();return 1},clearTimeout(){},indexedDB:{open(){throw new Error('IDB should not be opened in installation test')}}};
Object.assign(window,sandbox);window.window=window;
vm.createContext(sandbox);
vm.runInContext(controller,sandbox);
const api=window.WarehouseMasterControllerV1;
assert.ok(api,'controller API missing');
assert.equal(api.dirtyCount(),0,'stale audits must not create pending export without a Master');
assert.equal(window.importMappedMaster,api.confirmImport,'compatibility global must point directly to authoritative controller');
assert.equal(window.LocalMaster.renderPanel,api.safeLegacyRenderPanel,'legacy renderPanel chain must be replaced');
console.log('Master Controller V1 ownership/runtime checks OK');
