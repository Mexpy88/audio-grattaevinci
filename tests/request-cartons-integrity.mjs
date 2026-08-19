import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('request-cartons.js','utf8');
const sandbox={
  console,
  window:null,
  document:{getElementById:()=>null,querySelectorAll:()=>[]},
  db:{requests:[]},
  requestPhotos:[{}],
  requestReviewLines:[],
  normalizeArticle:v=>String(v??'').trim().toUpperCase().replace(/^1(?=[A-Z0-9])/,'I'),
  saveDb:()=>{},
  warehouseToast:()=>{},
  esc:v=>String(v??''),
  Math,Number,String,Date,Map,JSON,Promise,setTimeout,clearTimeout
};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(src,sandbox,{filename:'request-cartons.js'});

function fail(msg){console.error('REQUEST CARTONS FAILED:',msg);process.exit(1)}
if(!sandbox.RequestCartons)fail('RequestCartons API missing');
const prompt=sandbox.requestPrompt();
if(!/NUMERO DI CARTONI/i.test(prompt)||!/NON il numero di pezzi/i.test(prompt))fail('prompt does not explicitly separate cartons from pieces');
const normalized=sandbox.normalizeRequest({lines:[{article_base:'130861',size:'M',quantity:'2*',note:'test'}]});
if(normalized.length!==1)fail('normalizeRequest row count');
if(normalized[0].quantity!==2||normalized[0].cartons!==2||normalized[0].marker!=='*')fail('1*/2* carton parsing failed');
const req={quantity_unit:'CARTONI',request_schema:2,deliveries:[{items:[{article_base:'I30861',size:'M',quantity:1,cartons:1,pieces:24,extra:false}]}]};
const c=sandbox.RequestCartons.deliveredCartons(req).get('I30861|M');
const p=sandbox.RequestCartons.deliveredPieces(req).get('I30861|M');
if(c!==1||p!==24)fail(`carton/piece separation failed (${c}/${p})`);
if(!/quantity:pieces/.test(src))fail('movement quantity is not explicitly pieces');
if(!/quantity:cartons,cartons,pieces/.test(src))fail('delivery item does not preserve cartons and pieces');
if(!/Cartoni richiesti/.test(src)||!/Pezzi da scaricare/.test(src))fail('UI labels missing');
console.log('Request cartons OK: PRENDERE is cartons; stock movement is pieces; both values are persisted separately.');
