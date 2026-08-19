import fs from 'node:fs';
import vm from 'node:vm';

class El {
  constructor(id='',text=''){this.id=id;this.textContent=text;this.attrs=new Map();this.dataset={};this.disabled=false;this.listeners={};this.open=true;this.className='';this.onclick=null}
  hasAttribute(k){return this.attrs.has(k)} setAttribute(k,v){this.attrs.set(k,String(v))} getAttribute(k){return this.attrs.get(k)||null} removeAttribute(k){this.attrs.delete(k)}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
  async click(){const e={preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}};for(const fn of this.listeners.click||[])await fn(e);if(this.onclick)await this.onclick(e)}
  querySelector(sel){if(sel==='.btn.success')return this.confirm;if(sel==='.lmMasterCancel')return this.cancel;if(sel==='.dialogHead button')return this.close;return null}
  querySelectorAll(sel){return sel==='button'?[this.confirm,this.cancel,this.close].filter(Boolean):[]}
}
class MO{constructor(fn){this.fn=fn}observe(){}}

async function scenario(fails=false){
  const btn=new El('confirm','CONFERMA IMPORTAZIONE');btn.setAttribute('onclick','importMappedMaster()');
  const cancel=new El('cancel','ANNULLA'),close=new El('close','X'),dlg=new El('masterDialog'),info=new El('masterPreviewInfo'),body=new El('body');
  dlg.confirm=btn;dlg.cancel=cancel;dlg.close=close;
  let alertText='';
  const document={documentElement:{dataset:{}},body,getElementById(id){return ({masterDialog:dlg,masterPreviewInfo:info}[id]||null)},querySelectorAll(sel){return sel==='button'?[btn,cancel,close]:[]}};
  body.querySelectorAll=document.querySelectorAll.bind(document);
  const sandbox={console,document,MutationObserver:MO,setTimeout,clearTimeout,alert:m=>alertText=String(m),warehouseToast:()=>{},db:{master:{rows:[],imported_at:null}},window:null,addEventListener:()=>{}};
  sandbox.window=sandbox;
  sandbox.importMappedMaster=async()=>{await new Promise(r=>setTimeout(r,5));if(fails)throw new Error('TEST FAIL');sandbox.db.master={rows:[{x:1}],imported_at:new Date().toISOString()};dlg.open=false};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('ui-hardening.js','utf8'),sandbox);
  await btn.click();
  return {sandbox,btn,dlg,info,alertText};
}

const ok=await scenario(false);
if(ok.sandbox.db.master.rows.length!==1)throw new Error('Success path did not import rows');
if(ok.btn.dataset.hardImportBound!=='1')throw new Error('Confirm button was not explicitly bound');
if(ok.btn.getAttribute('onclick')!==null)throw new Error('Legacy inline onclick was not removed');
if(!ok.sandbox.WarehouseUIHealth.getReport().ok)throw new Error('UI health reported missing handlers');
if(ok.btn.disabled)throw new Error('Button remained disabled after success');

const bad=await scenario(true);
if(!/TEST FAIL/.test(bad.alertText))throw new Error('Failure path did not surface the error');
if(!/TEST FAIL/.test(bad.info.textContent))throw new Error('Failure path did not update status');
if(bad.btn.disabled)throw new Error('Button remained disabled after failure');

console.log('UI hardening runtime OK: master confirm success and failure paths verified.');
