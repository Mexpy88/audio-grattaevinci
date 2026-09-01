import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const direct=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('bundle/workflow-v14.css','utf8');

assert.match(direct,/<title>Magazzino NOVA · Teramo · V14<\/title>/);
assert.match(direct,/bundle\/workflow-v14\.css\?v=20260901-v14/);
assert.match(css,/NOVA workflow V14/);
assert.match(css,/\.workflow-actions/);
assert.match(css,/\.record-actions/);
assert.match(css,/#operationConfirmDialog\[open\]/);

assert.match(direct,/EXCELJS_URL='https:\/\/cdn\.jsdelivr\.net\/npm\/exceljs@4\.4\.0\/dist\/exceljs\.min\.js'/);
assert.match(direct,/async function ensureExcelJs\(\)/);
assert.match(direct,/async function enhanceWorkbookTables\(/);
assert.match(direct,/ws\.addTable\(/);
assert.match(direct,/TableStyleMedium4/);
assert.match(direct,/ws\.autoFilter=/);
assert.match(direct,/masterHeaderRow:Number\(this\.store\.db\.master\.headerRow\|\|0\)\+1/);
assert.match(direct,/registryOnly:true/);
assert.match(direct,/EXPORT EXCEL V14/);
assert.match(direct,/tabelle Excel reali, intestazioni, filtri/);

assert.doesNotMatch(direct,/>Numero DDT</);
assert.match(direct,/>Numero Documento</);
assert.match(direct,/>Data Documento</);
assert.match(direct,/>Quantità documento</);
assert.match(direct,/SCANSIONA DOCUMENTO/);
assert.match(direct,/NUMERO DOCUMENTO/);
assert.match(direct,/QTA DOCUMENTO/);

assert.match(direct,/data-action="receipt-draft-cancel">ANNULLA BOZZA/);
assert.match(direct,/data-action="request-draft-cancel">ANNULLA BOZZA/);
assert.match(direct,/data-action="workflow-back">ANNULLA/);
assert.match(direct,/data-action="receipt-cancel"/);
assert.match(direct,/data-action="request-cancel"/);
assert.match(direct,/data-action="request-close"/);
assert.match(direct,/id="operationConfirmDialog"/);
assert.match(direct,/RECEIPT_CANCELLED/);
assert.match(direct,/REQUEST_CANCELLED/);
assert.match(direct,/REQUEST_CLOSED_PARTIAL/);
assert.match(direct,/CHIUSA PARZIALE/);
assert.match(direct,/status\(receipt\)\{if\(receipt\?\.cancelledAt\)return'ANNULLATA'/);
assert.match(direct,/La richiesta è già chiusa e non può essere lavorata/);

const script=(direct.match(/<script>([\s\S]*?)<\/script>/)||[])[1];
assert.ok(script,'application script missing');
new vm.Script(script,{filename:'nova-v14.js'});

const core=(script.split('/* js/core.js */')[1]||'').split('/* js/domain.js */')[0];
const domain=(script.split('/* js/domain.js */')[1]||'').split('/* js/excel.js */')[0];
assert.ok(core&&domain,'core/domain missing');

const runtime=core+'\n'+domain+`
class M{constructor(){this.m=new Map()}getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
globalThis.localStorage=new M();
const s={db:createEmptyDb(),save(){},snapshot(){return structuredClone(this.db)},replace(x){this.db=x}};
const a={user:'Mattia',can(c){return PROFILES[this.user].caps.includes(c)},isLina(){return this.user==='Lina'}};
const d=createDomain(s,a);

s.db.master.rows=[{article:'BASE',size:'M',state:'NUOVO',quantity:10,location:'1',pallet:'A'},{article:'REQ',size:'M',state:'NUOVO',quantity:20,location:'2',pallet:'B'}];
d.stock.invalidate();

const receipt=d.receiving.create({supplier:'TEST',ddtNumber:'DOC1',lines:[{article:'BASE',size:'M',state:'NUOVO',ddtQuantity:5,checkedQuantity:5,pallet:'P'}]});
if(d.stock.total('BASE','M')!==15)throw new Error('V14 receipt create regression');
if(!d.receiving.canCancel(receipt).ok)throw new Error('Fresh receipt must be cancellable');
d.receiving.cancel(receipt.id,'Test storno');
if(d.stock.total('BASE','M')!==10)throw new Error('Receipt cancellation must restore stock');
if(d.receiving.status(receipt)!=='ANNULLATA')throw new Error('Receipt must become ANNULLATA');
if(!(s.db.audits||[]).some(x=>x.action==='RECEIPT_CANCELLED'))throw new Error('Receipt cancellation audit missing');

const rq1=d.requests.create({destination:'LINA',lines:[{article:'REQ',size:'M',cartonsRequested:2}]});
d.requests.cancel(rq1.id,'Non serve');
if(rq1.status!=='ANNULLATA')throw new Error('Request cancel status regression');
let blocked=false;try{d.requests.fulfill(rq1.id,[{lineId:rq1.lines[0].id,sourceKey:bucketKey({article:'REQ',size:'M',state:'NUOVO',location:'2',pallet:'B'}),cartons:1,pieces:1}])}catch{blocked=true}
if(!blocked)throw new Error('Cancelled request must not be fulfillable');

const rq2=d.requests.create({destination:'LINA',lines:[{article:'REQ',size:'M',cartonsRequested:2}]});
d.requests.fulfill(rq2.id,[{lineId:rq2.lines[0].id,sourceKey:bucketKey({article:'REQ',size:'M',state:'NUOVO',location:'2',pallet:'B'}),cartons:1,pieces:3}]);
if(rq2.status!=='PARZIALE')throw new Error('Partial request regression');
d.requests.closeRemaining(rq2.id,'Residuo non necessario');
if(rq2.status!=='CHIUSA PARZIALE')throw new Error('Partial close status regression');
if(d.stock.total('REQ','M')!==17)throw new Error('Closing residual must not remove extra stock');
if(!(s.db.audits||[]).some(x=>x.action==='REQUEST_CLOSED_PARTIAL'))throw new Error('Partial close audit missing');
`;
vm.runInNewContext(runtime,{console,structuredClone,crypto:globalThis.crypto,Date,Math,Number,String,Array,Map,Set,JSON,Object,Error,Intl});

console.log('NOVA V14 lifecycle + terminology + Excel table contracts: OK');
