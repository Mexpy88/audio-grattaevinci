import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('excel-stock-search-detail-fix.js','utf8');
for(const forbidden of ['touchstart','touchmove','touchend','new MutationObserver','window.show=','window.show =','JSZip.loadAsync(result)','_xlfn._xlws.FILTER','AGGREGATE(','ROW(','ROWS(']){
  if(source.includes(forbidden))throw new Error(`Forbidden/fragile Excel detail behavior: ${forbidden}`);
}
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
if(api.lookupKeyFormula(15)!=='TRIM($B$3)&"|"&TRIM($B$4)&"|1"')throw new Error('First visible row must use a closed scalar helper key #1');
if(api.lookupKeyFormula(16)!=='TRIM($B$3)&"|"&TRIM($B$4)&"|2"')throw new Error('Second visible row must use a closed scalar helper key #2');

function assertBalancedFormula(formula,label){
  const quotes=(formula.match(/"/g)||[]).length;
  if(quotes%2!==0)throw new Error(`${label} has unbalanced Excel string quotes: ${formula}`);
  let depth=0;
  for(const ch of formula){if(ch==='(')depth++;else if(ch===')')depth--;if(depth<0)throw new Error(`${label} closes parentheses too early`)}
  if(depth!==0)throw new Error(`${label} has unbalanced parentheses: ${formula}`);
}

for(let col=0;col<7;col++){
  const letter=['A','B','C','D','E','F','G'][col],f=api.detailFormula(col,15,500);
  assertBalancedFormula(f,`Column ${letter}`);
  if(!f.includes(`INDEX('GIACENZE_RICERCA_DATI'!$${letter}$2:$${letter}$500`))throw new Error(`Column ${letter} is not mapped to its helper data column`);
  if(!f.includes("MATCH(TRIM($B$3)&\"|\"&TRIM($B$4)&\"|1\",'GIACENZE_RICERCA_DATI'!$H$2:$H$500,0)"))throw new Error(`Column ${letter} does not use a syntactically closed scalar MATCH helper key`);
  if(/AGGREGATE|FILTER|ROW\(|ROWS\(|\*\(/i.test(f))throw new Error(`Column ${letter} still contains array-style lookup logic`);
  if(f.includes('@'))throw new Error(`Column ${letter} must not rely on implicit intersection`);
}
const second=api.detailFormula(1,16,500);assertBalancedFormula(second,'Second detail row');if(!second.includes('"|2"'))throw new Error('Second detail row must request closed helper key #2');
const twentieth=api.detailFormula(5,34,500);assertBalancedFormula(twentieth,'Twentieth detail row');if(!twentieth.includes('"|20"'))throw new Error('Row 34 must request closed helper key #20');

for(const required of ['patchDetailSheet','patchSearchAndDetailSamePackage','patchWorkbookSearchSheets','CERCA_GIACENZE','GIACENZE_RICERCA_DATI','INDEX(','MATCH(','CHIAVE_RICERCA','addScalarHelperKeys','detailOrdinal']){
  if(!source.includes(required))throw new Error(`Missing scalar detail compatibility guard: ${required}`);
}
console.log('Excel search detail fix OK: scalar INDEX+MATCH formulas are syntactically balanced, closed, and free of array/implicit-intersection dependencies.');
