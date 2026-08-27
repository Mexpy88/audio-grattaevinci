import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const fix=fs.readFileSync('registry-movements-fix-v1.js','utf8');
const polish=fs.readFileSync('ux-polish-v3.js','utf8');
const role=fs.readFileSync('role-dashboard-v1.js','utf8');

assert.doesNotThrow(()=>new vm.Script(fix));
assert.match(fix,/2026\.08\.27-registry-movements-ux3-premium/);
assert.match(fix,/rdRegistryToolbar/);
assert.match(fix,/rdRegistryFilterToggle/);
assert.match(fix,/AZZERA FILTRI/);
assert.match(fix,/Taglia \$\{html\(m\.size\)\}/);
assert.match(fix,/rdMoveRoute/);
assert.match(fix,/rdMoveNote/);
assert.match(fix,/rdMoveActions/);
assert.match(fix,/window\.openRoleRegistryMovementsV1=openMovements/);
assert.match(fix,/renderDirect/);
assert.match(fix,/movementRows/);
assert.match(fix,/dischargeRows/);
assert.match(fix,/REGISTRY_VIEW/);
assert.match(fix,/rdMobileDirtyCompact/);
assert.match(fix,/tabs\.style\.removeProperty\('display'\)/);

// Dashboard still calls the public role action; loader still supplies this isolated UX module.
assert.match(role,/openRoleRegistryMovementsV1\(\)/);
assert.match(polish,/registry-movements-fix-v1\.js/);
assert.match(polish,/loadRegistryFix/);

// The Registry presentation must not replace shared application/data engines.
assert.ok(!/window\.renderRegistry\s*=(?!=)/.test(fix));
assert.ok(!/window\.saveDb\s*=(?!=)/.test(fix));
assert.ok(!/window\.setRegistryTab\s*=(?!=)/.test(fix));
assert.ok(!/window\.syncAuthUI\s*=(?!=)/.test(fix));

class ClassList{
  constructor(){this.s=new Set()}
  add(...x){x.forEach(v=>this.s.add(v))}
  remove(...x){x.forEach(v=>this.s.delete(v))}
  toggle(v,on){
    if(on===undefined){if(this.s.has(v)){this.s.delete(v);return false}this.s.add(v);return true}
    on?this.s.add(v):this.s.delete(v);return on
  }
  contains(v){return this.s.has(v)}
}
const els={};
function el(id){
  return {
    id,value:'',innerHTML:'',textContent:'',dataset:{},disabled:false,firstChild:null,
    style:{setProperty(){},removeProperty(){}},
    classList:new ClassList(),
    removeAttribute(){},addEventListener(){},setAttribute(){},
    appendChild(node){if(node?.id)els[node.id]=node;node.parentNode=this;return node},
    insertBefore(node){if(node?.id)els[node.id]=node;node.parentNode=this;return node},
    insertAdjacentElement(where,node){if(node?.id)els[node.id]=node;node.parentNode=this;return node},
    focus(){},querySelector(){return null}
  };
}
Object.assign(els,{
  registryScreen:el('registryScreen'),
  registryFilters:el('registryFilters'),
  registryList:el('registryList'),
  regFrom:el('regFrom'),
  regTo:el('regTo'),
  regDest:el('regDest'),
  exportFilteredBtn:el('exportFilteredBtn'),
  tabMovBtn:el('tabMovBtn'),
  tabDocBtn:el('tabDocBtn'),
  editMovementDialog:el('editMovementDialog')
});
const h1=el('h1'),tabs=el('tabs'),back=el('back');
els.registryScreen.querySelector=sel=>sel==='h1'?h1:sel===':scope>.back'?back:sel==='.tabs'?tabs:null;
els.registryScreen.classList.add('on');
const document={
  body:{classList:new ClassList(),appendChild(){}},
  head:{appendChild(){}},
  getElementById:id=>els[id]||null,
  createElement(tag){
    const n=el('');n.tagName=tag.toUpperCase();
    Object.defineProperty(n,'id',{get(){return this._id||''},set(v){this._id=v;els[v]=this}});
    return n
  },
  querySelectorAll(){return []}
};
const context={
  console,document,window:null,
  db:{
    movements:[{
      id:'m1',article_base:'SZ262VRCUHF',size:'47',quantity:13,state:'NUOVO',movement_type:'SCARICA',
      operation_at:'2026-08-26T09:28:00Z',operator:'Mattia',fila_scaffale:'48',destination:'LINA',
      document_id:'SC-2026-00003',note:'Cartoni presi: 2'
    }],
    documents:[]
  },
  WarehouseRoleDashboardV1:{can:()=>true,deny:()=>false},
  renderRegistry(){throw new Error('historical renderer must not be called')},
  setRegistryTab(){throw new Error('historical tab setter must not be called')},
  show(){},requestAnimationFrame(fn){fn()},setTimeout(fn){fn()},
  locationOf:r=>r.fila_scaffale||'',fmtDateTime:v=>v,esc:s=>String(s),registryTab:'MOVIMENTI'
};
context.window=context;
vm.runInNewContext(fix,context,{filename:'registry-movements-fix-v1.js'});
context.WarehouseRegistryMovementsFixV1.openMovements();
assert.match(els.registryList.innerHTML,/SZ262VRCUHF/);
assert.match(els.registryList.innerHTML,/Taglia 47/);
assert.match(els.registryList.innerHTML,/−13/);
assert.match(els.registryList.innerHTML,/Fila\/Scaffale 48/);
assert.match(els.registryList.innerHTML,/LINA/);
assert.match(els.registryList.innerHTML,/SC-2026-00003/);
assert.match(els.registryList.innerHTML,/Cartoni presi: 2/);
assert.equal(els.tabMovBtn.classList.contains('active'),true);

console.log('Registry Movimenti premium UX runtime OK');
