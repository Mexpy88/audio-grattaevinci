import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('master-generation-guard-v2.js','utf8');
const index=fs.readFileSync('index.html','utf8');

const storage=new Map();
const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const body={appendChild(){}};
const document={body,addEventListener(){},getElementById(){return null},createElement(){return {style:{},querySelector(){return null},appendChild(){},addEventListener(){},showModal(){},close(){}}},querySelector(){return null}};
class MutationObserver{constructor(){} observe(){} disconnect(){}}
class HTMLAnchorElement{}
HTMLAnchorElement.prototype.click=function(){};
const XLSX={write(){},read(){},utils:{sheet_to_json(){return []},aoa_to_sheet(){return {}}}};
const LocalMaster={exportUpdatedMaster:async()=>true};
const sandbox={console,TextEncoder,Uint8Array,Uint32Array,DataView,Math,Date,JSON,String,Number,Object,Array,RegExp,Error,Map,Set,setInterval(){return 1},clearInterval(){},setTimeout(){},alert(){},crypto:{getRandomValues(a){a.fill(7);return a}},localStorage,document,MutationObserver,HTMLAnchorElement,XLSX,LocalMaster,importMappedMaster:async()=>true,warehouseToast(){}};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'master-generation-guard-v2.js'});
const g=sandbox.WarehouseMasterGenerationGuard;
assert.ok(g,'guard API not exposed');
assert.equal(g.version,'2026.08.26-master-generation2');
assert.equal(g.sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','SHA-256 implementation is incorrect');

localStorage.setItem('so_master_generation_guard_v1',JSON.stringify({lineageId:'SO-TEST',maxGeneration:128,maxHash:'hash128',lastExportAt:'2026-08-26T06:57:00.000Z'}));
let v=g.validateInspection({protected:true,integrity:true,generation:127,lineage:'SO-TEST',stateHash:'hash127'});
assert.equal(v.ok,false);assert.match(v.title,/obsoleto/i);
v=g.validateInspection({protected:false,integrity:true,generation:0,lineage:'',stateHash:''});
assert.equal(v.ok,false);assert.match(v.title,/obsoleto|non protetto/i);
v=g.validateInspection({protected:true,integrity:true,generation:128,lineage:'SO-TEST',stateHash:'hash128'});
assert.equal(v.ok,true,'same exact generation must be re-importable');
v=g.validateInspection({protected:true,integrity:true,generation:128,lineage:'SO-TEST',stateHash:'different'});
assert.equal(v.ok,false);assert.match(v.title,/Conflitto/i);
v=g.validateInspection({protected:true,integrity:true,generation:129,lineage:'SO-TEST',stateHash:'hash129'});
assert.equal(v.ok,true,'newer generation in same lineage should be accepted');
v=g.validateInspection({protected:true,integrity:true,generation:129,lineage:'OTHER',stateHash:'hash129'});
assert.equal(v.ok,false);assert.match(v.title,/altra catena/i);
v=g.validateInspection({protected:true,integrity:false,generation:129,lineage:'SO-TEST',stateHash:'hash129'});
assert.equal(v.ok,false);assert.match(v.title,/non valido/i);

const name=g.generationFileName(128,new Date(2026,7,26,8,57,0));
assert.equal(name,'MAGAZZINO_SO_MASTER_G0128_2026-08-26_08-57.xlsx');
assert.match(source,/so_master_generation_guard_v1/);
assert.match(source,/state_hash/);
assert.match(source,/parent_generation/);
assert.match(source,/Master obsoleto/);
assert.match(source,/MAGAZZINO_SO_MASTER_G/);
assert.match(source,/HTMLAnchorElement\.prototype\.click/,'export filename interception missing');
assert.match(source,/window\.importMappedMaster=wrapped/,'import guard must wrap final mapped import');
assert.match(source,/masterImportedAt\(\)/,'global lexical db import tracking missing');
const reqPos=index.indexOf('request-completion-workflow.js');
const guardPos=index.indexOf('master-generation-guard-v2.js');
assert.ok(reqPos>=0&&guardPos>reqPos,'master generation guard v2 must load as final protection after request workflow');
assert.equal(index.includes('master-generation-guard.js?v='),false,'obsolete v1 guard must not be loaded');
console.log('Master generation guard v2 OK: rollback, legacy, lineage, integrity, same-generation and filename rules validated.');
