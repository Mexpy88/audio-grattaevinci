import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

class MemoryStorage{
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
const columnName=index=>{let value=index+1,out='';while(value){value--;out=String.fromCharCode(65+value%26)+out;value=Math.floor(value/26)}return out};
const columnIndex=name=>[...String(name)].reduce((value,char)=>value*26+char.charCodeAt(0)-64,0)-1;
const context={
  console,crypto:crypto.webcrypto,structuredClone:globalThis.structuredClone,TextEncoder,
  setTimeout,clearTimeout,localStorage:storage,sessionStorage:new MemoryStorage(),
  XLSX:{utils:{
    aoa_to_sheet:value=>value,
    encode_cell:({r,c})=>`${columnName(c)}${r+1}`,
    decode_range:ref=>{const match=String(ref).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);if(!match)throw new Error(`Intervallo non valido: ${ref}`);return{s:{c:columnIndex(match[1]),r:Number(match[2])-1},e:{c:columnIndex(match[3]),r:Number(match[4])-1}}},
    encode_range:range=>`${columnName(range.s.c)}${range.s.r+1}:${columnName(range.e.c)}${range.e.r+1}`,
  }},
};
context.globalThis=context;
vm.createContext(context);

const testBootstrap=`
/* js/app.js */
const store=new Store({storage:globalThis.localStorage});
const auth=new AuthService({session:globalThis.sessionStorage});
auth.user='Mattia';
const domain=createDomain(store,auth);
const router={route:{name:'home',params:{}},go(){},back(){},replace(){},home(){}};
const ui={
  store,auth,domain,router,rectifyDraft:null,rectifyContext:null,countDraft:null,registryTab:'MOVIMENTI',
  requestCard(){return '<article class="request-card"><div class="request-card-actions"></div></article>'},
  requestDetail(){return '<div class="summary-three"><div></div></div>'},requestPick(){return ''},
  action(){},input(){},change(){},openRectify(){},rectPick(){},loadCount(){},persistCountDraft(){},
  renderCountBody(){},renderRectifySelected(){},renderStockResults(){},renderView(){},ledgerCard(){return ''},master(){return ''},
  chooseSource(){},require(){return true},sourceSelect(){return ''},toast(){},emptyPage(message){return message},
  sectionTitle(eyebrow,title,sub=''){return '<div class="page-title"><div class="eyebrow">'+eyebrow+'</div><h1>'+title+'</h1><p>'+sub+'</p></div>'},
  ensureCountSummaryDialog(){return {showModal(){}}},
};
const excel=new ExcelService(store,domain);
globalThis.NOVA={version:CONFIG.version,store,auth,domain,ui,excel};
globalThis.__V22_TEST={CONFIG,store,auth,domain,ui,excel,bucketKey};
`;
const testableBase=base.replace(/\/\* js\/app\.js \*\/[\s\S]*$/m,testBootstrap);
vm.runInContext(testableBase,context,{filename:'index.html'});
vm.runInContext(fs.readFileSync(new URL('./v21-picking.js',import.meta.url),'utf8'),context,{filename:'v21-picking.js'});
const v20=Array.from({length:9},(_,index)=>fs.readFileSync(new URL(`./v20/patch-${String(index+1).padStart(2,'0')}.part`,import.meta.url),'utf8')).join('');
vm.runInContext(v20,context,{filename:'v20-patch.js'});
vm.runInContext(fs.readFileSync(new URL('./v22-operations.js',import.meta.url),'utf8'),context,{filename:'v22-operations.js'});

assert.ok(context.NOVA_V22,'Patch V22 non attiva');
const {CONFIG,store,auth,domain,ui,excel,bucketKey}=context.__V22_TEST;
const plain=value=>JSON.parse(JSON.stringify(value));
const loader=fs.readFileSync(new URL('./v22.html',import.meta.url),'utf8');
assert.ok(loader.indexOf('v20-patch.js')<loader.indexOf('v21-picking.js')&&loader.indexOf('v21-picking.js')<loader.indexOf('v22-operations.js'),'Ordine patch loader non valido');

