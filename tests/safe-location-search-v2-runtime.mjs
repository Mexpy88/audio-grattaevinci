import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';

const source=fs.readFileSync('safe-location-search-v2.js','utf8');
for(const forbidden of ['touchstart','touchmove','touchend','MutationObserver','window.show=','window.show =']){
  if(source.includes(forbidden))throw new Error(`Forbidden navigation/observer hook found: ${forbidden}`);
}
if(source.includes("addEventListener('input'\")")||source.includes('addEventListener("input"'))throw new Error('Search module must rely on the stable base oninput handler, not add another input listener');

function cls(){return {add(){},remove(){},toggle(){}}}
const elements=new Map();
function el(){return {value:'',innerHTML:'',textContent:'',classList:cls(),dataset:{},childNodes:[],appendChild(){},insertAdjacentHTML(_p,s){this.innerHTML+=s},closest(){return null},querySelector(){return null},querySelectorAll(){return []},focus(){}}}
const document={
  head:{appendChild(){}},body:{appendChild(){}},
  getElementById(id){return elements.get(id)||null},
  createElement(){return {...el(),id:'',className:'',style:{},remove(){},querySelector(){return {onclick:null}}}},
  querySelectorAll(){return []}
};
const context={window:null,document,console,setTimeout(){return 1},clearTimeout(){},alert(){},confirm(){return true},encodeURIComponent,decodeURIComponent,JSON,structuredClone:globalThis.structuredClone};
context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'safe-location-search-v2.js'});
const api=context.WarehouseSafeLocationSearchV2;if(!api)throw new Error('API missing');

if(!api.positionValid('13',''))throw new Error('Fila-only must be valid');
if(!api.positionValid('','CARRELLO 7'))throw new Error('Bancale-only must be valid');
if(api.positionValid('',''))throw new Error('Empty position must be invalid');

const core=[
  {article_base:'I00215',size:'S',quantity:50,state:'NUOVO',fila_scaffale:'13',bancale:''},
  {article_base:'I00215',size:'S',quantity:10,state:'NUOVO',fila_scaffale:'15',bancale:''},
  {article_base:'I00215',size:'S',quantity:2,state:'USATO',fila_scaffale:'',bancale:'DISMESSI'},
  {article_base:'I00215',size:'M',quantity:30,state:'NUOVO',fila_scaffale:'13',bancale:''}
];
for(const q of ['I00215 S','I00215-S','I00215 - S']){
  const ctx=api.buildSearchContext(core,q),got=core.filter(r=>api.rowMatchesWithContext(r,ctx));
  if(got.length!==3||got.some(r=>r.size!=='S'))throw new Error(`Exact size search failed: ${q}`);
}
const groups=api.groupRows(core.filter(r=>r.size==='S'));
if(groups.length!==1||groups[0].total!==62||groups[0].rows.length!==3)throw new Error('Grouped availability failed');

// Regression for the previous freeze: one O(n) context build + one O(n) filter on a large master.
const big=[];for(let i=0;i<20000;i++)big.push({article_base:'I'+String(10000+i),size:i%2?'S':'M',quantity:1,state:'NUOVO',fila_scaffale:String(i%100),bancale:''});
big.push(...core);
const t0=performance.now();const searchCtx=api.buildSearchContext(big,'I00215-S');const got=big.filter(r=>api.rowMatchesWithContext(r,searchCtx));const elapsed=performance.now()-t0;
if(got.length!==3)throw new Error('Large-master exact search failed');
if(elapsed>1000)throw new Error(`Search too slow: ${elapsed.toFixed(1)}ms`);

// Typing regression: rendering must never replace/clear the input value.
const input=el(),list=el(),summary=el();elements.set('searchInput',input);elements.set('stockList',list);elements.set('uxSearchSummary',summary);
context.stockBuckets=()=>core;
for(const value of ['I','I0','I00215','I00215-S']){input.value=value;api.render();if(input.value!==value)throw new Error(`Input value changed during render: ${value}`)}
if(!list.innerHTML.includes('I00215')||!list.innerHTML.includes('62'))throw new Error('Grouped render missing expected article/total');

console.log(`Safe search V2 OK: fila/pallet alternatives, exact size, grouped availability, writable input, ${elapsed.toFixed(1)}ms on 20k+ rows.`);
