import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('excel-stock-search-sheet.js','utf8');
for(const forbidden of ['touchstart','touchmove','touchend','window.show=','window.show =','new MutationObserver']){
  if(source.includes(forbidden))throw new Error(`Forbidden navigation hook: ${forbidden}`);
}

const context={window:null,console,document:undefined,DOMParser:undefined,XMLSerializer:undefined,JSZip:undefined};
context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'excel-stock-search-sheet.js'});
const api=context.WarehouseExcelStockSearch;if(!api)throw new Error('Excel stock search API missing');
if(api.searchSheet!=='CERCA_GIACENZE'||api.dataSheet!=='GIACENZE_RICERCA_DATI')throw new Error('Wrong worksheet names');

const stock=[
  {article_base:'I00215',size:'L',quantity:100,state:'NUOVO',fila_scaffale:'23',bancale:'',master_note:''},
  {article_base:'I00215',size:'L',quantity:5,state:'USATO',fila_scaffale:'24',bancale:'',master_note:'CAPI MODIFICATI'},
  {article_base:'I00215',size:'L',quantity:10,state:'SCARICATO',fila_scaffale:'25',bancale:'',master_note:''},
  {article_base:'I00215',size:'L',quantity:20,state:'NUOVO',fila_scaffale:'',bancale:'DISMESSI',master_note:'FUORI USO'},
  {article_base:'I00215',size:'L',quantity:3,state:'USATO',fila_scaffale:'',bancale:'DISMESSI',master_note:'FUORI USO'},
  {article_base:'I00215',size:'M',quantity:50,state:'NUOVO',fila_scaffale:'23',bancale:'',master_note:''},
  {article_base:'I99999',size:'L',quantity:8,state:'NUOVO',fila_scaffale:'99',bancale:'',master_note:''},
];
const rows=api.buildSearchRows(stock);
const l=rows.filter(r=>r.article==='I00215'&&r.size==='L');
if(l.length!==4)throw new Error(`Expected 4 classified I00215/L rows, got ${l.length}`);
const byState=Object.fromEntries(l.map(r=>[r.state,r.quantity]));
if(byState.NUOVO!==100||byState.USATO!==5||byState.SCARICATO!==10||byState.DISMESSO!==23)throw new Error(`Wrong status totals: ${JSON.stringify(byState)}`);
if(l.filter(r=>r.state==='DISMESSO').length!==1)throw new Error('Dismissed stock from multiple source states must consolidate into one physical result row');

const formulas=api.searchFormulas(rows.length+1);
for(const cell of ['B7','B8','B9','B10','B11','A15'])if(!formulas[cell])throw new Error(`Missing formula ${cell}`);
if(!formulas.B7.includes('SUMIFS')||!formulas.B7.includes('$B$3')||!formulas.B7.includes('$B$4'))throw new Error('Summary formula must search by article and size');
if(!formulas.A15.includes('_xlfn._xlws.FILTER')||!formulas.A15.includes('GIACENZE_RICERCA_DATI'))throw new Error('Detail lookup must use the hidden helper sheet and dynamic FILTER');

const xml=api.searchSheetXml(rows.length+1,{header:'1',body:'2',number:'3'});
for(const required of ['CERCA GIACENZE MAGAZZINO','ARTICOLO','TAGLIA','NUOVO','USATO','SCARICATO','DISMESSO','TOTALE GENERALE','FILA / SCAFFALE','BANCALE','QUANTITÀ','NOTE']){
  if(!xml.includes(required))throw new Error(`Search sheet missing ${required}`);
}
if(!xml.includes('A1:G1')||!xml.includes('ySplit="14"'))throw new Error('Search sheet layout/freeze pane missing');
const helper=api.helperSheetXml(api.dataRowsArray(stock),{header:'1',body:'2',number:'3'});
if(!helper.includes('GIACENZE')&&helper.length<100)throw new Error('Helper sheet XML not generated');
if(!source.includes("'veryHidden'"))throw new Error('Helper data sheet must stay veryHidden');
if(!source.includes('moveAfter(ctx,SEARCH_SHEET'))throw new Error('CERCA_GIACENZE must be placed next to MAGAZZINO');
if(!source.includes("calcMode','auto'")||!source.includes("fullCalcOnLoad','1'"))throw new Error('Workbook must force formula recalculation on open');

console.log('Excel stock search sheet runtime OK: article+size inputs, four exclusive status totals, dismissed consolidation, positions FILTER, hidden helper and recalc guards.');
