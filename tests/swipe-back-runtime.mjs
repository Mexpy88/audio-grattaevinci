import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('mobile-search-v3.js','utf8');
const listeners={};let current='home';
function cl(){return {add(){},remove(){},toggle(){}}}
function el(id=''){return {id,value:'',dataset:{},classList:cl(),childNodes:[],style:{},textContent:'',innerHTML:'',placeholder:'',closest(){return null},querySelector(){return null},querySelectorAll(){return []},appendChild(){},addEventListener(){},focus(){},setAttribute(){}}}
const document={documentElement:{dataset:{}},body:{classList:cl(),appendChild(){}},getElementById(){return null},querySelectorAll(sel){if(sel==='.screen.on')return [{id:current}];if(sel==='dialog[open]')return [];return []},createElement(){const e=el();e.showModal=()=>{};e.close=()=>{};return e},addEventListener(type,fn){listeners[type]=fn}};
class MO{observe(){}}
const context={window:null,document,MutationObserver:MO,console,setTimeout(){return 1},clearTimeout(){},decodeURIComponent,encodeURIComponent,alert(){},requireLogin:()=>true,stockEditSource:{},stockEditRowsDraft:[],stockBuckets:()=>[],locationOf:r=>r?.fila_scaffale||'',db:{master:{rows:[]}},show(id){current=id}};context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'mobile-search-v3.js'});
context.show('searchScreen');if(current!=='searchScreen')throw new Error('Could not navigate to search');
const start={touches:[{clientX:5,clientY:300}]};const move={touches:[{clientX:70,clientY:305}]};const end={changedTouches:[{clientX:120,clientY:308}]};
listeners.touchstart(start);listeners.touchmove(move);listeners.touchend(end);
if(current!=='home')throw new Error('Swipe-back did not return to home');
console.log('Swipe-back V3 runtime OK: left-edge gesture returns to previous screen.');