/* Riclassificazione rettifica con fusione del bucket di destinazione. */
store.db.master.rows=[
  {article:'I30881FCUHF',size:'4XL',state:'NUOVO',quantity:13,location:'60',pallet:'GEMELLI 27'},
  {article:'I30881FCUHF',size:'4XL',state:'USATO',quantity:5,location:'60',pallet:'GEMELLI 27'},
  {article:'I70000',size:'M',state:'USATO',quantity:10,location:'10',pallet:'A'},
  {article:'I80000',size:'L',state:'NUOVO',quantity:20,location:'20',pallet:'B'},
];
store.db.master.excelRows=store.db.master.rows.map((row,index)=>({...row,sourceRow:index+1}));
store.db.master.sheetName='MAGAZZINO';store.db.master.headerRow=0;store.db.master.mode='wide';store.db.master.columns={location:0,pallet:1,article:2,size:3,NUOVO:4,SCARICATO:5,USATO:6,note:7,checkedAt:8,description:-1,fila:-1,scaffale:-1};
store.db.master.importedAt=new Date().toISOString();store.save('test:seed');
const nuovoKey=bucketKey(store.db.master.rows[0]);
const rect=domain.rectifications.setQuantity({currentKey:nuovoKey,counted:15,targetState:'USATO',reason:'CONTEGGIO FISICO',note:'Stato fisico corretto'});
assert.equal(rect.stateChanged,true);
assert.equal(domain.stock.sources('I30881FCUHF','4XL','NUOVO').length,0,'Il bucket NUOVO deve essere azzerato');
assert.equal(domain.stock.total('I30881FCUHF','4XL','USATO'),20,'I 15 pezzi riclassificati devono sommarsi ai 5 USATO esistenti');
const rectAudit=store.db.audits.find(row=>row.action==='RECTIFICATION'&&row.meta?.operationId===rect.events[0].source.operationId);
assert.equal(rectAudit.meta.previousState,'NUOVO');assert.equal(rectAudit.meta.newState,'USATO');
assert.equal(rectAudit.meta.before,13);assert.equal(rectAudit.meta.after,15);assert.equal(rectAudit.meta.targetBucketAfter,20);

const usatoRow=domain.stock.sources('I30881FCUHF','4XL','USATO')[0];
domain.rectifications.setQuantity({currentKey:bucketKey(usatoRow),counted:18,targetState:'USATO'});
assert.equal(domain.stock.total('I30881FCUHF','4XL','USATO'),18,'La rettifica senza cambio stato deve restare invariata');

/* Spostamento con cambio stato e annullamento accoppiato. */
const moveSource=domain.stock.sources('I70000','M','USATO')[0];
const moved=domain.movements.transfer({sourceKey:bucketKey(moveSource),quantity:6,location:'11',pallet:'C',targetState:'SCARICATO',note:'Riclassifica durante spostamento'});
assert.equal(domain.stock.total('I70000','M','USATO'),4);
assert.equal(domain.stock.sources('I70000','M','SCARICATO')[0].quantity,6);
domain.movements.cancelLedger(moved.events[0].id);
assert.equal(domain.stock.total('I70000','M','USATO'),10);
assert.equal(domain.stock.sources('I70000','M','SCARICATO').length,0);

/* Nomi richiesta giornalieri, separati per destinazione e mai riutilizzati. */
const requestDraft=(destination,requestedAt)=>({destination,requestedAt,lines:[{article:'I80000',size:'L',cartonsRequested:2}]});
const historical=[
  {id:'RQ-2026-09001',destination:'LINA',operator:'Lina',requestedAt:'2026-09-01T08:00:00.000Z',status:'DA PREPARARE',lines:[],deliveries:[]},
  {id:'RQ-2026-09002',destination:'LINA',operator:'Lina',requestedAt:'2026-09-01T09:00:00.000Z',status:'DA PREPARARE',lines:[],deliveries:[]},
];
store.db.requests.push(...historical);context.NOVA_V22.migrateRequestNames();
assert.equal(historical[0].displayName,'Richiesta Lina-01.09.2026-r1');assert.equal(historical[1].displayName,'Richiesta Lina-01.09.2026-r2');
const r1=domain.requests.create(requestDraft('LINA','2026-09-02T08:00:00.000Z'));
const r2=domain.requests.create(requestDraft('LINA','2026-09-02T09:00:00.000Z'));
const other=domain.requests.create(requestDraft('SPEDIZIONI','2026-09-02T10:00:00.000Z'));
const nextDay=domain.requests.create(requestDraft('LINA','2026-09-03T08:00:00.000Z'));
assert.equal(r1.displayName,'Richiesta Lina-02.09.2026-r1');
assert.equal(r2.displayName,'Richiesta Lina-02.09.2026-r2');
assert.equal(other.displayName,'Richiesta Spedizioni-02.09.2026-r1');
assert.equal(nextDay.displayName,'Richiesta Lina-03.09.2026-r1');
const immutableName=r2.displayName;domain.requests.deleteUnworked(r2.id,'Test progressivo');
const r3=domain.requests.create(requestDraft('LINA','2026-09-02T11:00:00.000Z'));
assert.equal(r3.displayName,'Richiesta Lina-02.09.2026-r3','Il progressivo eliminato non deve essere riutilizzato');
assert.equal(immutableName,'Richiesta Lina-02.09.2026-r2');

