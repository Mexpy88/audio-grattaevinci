import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('excel-stock-search-detail-fix.js','utf8');
for(const forbidden of ['touchstart','touchmove','touchend','new MutationObserver','window.show=','window.show =']){
  if(source.includes(forbidden))throw new Error(`Forbidden navigation hook: ${forbidden}`);
}
if(source.includes('_xlfn._xlws.FILTER'))throw new Error('Detail fix must not depend on FILTER dynamic-array spill');
const ctx={window:null,console,document:undefined,DOMParser:undefined,XMLSerializer:undefined};ctx.window=ctx;
vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'excel-stock-search-detail-fix.js'});
const api=ctx.WarehouseExcelStockSearchDetailFix;if(!api)throw new Error('Detail fix API missing');

const rows=[
  {article:'I62470LUNUHF',size:'M'},
  {article:'I62470LUNUHF',size:'M'},
  {article:'I62470LUNUHF',size:'M'},
  {article:'I62470LUNUHF',size:'L'},
  {article:'I00215',size:'S'},
  {article:'I00215',size:'S'}
];
if(api.maxMatchesFromHelperRows(rows)!==3)throw new Error('Expected maximum 3 positions for one article+size');

const formulas=[];
for(let col=0;col<7;col++)formulas.push(api.detailFormula(col,15,500));
for(const [i,letter] of ['A','B','C','D','E','F','G'].entries()){
  const f=formulas[i];
  if(!f.includes(`$${letter}$2:$${letter}$500`))throw new Error(`Column ${letter} is not mapped to its helper data column`);
  if(!f.includes('AGGREGATE(15,6'))throw new Error(`Column ${letter} does not use robust nth-match lookup`);
  if(!f.includes("'GIACENZE_RICERCA_DATI'!$C$2:$C$500=TRIM($B$3)"))throw new Error('Article criterion missing');
  if(!f.includes("'GIACENZE_RICERCA_DATI'!$D$2:$D$500=TRIM($B$4)"))throw new Error('Size criterion missing');
}
const second=api.detailFormula(1,16,500);if(!second.includes('ROWS($A$15:A16)'))throw new Error('Second detail row must request the second matching position');

for(const required of ['patchDetailSheet','CERCA_GIACENZE','GIACENZE_RICERCA_DATI','INDEX(','AGGREGATE(15,6']){
  if(!source.includes(required))throw new Error(`Missing detail compatibility guard: ${required}`);
}
console.log('Excel search detail fix OK: all 7 columns use deterministic INDEX+AGGREGATE nth-match formulas; no FILTER spill dependency.');
