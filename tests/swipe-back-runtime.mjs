import fs from 'node:fs';
import vm from 'node:vm';
const mobile=fs.readFileSync('mobile-search-v3.js','utf8');
const hotfix=fs.readFileSync('mobile-navigation-hotfix.js','utf8');
const listeners={};let current='home';
function cl(){return {add(){},remove(){},toggle(){}}}
function el(id=''){return {id,value:'',dataset:{},classList:cl(),childNodes:[],style:{},textContent:'',innerHTML:'',placeholder:'',closest(){return null},querySelector(){return null},querySelectorAll(){return []},appendChild(){},addEventListener(){},focus(){},setAttribute(){}}}
const document={documentElement:{dataset:{msv3Swipe:'disabled'}},body:{classList:cl(),appendChild(){}},getElementById(){return null},querySelectorAll(sel){if(sel==='.screen.on')return [{id:current}];if(sel==='dialog[open]')return [];return []},createElement(){const e=el();e.showModal=()=>{};e.close=()=>{};return e},addEventListener(type,fn){listeners[type]=fn}};
class MO{observe(){}}
const context={window:null,document,MutationObserver:MO,console,setTimeout(fn){fn();return 1},clearTimeout(){},decodeURIComponent,encodeURIComponent,alert(){},requireLogin:()=>true,stockEditSource:{},stockEditRowsDraft:[],stockBuckets:()=>[],locationOf:r=>r?.fila_scaffale||'',db:{master:{rows:[]}},show(id){current=id}};context.window=context;
vm.createContext(context);vm.runInContext(mobile,context,{filename:'mobile-search-v3.js'});vm.runInContext(hotfix,context,{filename:'mobile-navigation-hotfix.js'});
if(listeners.touchstart||listeners.touchmove||listeners.touchend||listeners.touchcancel)throw new Error('Swipe touch listeners must not be registered in production-disabled mode');
context.show('searchScreen');if(current!=='searchScreen')throw new Error('Normal navigation failed after disabling swipe');
context.show('home');if(current!=='home')throw new Error('Normal back button navigation failed after disabling swipe');
console.log('Swipe disabled runtime OK: no swipe listeners registered and normal navigation remains functional.');