/* CTA corretta, in alto e mai duplicata. */
let detail=ui.requestDetail(r1.id);
assert.equal((detail.match(/INIZIA PREPARAZIONE/g)||[]).length,1);
assert.ok(detail.indexOf('INIZIA PREPARAZIONE')<detail.indexOf('detail-line'),'La CTA deve precedere le righe');
assert.doesNotMatch(detail,/PREPARA RICHIESTA/);
const stockKey=bucketKey(domain.stock.sources('I80000','L','NUOVO')[0]);
domain.requests.fulfill(r1.id,[{lineId:r1.lines[0].id,sourceKey:stockKey,cartons:1,pieces:5}]);
detail=ui.requestDetail(r1.id);
assert.equal((detail.match(/CONTINUA PREPARAZIONE/g)||[]).length,1);
assert.ok(detail.indexOf('CONTINUA PREPARAZIONE')<detail.indexOf('detail-line'));
assert.match(ui.requestCard(r1,'PROGRESS'),/CONTINUA PREPARAZIONE/);
domain.requests.fulfill(r1.id,[{lineId:r1.lines[0].id,sourceKey:stockKey,cartons:1,pieces:5}]);
assert.doesNotMatch(ui.requestDetail(r1.id),/(INIZIA|CONTINUA) PREPARAZIONE/,'Una richiesta completata non deve mostrare la CTA');

/* La V22 non deve regredire il prelievo fisico superiore alla giacenza V21. */
const shortageSource={article:'I90000',size:'XL',state:'NUOVO',quantity:3,location:'30',pallet:'D'};store.db.master.rows.push(shortageSource);domain.stock.invalidate();
const shortageRequest=domain.requests.create({destination:'LINA',requestedAt:'2026-09-04T08:00:00.000Z',lines:[{article:'I90000',size:'XL',cartonsRequested:1}]});
const shortageIssue=domain.requests.fulfill(shortageRequest.id,[{lineId:shortageRequest.lines[0].id,sourceKey:bucketKey(shortageSource),cartons:1,pieces:5}]);
assert.equal(domain.stock.total('I90000','XL'),0);assert.equal(shortageIssue.items[0].pieces,5);assert.equal(shortageIssue.items[0].stockDebitedPieces,3);assert.equal(shortageIssue.items[0].inventoryShortage,2);

/* Il conteggio rileva anche una differenza di solo stato. */
ui.countDraft={id:'CNT-2026-09-02-001',location:'20',pallet:'B',rows:[{domId:'c1',key:stockKey,source:{article:'I80000',size:'L',state:'NUOVO',quantity:10,location:'20',pallet:'B'},targetState:'DISMESSO',counted:10,partials:[10],verified:true,confirmed:true}],extras:[]};
const countDiff=ui.countDifferences();assert.equal(countDiff.length,1);assert.equal(countDiff[0].delta,0);assert.equal(countDiff[0].stateChanged,true);assert.equal(countDiff[0].newState,'DISMESSO');

