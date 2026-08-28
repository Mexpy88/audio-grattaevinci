import fs from 'node:fs';
import vm from 'node:vm';

class El {
  constructor(id='',text=''){this.id=id;this.textContent=text;this.attrs=new Map();this.dataset={};this.disabled=false;this.listeners={};this.className='';this.onclick=null;this.type=''}
  hasAttribute(k){return this.attrs.has(k)} setAttribute(k,v){this.attrs.set(k,String(v))} getAttribute(k){return this.attrs.get(k)||null}
  querySelector(){return null} querySelectorAll(){return []}
}
class MO{constructor(fn){this.fn=fn}observe(){}}

const btn=new El('confirm','CONFERMA IMPORTAZIONE');btn.setAttribute('onclick','importMappedMaster()');
const dlg=new El('masterDialog');dlg.querySelector=sel=>sel==='.btn.success'?btn:null;
const document={documentElement:{dataset:{}},body:new El('body'),querySelector:sel=>sel==='#masterDialog .btn.success'?btn:null,querySelectorAll:sel=>sel==='button'?[btn]:[],getElementById:id=>id==='masterDialog'?dlg:null};
document.body.querySelectorAll=document.querySelectorAll.bind(document);
let calls=0;
const originalImport=async()=>{calls++};
const sandbox={console,document,MutationObserver:MO,warehouseToast:()=>{},window:null,importMappedMaster:originalImport,addEventListener:()=>{}};sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('ui-hardening.js','utf8'),sandbox);

if(sandbox.importMappedMaster!==originalImport)throw new Error('UI hardening must not replace importMappedMaster');
if(btn.dataset.hardImportBound!=='controller')throw new Error('Master button should be marked for controller ownership');
if(btn.listeners?.click?.length)throw new Error('UI hardening must not bind a Master import click handler');
if(!sandbox.WarehouseUIHealth.getReport().ok)throw new Error('UI health reported missing handlers');
await sandbox.importMappedMaster();
if(calls!==1)throw new Error('Original import function should remain directly callable');
console.log('UI hardening clean runtime OK: Master import ownership is isolated.');
