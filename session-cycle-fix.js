/* REMOTO session-cycle UI fix.
   Keeps imported APP_DATI history intact, but Home counters only show activity created after the current Master import.
   Also removes Microsoft Edge's native password-reveal affordance from PIN fields for consistent browser UI. */
(function installWarehouseSessionCycleFix(){
  'use strict';
  if(window.WarehouseSessionCycleFix)return;

  const VERSION='2026.08.24-session-cycle1';
  const META_KEY='so_local_master_meta_v3';
  let installed=false;

  const byId=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const text=v=>String(v??'');
  function readMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch{return {}}}
  function ms(v){const n=new Date(v||0).getTime();return Number.isFinite(n)?n:0}
  function baselineMs(){
    const m=readMeta();
    return Math.max(ms(typeof db!=='undefined'?db?.master?.imported_at:null),ms(m.importedAt),ms(m.lastExportAt));
  }
  function movementTime(r){return Math.max(ms(r?.registered_at),ms(r?.operation_at),ms(r?.created_at),ms(r?.updated_at))}
  function documentTime(r){return Math.max(ms(r?.created_at),ms(r?.operation_at),ms(r?.registered_at))}
  function requestTime(r){return Math.max(ms(r?.created_at),ms(r?.requested_at))}
  function sessionCounts(){
    const base=baselineMs();
    if(!base)return {moves:0,docs:0,reqs:0};
    return {
      moves:(db?.movements||[]).filter(r=>movementTime(r)>base).length,
      docs:(db?.documents||[]).filter(r=>documentTime(r)>base).length,
      reqs:(db?.requests||[]).filter(r=>requestTime(r)>base).length
    };
  }
  function sessionDirtyCount(){
    const base=baselineMs();
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
  function injectPinStyle(){
    if(typeof document==='undefined'||byId('sessionCyclePinStyle'))return;
    const style=document.createElement('style');style.id='sessionCyclePinStyle';
    style.textContent=`#pinInput::-ms-reveal,#pinInput::-ms-clear,#deleteMasterPin::-ms-reveal,#deleteMasterPin::-ms-clear{display:none!important;width:0!important;height:0!important}`;
    document.head.appendChild(style);
  }
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
    injectPinStyle();wrapSaveDb();wrapRenderPanel();patchAll();schedulePatch(120);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedulePatch(80)});
    return true;
  }

  window.WarehouseSessionCycleFix={version:VERSION,baselineMs,movementTime,documentTime,requestTime,sessionCounts,sessionDirtyCount,patchMasterStats,patchDirtyBar,patchAll,install};
  if(typeof document!=='undefined')install();
})();
