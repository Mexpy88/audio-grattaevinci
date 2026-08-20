import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('location-search-enhancements.js','utf8');
if(/touchstart|touchmove|touchend|swipe/i.test(source))throw new Error('This module must not install swipe/touch navigation');

function cls(){return {add(){},remove(){},toggle(){}}}
const document={
  head:{appendChild(){}},body:{appendChild(){}},
  getElementById(){return null},
  createElement(){return {id:'',className:'',textContent:'',innerHTML:'',dataset:{},classList:cls(),appendChild(){},querySelector(){return null},querySelectorAll(){return []}}},
  querySelectorAll(){return []}
};
class MO{observe(){}}
const context={window:null,document,MutationObserver:MO,console,setTimeout(){return 1},clearTimeout(){},alert(){},confirm(){return true},encodeURIComponent,decodeURIComponent,JSON,structuredClone:globalThis.structuredClone};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'location-search-enhancements.js'});
const api=context.WarehouseLocationSearch;
if(!api)throw new Error('WarehouseLocationSearch API missing');

if(!api.positionValid('13',''))throw new Error('Fila-only position must be valid');
if(!api.positionValid('','CARRELLO 7'))throw new Error('Pallet-only position must be valid');
if(api.positionValid('',''))throw new Error('Empty position must be invalid');

const rows=[
  {article_base:'I00215',size:'S',quantity:50,state:'NUOVO',fila_scaffale:'13',bancale:''},
  {article_base:'I00215',size:'S',quantity:10,state:'NUOVO',fila_scaffale:'15',bancale:''},
  {article_base:'I00215',size:'S',quantity:2,state:'USATO',fila_scaffale:'',bancale:'DISMESSI'},
  {article_base:'I00215',size:'M',quantity:30,state:'NUOVO',fila_scaffale:'13',bancale:''}
];
for(const q of ['I00215 S','I00215-S','I00215 - S']){
  const got=rows.filter(r=>api.rowMatches(r,q,rows));
  if(got.length!==3||got.some(r=>r.size!=='S'))throw new Error(`Exact size search failed for ${q}`);
}
const groups=api.groupRows(rows.filter(r=>r.size==='S'));
if(groups.length!==1||groups[0].total!==62||groups[0].rows.length!==3)throw new Error('Grouped availability total/locations failed');

console.log('Location/search runtime OK: Fila OR Bancale, exact size formats, grouped availability, no swipe.');