/* Excel leggibile: ID/nome, quantità fisica/contabile e colonne separate. */
const requestSheet=excel.requestSheet(),requestHeaders=requestSheet[0];
assert.ok(requestHeaders.includes('ID RICHIESTA'));assert.ok(requestHeaders.includes('NOME RICHIESTA'));
assert.ok(requestHeaders.includes('ARTICOLO'));assert.ok(requestHeaders.includes('TAGLIA'));
assert.notEqual(requestHeaders.indexOf('ARTICOLO'),requestHeaders.indexOf('TAGLIA'));
const r1Excel=requestSheet.find(row=>row[0]===r1.id);assert.equal(r1Excel[requestHeaders.indexOf('NOME RICHIESTA')],r1.displayName);assert.equal(r1Excel[requestHeaders.indexOf('ARTICOLO')],'I80000');assert.equal(r1Excel[requestHeaders.indexOf('TAGLIA')],'L');
const issueHeaders=excel.issueSheet()[0];for(const header of ['PEZZI FISICAMENTE PRELEVATI','PEZZI SCARICATI DA GIACENZA','DIFFERENZA INVENTARIO','ARTICOLO','TAGLIA'])assert.ok(issueHeaders.includes(header),`Colonna SCARICHI mancante: ${header}`);
const shortageExcel=excel.issueSheet().find(row=>row[0]===shortageIssue.id);assert.equal(shortageExcel[issueHeaders.indexOf('NOME RICHIESTA')],shortageRequest.displayName);assert.equal(shortageExcel[issueHeaders.indexOf('PEZZI FISICAMENTE PRELEVATI')],5);assert.equal(shortageExcel[issueHeaders.indexOf('PEZZI SCARICATI DA GIACENZA')],3);assert.equal(shortageExcel[issueHeaders.indexOf('DIFFERENZA INVENTARIO')],2);
const ordinaryIssue=domain.movements.issue({sourceKey:bucketKey(domain.stock.sources('I80000','L','NUOVO')[0]),quantity:1,destination:'LINA',note:'Scarico ordinario'});
const ordinaryIssueRow=excel.issueSheet().find(row=>row[0]===ordinaryIssue.id);assert.equal(ordinaryIssueRow[excel.issueSheet()[0].indexOf('NOME RICHIESTA')],'','Uno scarico ordinario non deve ricevere un nome richiesta inventato');
const movementHeaders=excel.movementSheet()[0];for(const header of ['ARTICOLO','TAGLIA','STATO PRECEDENTE','STATO NUOVO'])assert.ok(movementHeaders.includes(header),`Colonna MOVIMENTI mancante: ${header}`);
const auditHeaders=excel.auditSheet()[0];for(const header of ['ARTICOLO','TAGLIA','STATO PRECEDENTE','STATO NUOVO','QUANTITÀ PRIMA','QUANTITÀ DOPO','DIFFERENZA'])assert.ok(auditHeaders.includes(header),`Colonna AUDIT mancante: ${header}`);

/* Il MAGAZZINO reale V1 non aveva DISMESSO/NON_CHIARO: V22 deve aggiungerli. */
const dismessoSource=domain.stock.sources('I70000','M','USATO')[0];domain.rectifications.setQuantity({currentKey:bucketKey(dismessoSource),counted:10,targetState:'DISMESSO',reason:'TEST EXPORT'});
const magazineSheet={'!ref':'A1:I5'};
['SCAFFALE / FILA','BANCALE','ARTICOLO','TAGLIA','NUOVO','SCARICATO','USATO','NOTE','DATA CONTROLLO QUANTITÀ'].forEach((value,column)=>magazineSheet[`${columnName(column)}1`]={t:'s',v:value});
store.db.master.excelRows.forEach((row,index)=>{const line=index+2;magazineSheet[`A${line}`]={t:'s',v:row.location};magazineSheet[`B${line}`]={t:'s',v:row.pallet};magazineSheet[`C${line}`]={t:'s',v:row.article};magazineSheet[`D${line}`]={t:'s',v:row.size};magazineSheet[`E${line}`]={t:'n',v:row.state==='NUOVO'?row.quantity:0};magazineSheet[`F${line}`]={t:'n',v:row.state==='SCARICATO'?row.quantity:0};magazineSheet[`G${line}`]={t:'n',v:row.state==='USATO'?row.quantity:0}});
excel.updateMagazine({SheetNames:['MAGAZZINO'],Sheets:{MAGAZZINO:magazineSheet}});
assert.equal(magazineSheet.J1.v,'DISMESSO');assert.equal(magazineSheet.K1.v,'NON_CHIARO');assert.equal(magazineSheet['!ref'],'A1:K5');
const dismessoLine=[2,3,4,5].find(line=>magazineSheet[`C${line}`]?.v==='I70000'&&magazineSheet[`D${line}`]?.v==='M');assert.ok(dismessoLine);assert.equal(magazineSheet[`G${dismessoLine}`].v,0);assert.equal(magazineSheet[`J${dismessoLine}`].v,10);

const persisted=plain(JSON.parse(storage.getItem(CONFIG.storageKey)));
assert.equal(persisted.schema,'NOVA_DB_V1');assert.equal(persisted.settings.requestDailyCounters['2026-09-02|LINA'],3);

console.log('NOVA V22 verification passed');
