import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const direct=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('bundle/request-v16.css','utf8');

assert.match(direct,/<title>Magazzino NOVA · Teramo · V16<\/title>/);
assert.match(direct,/bundle\/request-v16\.css\?v=20260901-v16/);
assert.match(css,/NOVA request UX V16/);
assert.match(css,/\.request-card \.status-pill/);
assert.match(css,/place-items:center!important/);
assert.match(css,/\.request-card-actions/);
assert.match(css,/\.request-delete-btn/);
assert.match(css,/\.extra-pick-collapsible/);
assert.match(css,/--v16-extra-bg:#f6f1fb/);

assert.match(direct,/deleteUnworked\(id,reason=''/);
assert.match(direct,/REQUEST_DELETED/);
assert.match(direct,/data-action="request-delete"/);
assert.match(direct,/Elimina richiesta/);
assert.match(direct,/<details class="extra-pick-collapsible">/);
assert.match(direct,/<summary><span class="extra-pick-icon"/);
assert.match(direct,/extra-pick-chevron/);
assert.doesNotMatch(direct,/<section class="form-card extra-pick"><h2>Materiale non richiesto<\/h2>/);
assert.match(direct,/EXPORT EXCEL V15/);
assert.match(direct,/async function enhanceWorkbookTables/);
assert.match(direct,/filterButton:true/);

const script=(direct.match(/<script>([\s\S]*?)<\/script>/)||[])[1];
assert.ok(script,'application script missing');
new vm.Script(script,{filename:'nova-v16.js'});

const core=(script.split('/* js/core.js */')[1]||'').split('/* js/domain.js */')[0];
const domain=(script.split('/* js/domain.js */')[1]||'').split('/* js/excel.js */')[0];
assert.ok(core&&domain,'core/domain missing');
const runtime=core+'\n'+domain+`
class M{constructor(){this.m=new Map()}getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
globalThis.localStorage=new M();
const s={db:createEmptyDb(),save(){},snapshot(){return structuredClone(this.db)},replace(x){this.db=x}};
const a={user:'Mattia',can(c){return PROFILES[this.user].caps.includes(c)},isLina(){return this.user==='Lina'}};
const d=createDomain(s,a);
s.db.master.rows=[{article:'REQ',size:'M',state:'NUOVO',quantity:20,location:'1',pallet:'A'}];d.stock.invalidate();
const rq=d.requests.create({destination:'LINA',lines:[{article:'REQ',size:'M',cartonsRequested:2}]});
const id=rq.id;
d.requests.deleteUnworked(id,'Test V16');
if(s.db.requests.some(x=>x.id===id))throw new Error('V16 deleted request must leave active list');
const audit=(s.db.audits||[]).find(x=>x.action==='REQUEST_DELETED'&&x.entityId===id);
if(!audit)throw new Error('V16 delete audit missing');
if(d.stock.total('REQ','M')!==20)throw new Error('V16 deleting unworked request must not alter stock');
const rq2=d.requests.create({destination:'LINA',lines:[{article:'REQ',size:'M',cartonsRequested:2}]});
d.requests.fulfill(rq2.id,[{lineId:rq2.lines[0].id,sourceKey:bucketKey({article:'REQ',size:'M',state:'NUOVO',location:'1',pallet:'A'}),cartons:1,pieces:1}]);
let blocked=false;try{d.requests.deleteUnworked(rq2.id,'Should fail')}catch{blocked=true}
if(!blocked)throw new Error('V16 worked request must not be deletable');
`;
vm.runInNewContext(runtime,{console,structuredClone,crypto:globalThis.crypto,Date,Math,Number,String,Array,Map,Set,JSON,Object,Error,Intl});

console.log('NOVA V16 request delete + centered status + collapsible extra material: OK');
