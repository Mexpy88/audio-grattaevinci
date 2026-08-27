import fs from 'node:fs';
import vm from 'node:vm';

class El {
  constructor(id='',text=''){this.id=id;this.textContent=text;this.attrs=new Map();this.dataset={};this.disabled=false;this.listeners={};this.open=true;this.className='';this.onclick=null;this.type=''}
  hasAttribute(k){return this.attrs.has(k)} setAttribute(k,v){this.attrs.set(k,String(v))} getAttribute(k){return this.attrs.get(k)||null} removeAttribute(k){this.attrs.delete(k)}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
  querySelector(sel){if(sel==='.btn.success')return this.confirm;if(sel==='.lmMasterCancel')return this.cancel;if(sel==='.dialogHead button')return this.close;return null}
  querySelectorAll(sel){return sel==='button'?[this.confirm,this.cancel,this.close].filter(Boolean):[]}
}
class MO{constructor(fn){this.fn=fn}observe(){}}

const btn=new El('confirm','CONFERMA IMPORTAZIONE');btn.setAttribute('onclick','importMappedMaster()');
const cancel=new El('cancel','ANNULLA'),close=new El('close','X'),dlg=new El('masterDialog'),body=new El('body');dlg.confirm=btn;dlg.cancel=cancel;dlg.close=close;
const document={documentElement:{dataset:{}},body,getElementById(id){return id==='masterDialog'?dlg:null},querySelector(sel){return sel==='#masterDialog .btn.success'?btn:null},querySelectorAll(sel){return sel==='button'?[btn,cancel,close]:[]}};body.querySelectorAll=document.querySelectorAll.bind(document);
let importCalls=0;const originalImport=()=>{importCalls++};
const sandbox={console,document,MutationObserver:MO,warehouseToast:()=>{},window:null,addEventListener:()=>{},importMappedMaster:originalImport};sandbox.window=sandbox;
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('ui-hardening.js','utf8'),sandbox);

if(sandbox.importMappedMaster!==originalImport)throw new Error('UI hardening must not replace importMappedMaster anymore');
if(btn.dataset.masterConfirmPassive!=='1')throw new Error('Master confirm was not marked passive');
if(importCalls!==0)throw new Error('UI hardening executed Master import unexpectedly');
if(!sandbox.WarehouseUIHealth.getReport().ok)throw new Error('UI health reported missing handlers');
if(typeof sandbox.WarehouseUIHealth.hardenMasterConfirm!=='function')throw new Error('Compatibility API hardenMasterConfirm missing');
if(sandbox.WarehouseUIHealth.hardenMasterConfirm()!==true)throw new Error('Passive Master confirm compatibility hook failed');

console.log('UI hardening runtime OK: general auditing active, Master import ownership is passive.');
