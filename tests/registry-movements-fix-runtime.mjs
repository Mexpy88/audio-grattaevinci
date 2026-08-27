import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const fix=fs.readFileSync('registry-movements-fix-v1.js','utf8');
const polish=fs.readFileSync('ux-polish-v3.js','utf8');
const role=fs.readFileSync('role-dashboard-v1.js','utf8');

assert.match(fix,/2026\.08\.27-registry-movements-fix2-surgical/);
assert.match(fix,/window\.openRoleRegistryMovementsV1=openMovements/);
assert.match(fix,/renderDirect/);
assert.match(fix,/movementRows/);
assert.match(fix,/dischargeRows/);
assert.match(fix,/REGISTRY_VIEW/);
assert.match(fix,/rdMobileDirtyCompact/);
assert.match(fix,/background:transparent!important/);
assert.match(fix,/\.uxDirtyText\{display:none!important\}/);
assert.match(fix,/tabs\.style\.removeProperty\('display'\)/);

// Dashboard still calls the public role action; loader still supplies this isolated fix.
assert.match(role,/openRoleRegistryMovementsV1\(\)/);
assert.match(polish,/registry-movements-fix-v1\.js/);
assert.match(polish,/loadRegistryFix/);

// Surgical repair must not replace shared application engines.
assert.ok(!/window\.renderRegistry\s*=(?!=)/.test(fix));
assert.ok(!/window\.saveDb\s*=(?!=)/.test(fix));
assert.ok(!/window\.setRegistryTab\s*=(?!=)/.test(fix));
assert.ok(!/window\.syncAuthUI\s*=(?!=)/.test(fix));

// Lightweight runtime check: poison the historical global Registry APIs. The new path must still render.
class ClassList{
  constructor(){this.s=new Set()}
  add(...x){x.forEach(v=>this.s.add(v))}
  remove(...x){x.forEach(v=>this.s.delete(v))}
  toggle(v,on){if(on===undefined){if(this.s.has(v)){this.s.delete(v);return false}this.s.add(v);return true}on?this.s.add(v):this.s.delete(v);return on}
  contains(v){return this.s.has(v)}
}
function el(id){return {id,value:'',innerHTML:'',textContent:'',dataset:{},disabled:false,style:{setProperty(){},removeProperty(){}},classList:new ClassList(),removeAttribute(){},addEventListener(){},querySelector(){return null},appendChild(){},setAttribute(){}}}
const els={
  registryScreen:el('registryScreen'),registryFilters:el('registryFilters'),registryList:el('registryList'),regFrom:el('regFrom'),regTo:el('regTo'),regDest:el('regDest'),exportFilteredBtn:el('exportFilteredBtn'),tabMovBtn:el('tabMovBtn'),tabDocBtn:el('tabDocBtn'),editMovementDialog:el('editMovementDialog')
};
els.registryScreen.querySelector=sel=>sel===':scope>.back'?el('back'):sel==='.tabs'?{style:{removeProperty(){}}}:null;
els.registryScreen.classList.add('on');
els.registryFilters.appendChild=node=>{els[node.id]=node};
const document={
  body:{classList:new ClassList(),appendChild(){}},
  getElementById:id=>els[id]||null,
  createElement(tag){const n=el('');n.tagName=tag.toUpperCase();Object.defineProperty(n,'id',{get(){return this._id||''},set(v){this._id=v;els[v]=this}});return n},
  querySelectorAll(){return []}
};
const context={
  console,document,window:null,db:{movements:[{id:'m1',article_base:'I123',size:'M',quantity:7,state:'NUOVO',movement_type:'CARICA',operation_at:'2026-08-27T10:00:00Z',operator:'Mattia',fila_scaffale:'9',bancale:'2'}],documents:[]},
  WarehouseRoleDashboardV1:{can:()=>true,deny:()=>false},
  renderRegistry(){throw new Error('historical renderer must not be called')},
  setRegistryTab(){throw new Error('historical tab setter must not be called')},
  show(){},requestAnimationFrame(fn){fn()},setTimeout(fn){fn()},locationOf:r=>r.fila_scaffale||'',fmtDateTime:v=>v,esc:s=>String(s),registryTab:'MOVIMENTI'
};
context.window=context;
vm.runInNewContext(fix,context,{filename:'registry-movements-fix-v1.js'});
context.WarehouseRegistryMovementsFixV1.openMovements();
assert.match(els.registryList.innerHTML,/I123/);
assert.match(els.registryList.innerHTML,/\+7/);
assert.equal(els.tabMovBtn.classList.contains('active'),true);

console.log('Registry Movimenti surgical runtime fix OK');
