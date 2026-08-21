import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
const source=fs.readFileSync('warehouse-master-schema-v4.js','utf8');
for(const forbidden of ['touchstart','touchmove','touchend','window.show=','window.show =','new MutationObserver']){
  if(source.includes(forbidden))throw new Error(`Forbidden navigation hook: ${forbidden}`);
}
if(/addEventListener\s*\(\s*['"]input['"]/.test(source))throw new Error('Do not add a second search input listener');
for(const required of ['captureMasterFileV4','commitImportedWorkbookV4','patchAppData','rebindMasterConfirm','quantityOrIdentityTouchedKeys','originalSheetXml','copyOriginalCell']){
  if(!source.includes(required))throw new Error(`Required V4 safety path missing: ${required}`);
}
if(source.includes('schemaExport={active:true')&&source.includes('};db.rectifications=[];compatibilityMode=true'))throw new Error('Outer export must keep rectifications available for REGISTRO_MOVIMENTI and APP_DATI');
if(!source.includes('const qtyChanged=Number(b.quantity||0)!==Number(a.quantity||0),stateChanged=norm(b.state)!==norm(a.state);if(qtyChanged||stateChanged)'))throw new Error('Pure identity/location rectifications must preserve original quantity/formula cells');
const context={window:null,console,structuredClone:globalThis.structuredClone,document:undefined,DOMParser:undefined,XMLSerializer:undefined};context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'warehouse-master-schema-v4.js'});
const api=context.WarehouseMasterSchemaV4;if(!api)throw new Error('API missing');
const headers=['SCAFFALE / FILA','BANCALE','ARTICOLO','TAGLIA','NUOVO','SCARICATO','USATO','NOTE','DATA CONTROLLO QUANTITÀ'];
const c=api.definitiveMasterColumns(headers);if(!api.isDefinitiveMaster(c))throw new Error('Official A:I schema not recognized');
if(c.location!==0||c.bancale!==1||c.article!==2||c.size!==3||c.nuovo!==4||c.scaricato!==5||c.usato!==6||c.note!==7||c.controlDate!==8)throw new Error('Wrong V4 column indexes');
const matrix=[
 headers,
 ['23','','I40927UHF','L',20,15,5,'CAPI MODIFICATI','14/08/2026'],
 ['','CARRELLO 7','FELPA BLU HOUSTON','M',10,0,0,'',''],
 ['','','I40986UHF','XS',34,0,0,'DA ASSEGNARE','']
];
const parsed=api.parseMasterRows(matrix,0,headers);
if(parsed.length!==5)throw new Error(`Expected 5 state rows, got ${parsed.length}`);
const first=parsed.filter(r=>r.article_base==='I40927UHF');if(first.length!==3||first.some(r=>r.size!=='L'||r.master_note!=='CAPI MODIFICATI'||r.fila_scaffale!=='23'))throw new Error('V4 row parser lost size/note/location');
if(!parsed.some(r=>r.article_base==='FELPA BLU HOUSTON'&&r.bancale==='CARRELLO 7'))throw new Error('Descriptive article or pallet-only row lost');
if(!parsed.some(r=>r.article_base==='I40986UHF'&&r.size==='XS'&&!r.fila_scaffale&&!r.bancale&&r.master_note==='DA ASSEGNARE'))throw new Error('Unassigned source row should import and be flagged later');
if(!api.positionValid('23','')||!api.positionValid('','38')||api.positionValid('',''))throw new Error('Flexible position validation failed');
if(api.normalizeArticle('FELPA BLU HOUSTON')!=='FELPA BLU HOUSTON')throw new Error('Descriptive article spaces must be preserved');
if(api.normalizeArticle('I 00215')!=='I00215')throw new Error('Standard I-code spaces should normalize');
for(const size of ['S','6XL','43/44','TG.48','13°']){const x=api.splitCompatArticle(api.compatArticle('I40927UHF',size));if(x.article!=='I40927UHF'||x.size!==size.toUpperCase())throw new Error(`Compatibility split failed for ${size}`)}
const rows=[
 {article_base:'I00215',size:'S',quantity:50,state:'NUOVO',fila_scaffale:'13',bancale:'',master_note:'CAPI MODIFICATI'},
 {article_base:'I00215',size:'S',quantity:10,state:'NUOVO',fila_scaffale:'15',bancale:'',master_note:''},
 {article_base:'I00215',size:'S',quantity:2,state:'USATO',fila_scaffale:'',bancale:'DISMESSI',master_note:''},
 {article_base:'I00215',size:'M',quantity:30,state:'NUOVO',fila_scaffale:'13',bancale:'',master_note:''}
];
for(const q of ['I00215 S','I00215-S','I00215 - S']){const ctx=api.buildSearchContext(rows,q),got=rows.filter(r=>api.rowMatchesSearch(r,ctx));if(got.length!==3||got.some(r=>r.size!=='S'))throw new Error(`Exact size search failed: ${q}`)}
const articleRows=[...rows,{article_base:'I002150',size:'S',quantity:99,state:'NUOVO',fila_scaffale:'99',bancale:'',master_note:''}];
let ac=api.buildSearchContext(articleRows,'I00215'),ag=articleRows.filter(r=>api.rowMatchesSearch(r,ac));
if(ag.length!==4||ag.some(r=>r.article_base!=='I00215'))throw new Error('Exact article search must not match I002150');
let sc=api.buildSearchContext(articleRows,'S'),sg=articleRows.filter(r=>api.rowMatchesSearch(r,sc));
if(sg.length!==4||sg.some(r=>r.size!=='S'))throw new Error('Size-only search failed');
const noteCtx=api.buildSearchContext(rows,'CAPI MODIFICATI');if(rows.filter(r=>api.rowMatchesSearch(r,noteCtx)).length!==1)throw new Error('Master NOTE search failed');
const groups=api.groupSearchRows(rows.filter(r=>r.size==='S'));if(groups.length!==1||groups[0].total!==62||groups[0].rows.length!==3)throw new Error('Grouped availability failed');
const big=[];for(let i=0;i<25000;i++)big.push({article_base:'I'+String(10000+i),size:i%2?'S':'M',quantity:1,state:'NUOVO',fila_scaffale:String(i%100),bancale:'',master_note:''});big.push(...rows);
const t0=performance.now();const ctx=api.buildSearchContext(big,'I00215-S');const got=big.filter(r=>api.rowMatchesSearch(r,ctx));const ms=performance.now()-t0;if(got.length!==3)throw new Error('Large search result wrong');if(ms>1000)throw new Error(`Large search too slow: ${ms.toFixed(1)}ms`);
console.log(`Master schema V4 runtime OK: A:I parser, file capture/restore hooks, flexible location, notes, exact article+size, grouped search, ${ms.toFixed(1)}ms on 25k rows.`);
