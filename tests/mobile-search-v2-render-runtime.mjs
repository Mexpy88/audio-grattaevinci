import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('mobile-search-v3.js','utf8');
function cl(){return {add(){},remove(){},toggle(){}}}
const els=new Map();
function el(id=''){return {id,value:'',dataset:{},classList:cl(),childNodes:[],style:{},textContent:'',innerHTML:'',placeholder:'',closest(){return null},querySelector(){return null},querySelectorAll(){return []},appendChild(){},addEventListener(){},focus(){},setAttribute(){}}}
const search=el('searchInput');search.value='I00215-S';els.set('searchInput',search);const state=el('uxSearchState');els.set('uxSearchState',state);const summary=el('uxSearchSummary');els.set('uxSearchSummary',summary);const list=el('stockList');els.set('stockList',list);
const document={documentElement:{dataset:{}},body:{classList:cl(),appendChild(){}},getElementById(id){return els.get(id)||null},querySelectorAll(sel){if(sel==='.screen.on')return [{id:'searchScreen'}];return []},createElement(){const e=el();e.showModal=()=>{};e.close=()=>{};return e},addEventListener(){}};
class MO{observe(){}}
const stock=[
 {article_base:'I00215',size:'S',quantity:50,state:'NUOVO',fila_scaffale:'13',bancale:''},
 {article_base:'I00215',size:'S',quantity:10,state:'NUOVO',fila_scaffale:'15',bancale:''},
 {article_base:'I00215',size:'S',quantity:2,state:'USATO',fila_scaffale:'',bancale:'DISMESSI'},
 {article_base:'I00215',size:'M',quantity:99,state:'NUOVO',fila_scaffale:'20',bancale:''}
];
const context={window:null,document,MutationObserver:MO,console,setTimeout(){return 1},clearTimeout(){},decodeURIComponent,encodeURIComponent,alert(){},requireLogin:()=>true,stockEditSource:{},stockEditRowsDraft:[],stockBuckets:()=>stock,locationOf:r=>r?.fila_scaffale||'',db:{master:{rows:[]}},show(){},esc:v=>String(v)};context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'mobile-search-v3.js'});
context.renderStock();
if(!summary.textContent.includes('3 disponibilità')||!summary.textContent.includes('62 pezzi'))throw new Error('Wrong grouped summary: '+summary.textContent);
if(!list.innerHTML.includes('I00215')||!list.innerHTML.includes('62'))throw new Error('Grouped header is incomplete');
if(list.innerHTML.includes('99'))throw new Error('Size M leaked into exact S search');
const groupMatch=list.innerHTML.match(/msv3ToggleGroup\('([^']+)'\)/);if(!groupMatch)throw new Error('Availability accordion toggle missing');
context.msv3ToggleGroup(groupMatch[1]);
if(!list.innerHTML.includes('Fila/Scaffale <b>13</b>')||!list.innerHTML.includes('Fila/Scaffale <b>15</b>')||!list.innerHTML.includes('Bancale/Carrello <b>DISMESSI</b>'))throw new Error('Expanded grouped locations are incomplete');
console.log('Mobile Search V3 render runtime OK: one size group aggregates all 3 locations and excludes other sizes.');
