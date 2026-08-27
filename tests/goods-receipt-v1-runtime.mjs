import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync('goods-receipt-v1.js','utf8');
const css=fs.readFileSync('goods-receipt-v1.css','utf8');
const polish=fs.readFileSync('ux-polish-v3.js','utf8');

assert.match(src,/2026\.08\.27-goods-receipt-v1\.0/);
assert.match(src,/AREA RICEVIMENTO/);
assert.match(src,/logistic_status:'DA_UBICARE'/);
assert.match(src,/availability:'DISPONIBILE'/);
assert.match(src,/source:'ENTRATA_MERCI'/);
assert.match(src,/movement_type:'CARICA'/);
assert.match(src,/movement_type:'SCARICA'/);
assert.match(src,/GOODS_RECEIPT_CONFIRMED/);
assert.match(src,/recipient:'Lina'/);
assert.match(src,/ENTRATE_MERCI/);
assert.match(src,/POSIZIONE SUGGERITA/);
assert.match(src,/MOVIMENTAZIONE/);
assert.match(src,/SCANSIONA DDT/);
assert.match(src,/Quantità controllata/);
assert.match(src,/Prelevati dal ricevimento/);
assert.match(src,/appendGoodsReceiptSheet/);
assert.match(css,/grExcelOfficialV1/);
assert.match(css,/grLinaGoodsNotifications/);
assert.match(polish,/goods-receipt-v1\.css/);
assert.match(polish,/goods-receipt-v1\.js/);
assert.match(polish,/loadGoodsReceipt/);

// The receiving extension must not replace the stock/request/master engines.
assert.ok(!/window\.stockBuckets\s*=/.test(src));
assert.ok(!/window\.saveDb\s*=/.test(src));
assert.ok(!/window\.confirmPicking\s*=/.test(src));
assert.ok(!/window\.LocalMaster\s*=/.test(src));

class ClassList{add(){} remove(){} toggle(){} contains(){return false}}
const document={
  body:{classList:new ClassList(),appendChild(){}},
  querySelector(){return null},querySelectorAll(){return[]},getElementById(){return null},
  createElement(){return {id:'',className:'',innerHTML:'',classList:new ClassList(),appendChild(){},addEventListener(){},setAttribute(){},querySelector(){return null},querySelectorAll(){return[]},style:{setProperty(){}}}},
  addEventListener(){},hidden:false
};
const db={goods_receipts:[],notifications:[],stock_transfers:[],movements:[],audits:[],counters:{}};
const stocks=[
  {article_base:'I100',size:'M',state:'NUOVO',fila_scaffale:'12',bancale:'4',quantity:70},
  {article_base:'I100',size:'M',state:'NUOVO',fila_scaffale:'AREA RICEVIMENTO',bancale:'EM-2026-00001-P01-01',quantity:30}
];
const context={console,document,db,window:null,currentUser:'Mattia',navigator:{},
  locationOf:r=>r.fila_scaffale||'',normalizeArticle:v=>String(v||'').trim().toUpperCase(),stockBuckets:()=>stocks,
  WarehouseRoleDashboardV1:{can:()=>true,deny:()=>false},LocalMaster:{exportUpdatedMaster:async()=>true,requireMaster:()=>true},
  requestAnimationFrame:fn=>fn(),MutationObserver:class{observe(){}},setInterval:()=>0,setTimeout:fn=>fn(),
  addEventListener(){},saveDb(){},operatorName:()=> 'Mattia',uid:()=>Math.random().toString(36).slice(2),show(){},requireLogin:()=>true,
  audit(){},alert(){},warehouseToast(){},XLSX:null
};
context.window=context;
vm.runInNewContext(src,context,{filename:'goods-receipt-v1.js'});
const api=context.WarehouseGoodsReceiptV1;
assert.ok(api);
assert.equal(api.receivingLocation,'AREA RICEVIMENTO');
assert.deepEqual(JSON.parse(JSON.stringify(api.suggestPosition('I100','M','NUOVO'))),{location:'12',pallet:'4',quantity:70,reason:'Stesso articolo già presente'});
const line={article_base:'I100',size:'M',state:'NUOVO',checked_quantity:50,temp_bancale:'EM-2026-00001-P01-01',ubicazioni:[{quantity:10}]};
assert.equal(api.pendingLineQty(line),30);
const stats=api.receiptStats({lines:[line]});
assert.equal(stats.received,50);
assert.equal(stats.pending,30);
assert.equal(stats.putAway,10);
assert.equal(stats.direct,10);
assert.equal(api.receiptStatus({lines:[line]}),'PARZIALMENTE GESTITA');

console.log('Entrata Merci V1 runtime + integration contract OK');
