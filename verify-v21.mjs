import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

class MemoryStorage {
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(key)?this.map.get(key):null}
  setItem(key,value){this.map.set(key,String(value))}
  removeItem(key){this.map.delete(key)}
}

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
const base=scripts.find(source=>source.includes('/* js/core.js */'));
assert.ok(base,'Script applicativo V19 non trovato');

const storage=new MemoryStorage();
const context={
  console,
  crypto:crypto.webcrypto,
  structuredClone:globalThis.structuredClone,
  TextEncoder,
  setTimeout,
  clearTimeout,
  localStorage:storage,
  sessionStorage:new MemoryStorage(),
};
context.globalThis=context;
vm.createContext(context);

const testBootstrap=`
/* js/app.js */
const store=new Store({storage:globalThis.localStorage});
const auth=new AuthService({session:globalThis.sessionStorage});
auth.user='Mattia';
const domain=createDomain(store,auth);
const ui={
  store,auth,domain,
  requestCard(){return '<article class="request-card"><div class="request-card-actions"></div></article>'},
  requestDetail(){return '<div class="summary-three"><div></div></div>'},
  action(){},input(){},
};
globalThis.NOVA={version:CONFIG.version,store,auth,domain,ui};
globalThis.__V21_TEST={CONFIG,store,auth,domain,ui,bucketKey};
`;
const testableBase=base.replace(/\/\* js\/app\.js \*\/[\s\S]*$/m,testBootstrap);
vm.runInContext(testableBase,context,{filename:'index.html'});
vm.runInContext(fs.readFileSync(new URL('./v21-picking.js',import.meta.url),'utf8'),context,{filename:'v21-picking.js'});

const {CONFIG,store:dbStore,domain,bucketKey}=context.__V21_TEST;
const source={article:'I90001',size:'M',state:'NUOVO',quantity:15,location:'64',pallet:'165'};
dbStore.db.master.rows=[source];
dbStore.db.master.importedAt=new Date().toISOString();
dbStore.save('test:seed');

const request=domain.requests.create({destination:'LINA',lines:[{article:'I90001',size:'M',cartonsRequested:1}]});
const line=request.lines[0],sourceKey=bucketKey(source);
const issue=domain.requests.fulfill(request.id,[{lineId:line.id,sourceKey,cartons:1,pieces:50}],'Test eccedenza');

assert.equal(domain.stock.total('I90001','M'),0,'La giacenza deve fermarsi a zero');
assert.equal(issue.items[0].pieces,50,'I pezzi fisici devono restare 50');
assert.equal(issue.items[0].stockDebitedPieces,15,'Il Master deve scaricare solo i 15 disponibili');
assert.equal(issue.items[0].inventoryShortage,35,'Lo scostamento deve essere 35');
assert.equal(request.status,'COMPLETATA');
assert.deepEqual(JSON.parse(JSON.stringify(domain.requests.summary(request))),{requested:1,delivered:1,remaining:0,pieces:50,percent:100});
assert.equal(request.inventoryAlerts.length,1);
assert.match(request.inventoryAlerts[0].note,/Bancale 165/);
assert.match(request.inventoryAlerts[0].note,/gestionale 15 pezzi/);
assert.match(request.inventoryAlerts[0].note,/prelevati 50 pezzi/);
assert.ok(dbStore.db.audits.some(row=>row.action==='INVENTORY_CHECK_REQUIRED'));
assert.ok(dbStore.db.audits.some(row=>row.action==='REQUEST_PICK_CONFIRMED'));

const persisted=JSON.parse(storage.getItem(CONFIG.storageKey));
assert.equal(persisted.requests[0].deliveries[0].items[0].pieces,50,'La conferma deve essere persistita subito');

domain.requests.reopenDelivery(request.id,request.deliveries[0].id);
assert.equal(domain.stock.total('I90001','M'),15,'La correzione deve ripristinare la giacenza scaricata');
assert.equal(domain.requests.summary(request).delivered,0,'Il prelievo riaperto non deve contare nell’avanzamento');
assert.equal(request.status,'DA PREPARARE');
assert.equal(request.inventoryAlerts[0].resolution,'PRELIEVO RIAPERTO');
assert.ok(dbStore.db.audits.some(row=>row.action==='REQUEST_PICK_REOPENED'));

assert.throws(()=>domain.movements.issue({sourceKey,quantity:50,destination:'LINA'}),/Disponibilità insufficiente/,'L’eccezione non deve estendersi agli scarichi ordinari');

const normalRequest=domain.requests.create({destination:'LINA',lines:[{article:'I90001',size:'M',cartonsRequested:1}]});
domain.requests.fulfill(normalRequest.id,[{lineId:normalRequest.lines[0].id,sourceKey,cartons:1,pieces:10}]);
assert.equal(domain.stock.total('I90001','M'),5);
assert.equal((normalRequest.inventoryAlerts||[]).length,0,'Un prelievo normale non deve generare anomalie');

const receipt=domain.receiving.create({supplier:'TEST',lines:[{article:'I90002',size:'L',state:'NUOVO',checkedQuantity:15,pallet:'P01'}]});
const receiptLine=receipt.lines[0],receivingSource=domain.stock.sources('I90002','L')[0],receivingKey=bucketKey(receivingSource);
const receivingRequest=domain.requests.create({destination:'LINA',lines:[{article:'I90002',size:'L',cartonsRequested:1}]});
domain.requests.fulfill(receivingRequest.id,[{lineId:receivingRequest.lines[0].id,sourceKey:receivingKey,cartons:1,pieces:50}]);
assert.equal(domain.stock.total('I90002','L'),0,'Anche l’Area Ricevimento deve fermarsi a zero');
assert.equal(receiptLine.remainingToPutAway,0,'Il residuo da ubicare non deve diventare negativo');
domain.requests.reopenDelivery(receivingRequest.id,receivingRequest.deliveries[0].id);
assert.equal(domain.stock.total('I90002','L'),15,'La riapertura deve ripristinare l’Area Ricevimento');
assert.equal(receiptLine.remainingToPutAway,15,'La riapertura deve ripristinare il residuo da ubicare');

console.log('NOVA V21 verification passed');
