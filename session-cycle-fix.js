/* REMOTO session-cycle UI fix.
   Keeps imported APP_DATI history intact, while Home counters only show activity created after the current Master import.
   Dirty/export state is counted from the latest import/export baseline.
   Adds an explicit PIN reveal button without changing the login logic. */
(function installWarehouseSessionCycleFix(){
  'use strict';
  if(window.WarehouseSessionCycleFix)return;

  const VERSION='2026.08.24-session-cycle2-safe';
  const META_KEY='so_local_master_meta_v3';
  let installed=false;

  const byId=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const text=v=>String(v??'');
  function readMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch{return {}}}
  function ms(v){const n=new Date(v||0).getTime();return Number.isFinite(n)?n:0}
  function importBaselineMs(){
    const m=readMeta();
    return Math.max(ms(typeof db!=='undefined'?db?.master?.imported_at:null),ms(m.importedAt));
  }
  function dirtyBaselineMs(){
    const m=readMeta();
    return Math.max(importBaselineMs(),ms(m.lastExportAt));
  }
  function movementTime(r){return Math.max(ms(r?.registered_at),ms(r?.operation_at),ms(r?.created_at),ms(r?.updated_at))}
  function documentTime(r){return Math.max(ms(r?.created_at),ms(r?.operation_at),ms(r?.registered_at))}
  function requestTime(r){return Math.max(ms(r?.created_at),ms(r?.requested_at))}
  function sessionCounts(){
    const base=importBaselineMs();
    if(!base)return {moves:0,docs:0,reqs:0};
    return {
      moves:(db?.movements||[]).filter(r=>movementTime(r)>base).length,
      docs:(db?.documents||[]).filter(r=>documentTime(r)>base).length,
      reqs:(db?.requests||[]).filter(r=>requestTime(r)>base).length
    };
  }
  function sessionDirtyCount(){
    const base=dirtyBaselineMs();
    if(!base)return 0;
    return (db?.audits||[]).filter(a=>a?.action!=='MASTER_IMPORT'&&ms(a?.at)>base).length;
  }
  function fmtWhen(v){
    if(!v)return '—';const d=new Date(v);if(Number.isNaN(d.getTime()))return '—';
    return d.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  function patchMasterStats(){
    const box=byId('lmStats');if(!box||box.classList.contains('hidden'))return;
    const nums=box.querySelectorAll(':scope > div > b');if(nums.length<3)return;
    const c=sessionCounts();nums[0].textContent=String(c.moves);nums[1].textContent=String(c.docs);nums[2].textContent=String(c.reqs);
    box.dataset.sessionCycle='1';
  }
  function patchDirtyBar(){
    const bar=byId('uxDirtyBar');if(!bar)return;
    const dirty=sessionDirtyCount(),msg=byId('uxDirtyText'),m=readMeta();
    if(dirty<=0){bar.classList.add('hidden');if(msg)msg.innerHTML='';return}
    bar.classList.remove('hidden');
    if(msg)msg.innerHTML=`<b>${dirty} modifiche da esportare</b><br>Ultimo export: ${text(fmtWhen(m.lastExportAt))}`;
  }
  function patchAll(){patchMasterStats();patchDirtyBar();return {counts:sessionCounts(),dirty:sessionDirtyCount()}}
  function schedulePatch(delay=70){setTimeout(()=>{try{patchAll()}catch(e){console.warn('Session cycle patch',e)}},delay)}

  function eyeSvg(hidden){
    return hidden
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.4 12s3.4-6 9.6-6 9.6 6 9.6 6-3.4 6-9.6 6-9.6-6-9.6-6Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6.2 0 9.6 6 9.6 6a16 16 0 0 1-3 3.7M6.2 6.2C3.7 8.1 2.4 12 2.4 12s3.4 6 9.6 6c1.4 0 2.7-.3 3.8-.8M9.9 9.9A3 3 0 0 0 14.1 14.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function injectPinStyle(){
    if(typeof document==='undefined'||byId('sessionCyclePinStyle'))return;
    const style=document.createElement('style');style.id='sessionCyclePinStyle';
    style.textContent=`
      #pinInput::-ms-reveal,#pinInput::-ms-clear,#deleteMasterPin::-ms-reveal,#deleteMasterPin::-ms-clear{display:none!important;width:0!important;height:0!important}
      .pinRevealWrap{position:relative;width:100%}
      .pinRevealWrap>.pinInput{width:100%!important;box-sizing:border-box!important;padding-right:54px!important}
      .pinRevealBtn{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:42px;height:42px;border:0;border-radius:12px;background:transparent;color:#587087;display:grid;place-items:center;padding:9px;cursor:pointer;-webkit-tap-highlight-color:transparent}
      .pinRevealBtn:focus-visible{outline:2px solid #2c60aa;outline-offset:1px}
      .pinRevealBtn svg{width:24px;height:24px;display:block}
    `;
    document.head.appendChild(style);
  }
  function installPinEye(inputId){
    const input=byId(inputId);if(!input||input.dataset.pinEyeInstalled==='1')return false;
    input.dataset.pinEyeInstalled='1';
    const wrap=document.createElement('div');wrap.className='pinRevealWrap';
    input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const button=document.createElement('button');button.type='button';button.className='pinRevealBtn';button.setAttribute('aria-label','Mostra PIN');button.setAttribute('aria-pressed','false');button.innerHTML=eyeSvg(true);
    button.addEventListener('click',()=>{
      const show=input.type==='password';
      input.type=show?'text':'password';
      button.setAttribute('aria-label',show?'Nascondi PIN':'Mostra PIN');
      button.setAttribute('aria-pressed',show?'true':'false');
      button.innerHTML=eyeSvg(!show);
      try{input.focus({preventScroll:true});const n=input.value.length;input.setSelectionRange?.(n,n)}catch{}
    });
    wrap.appendChild(button);return true;
  }
  function installPinEyes(){injectPinStyle();installPinEye('pinInput');installPinEye('deleteMasterPin')}

  function wrapSaveDb(){
    const base=window.saveDb;if(typeof base!=='function'||base.__sessionCycleWrapped)return;
    const wrapped=function(){const out=base.apply(this,arguments);schedulePatch(80);return out};
    wrapped.__sessionCycleWrapped=true;window.saveDb=wrapped;
  }
  function wrapRenderPanel(){
    const lm=window.LocalMaster,base=lm?.renderPanel;if(!lm||typeof base!=='function'||base.__sessionCycleWrapped)return;
    const wrapped=async function(){const out=await base.apply(this,arguments);patchAll();schedulePatch(60);return out};
    wrapped.__sessionCycleWrapped=true;lm.renderPanel=wrapped;
  }
  function install(){
    if(installed||typeof document==='undefined')return false;installed=true;
    installPinEyes();wrapSaveDb();wrapRenderPanel();patchAll();schedulePatch(120);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){installPinEyes();schedulePatch(80)}});
    return true;
  }

  window.WarehouseSessionCycleFix={version:VERSION,importBaselineMs,dirtyBaselineMs,movementTime,documentTime,requestTime,sessionCounts,sessionDirtyCount,patchMasterStats,patchDirtyBar,patchAll,installPinEye,installPinEyes,install};
  if(typeof document!=='undefined')install();
})();
