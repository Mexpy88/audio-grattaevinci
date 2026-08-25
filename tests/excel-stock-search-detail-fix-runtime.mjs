import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('excel-stock-search-detail-fix.js','utf8');
for(const forbidden of ['touchstart','touchmove','touchend','new MutationObserver','window.show=','window.show =','JSZip.loadAsync(result)']){
  if(source.includes(forbidden))throw new Error(`Forbidden/fragile Excel detail behavior: ${forbidden}`);
}
if(source.includes('_xlfn._xlws.FILTER'))throw new Error('Detail fix must not depend on FILTER dynamic-array spill');
const ctx={window:null,console,document:undefined,DOMParser:undefined,XMLSerializer:undefined};ctx.window=ctx;
vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'excel-stock-search-detail-fix.js'});
const api=ctx.WarehouseExcelStockSearchDetailFix;if(!api)throw new Error('Detail fix API missing');

const rows=[
  {article:'I30872MUHF',size:'M'},
  {article:'I30872MUHF',size:'M'},
  {article:'I30872MUHF',size:'M'},
  {article:'I30872MUHF',size:'L'},
  {article:'I00215',size:'S'},
  {article:'I00215',size:'S'}
];
if(api.maxMatchesFromHelperRows(rows)!==3)throw new Error('Expected maximum 3 positions for one article+size');
if(api.detailOrdinal(15)!==1||api.detailOrdinal(16)!==2||api.detailOrdinal(34)!==20)throw new Error('Visible detail row must map to literal nth-match ordinal');

const formulas=[];
for(let col=0;col<7;col++)formulas.push(api.detailFormula(col,15,500));
for(const [i,letter] of ['A','B','C','D','E','F','G'].entries()){
  const f=formulas[i];
  if(!f.includes(`$${letter}$2:$${letter}$500`))throw new Error(`Column ${letter} is not mapped to its helper data column`);
  if(!f.includes('AGGREGATE(15,6'))throw new Error(`Column ${letter} does not use robust nth-match lookup`);
  if(!f.includes("'GIACENZE_RICERCA_DATI'!$C$2:$C$500=TRIM($B$3)"))throw new Error('Article criterion missing');
  if(!f.includes("'GIACENZE_RICERCA_DATI'!$D$2:$D$500=TRIM($B$4)"))throw new Error('Size criterion missing');
  if(/ROWS\(\$A\$15:A15\)/i.test(f)||f.includes('$A$15:A15'))throw new Error('Row 15 formula must not reference A15 itself');
  if(!f.includes(',1)'))throw new Error('First detail row must request literal match #1');
}
const second=api.detailFormula(1,16,500);
if(!second.includes(',2)'))throw new Error('Second detail row must request literal match #2');
if(/ROWS\(\$A\$15:A16\)/i.test(second)||second.includes('$A$15:A16'))throw new Error('Second detail formula must not depend on visible detail cells');
const twentieth=api.detailFormula(5,34,500);if(!twentieth.includes(',20)'))throw new Error('Row 34 must request literal match #20');

for(const required of ['patchDetailSheet','patchSearchAndDetailSamePackage','patchWorkbookSearchSheets','CERCA_GIACENZE','GIACENZE_RICERCA_DATI','INDEX(','AGGREGATE(15,6','detailOrdinal']){
  if(!source.includes(required))throw new Error(`Missing detail compatibility guard: ${required}`);
}
console.log('Excel search detail fix OK: nth-match formulas are deterministic, non-circular, and search+detail are patched in one workbook package before download.');