/* Role Dashboard V1 final integration patch.
   Handles late-loaded assisted-count modules, smartphone header density and contextual backs. */
(function installWarehouseRoleDashboardPatchV1(){
  'use strict';
  if(window.WarehouseRoleDashboardPatchV1)return;
  const VERSION='2026.08.27-role-dashboard-patch1.3-contextual-export';
  const $=id=>document.getElementById(id);
  const can=cap=>window.WarehouseRoleDashboardV1?.can?.(cap)??false;
  const deny=label=>window.WarehouseRoleDashboardV1?.deny?.(label);
  let timer=null,observer=null,clickBound=false;

  function style(){
    if($('rdPatchCssV1'))return;
    const s=document.createElement('style');s.id='rdPatchCssV1';s.textContent=`
      @media(max-width:899px){
        .rdViewIcons{display:flex!important;margin-right:2px!important;gap:1px!important}
        .rdViewBtn{width:34px!important;height:36px!important;border-radius:10px!important;font-size:16px!important}
      }
      @media(max-width:430px){
        body:not(.desktopMode) .topbar{gap:2px!important;padding-left:2px!important;padding-right:2px!important}
        body:not(.desktopMode) .topNavLeft{flex:0 1 auto!important;min-width:0!important;gap:2px!important}
        body:not(.desktopMode) .topbar .logoButton{flex:0 1 94px!important;min-width:0!important;max-width:94px!important;overflow:hidden!important}
        body:not(.desktopMode) .topbar .logoButton img{width:94px!important;max-width:94px!important;min-width:0!important}
        body:not(.desktopMode) .authArea{gap:1px!important;flex:0 0 auto!important;min-width:0!important}
        body:not(.desktopMode) .rdViewIcons{gap:0!important;margin-right:0!important;flex:0 0 auto!important}
        body:not(.desktopMode) .rdViewBtn{width:27px!important;height:34px!important;min-width:27px!important;padding:0!important;border-radius:9px!important;font-size:13px!important}
        body:not(.desktopMode) #rdInboxBtnV2{width:27px!important;height:34px!important;min-width:27px!important;padding:0!important}
        body:not(.desktopMode) .userBtn{max-width:66px!important;min-width:0!important;font-size:11px!important;padding:0 5px!important;height:36px!important}
        body:not(.desktopMode) .logoutBtn{height:36px!important;font-size:9px!important;padding:0 6px!important}
        body:not(.desktopMode) #stickyTopBack{width:34px!important;height:34px!important;min-width:34px!important;font-size:22px!important;margin-right:2px!important}

        body:not(.desktopMode) .uxDirtyBar.rdMobileDirtyCompact{left:50%!important;right:auto!important;bottom:max(10px,env(safe-area-inset-bottom))!important;width:auto!important;min-width:0!important;max-width:calc(100% - 24px)!important;transform:translateX(-50%)!important;display:flex!important;flex-direction:row!important;align-items:center!important;gap:6px!important;border-radius:16px!important;padding:6px!important;box-shadow:0 10px 28px #0c223b44!important}
        body:not(.desktopMode) .uxDirtyBar.rdMobileDirtyCompact .uxDirtyText{display:none!important}
        body:not(.desktopMode) .uxDirtyBar.rdMobileDirtyCompact #uxDirtyExport{min-height:44px!important;border-radius:999px!important;padding:10px 20px!important;font-size:13px!important;line-height:1!important}
        body:not(.desktopMode) .uxDirtyBar.rdMobileExportContextHidden{display:none!important}
      }
      #rdMobileExportDialog{width:min(92vw,430px);border:0;border-radius:22px;padding:0;color:#17314d;box-shadow:0 24px 70px rgba(8,28,47,.34)}
      #rdMobileExportDialog::backdrop{background:rgba(8,25,43,.62);backdrop-filter:blur(2px)}
      .rdMobileExportHead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:17px 17px 8px}.rdMobileExportHead h2{margin:0;font-size:20px}.rdMobileExportClose{width:38px;height:38px;border:0;border-radius:50%;background:#edf3f8;color:#17314d;font-size:22px}
      .rdMobileExportBody{padding:4px 17px 16px}.rdMobileExportCount{font-size:40px;font-weight:950;color:#245ca6;line-height:1;margin:6px 0}.rdMobileExportBody p{margin:7px 0;color:#65788c;font-size:13px;line-height:1.4}.rdMobileExportActions{display:grid;grid-template-columns:1fr 1.25fr;gap:8px;margin-top:15px}.rdMobileExportActions button{min-height:50px;border:0;border-radius:14px;font-weight:950}.rdMobileExportCancel{background:#e8eef4;color:#17314d}.rdMobileExportGo{background:#245ca6;color:#fff}
      #mgrCountAssistScreenV3 .scaZeroBtn{background:#fde9e5!important;color:#973a32!important;border:1px solid #f2d0cb!important;padding:9px 13px!important}
      #mgrCountAssistScreenV3 .scaUnverified{display:none!important}
      #mgrCountAssistScreenV3 #scaCountBody>.status.warn:first-child{display:none!important}
      #mgrStockControlHub .mgrModeHint,#stockEditScreen #mgrRectificationHint{display:none!important}
    `;document.head.appendChild(s);
  }

  function relabelAbsence(){
    document.querySelectorAll('#mgrCountAssistScreenV3 .scaZeroBtn').forEach(btn=>{
      if(btn.dataset.rdAbsenceBound==='1')return;
      const attr=btn.getAttribute('onclick')||'',m=attr.match(/markCountZeroV3\('([^']+)'\)/);if(!m)return;
      const cid=m[1];btn.dataset.rdAbsenceBound='1';btn.dataset.rdCid=cid;btn.textContent='NON PRESENTE';btn.removeAttribute('onclick');
      btn.addEventListener('click',()=>confirmAbsence(cid,btn));
    });
  }

  function confirmAbsence(cid,btn){
    if(!can('COUNT'))return deny?.('Conteggio assistito');
    const variant=btn.closest('.scaVariant'),group=btn.closest('.scaArticleGroup');
    const article=group?.querySelector('.scaArticleCode')?.textContent?.trim()||'Articolo';
    const variantLabel=variant?.querySelector('.scaVariantTitle')?.textContent?.trim()||'';
    const expected=variant?.querySelector('.scaMetric b')?.textContent?.trim()||'0';
    const partials=variant?.querySelectorAll('.scaPartialChip')?.length||0;
    const msg=`${article}${variantLabel?' · '+variantLabel:''}\n\nConfermi che questa variante NON È PRESENTE nella posizione verificata?\n\nAtteso: ${expected} · Contato: 0${partials?'\nI parziali già inseriti verranno azzerati.':''}`;
    if(!confirm(msg))return;
    const nativeConfirm=window.confirm;
    try{if(partials)window.confirm=()=>true;window.markCountZeroV3?.(cid)}finally{window.confirm=nativeConfirm}
  }

  function guardLate(name,cap,label){
    const base=window[name];if(typeof base!=='function'||base.__rdLateGuard)return;
    const f=function(){if(!can(cap))return deny?.(label);return base.apply(this,arguments)};f.__rdLateGuard=true;f.__previous=base;window[name]=f;
  }
  function applyLateGuards(){
    guardLate('loadPhysicalCountAssistV3','COUNT','Conteggio assistito');
    guardLate('confirmPhysicalCountAssistV3','COUNT','Conteggio assistito');
    guardLate('addCountPartialV3','COUNT','Conteggio assistito');
    guardLate('removeCountPartialV3','COUNT','Conteggio assistito');
    guardLate('clearCountPartialsV3','COUNT','Conteggio assistito');
    guardLate('markCountZeroV3','COUNT','Conteggio assistito');
    guardLate('removeAssistExtraV3','COUNT','Conteggio assistito');
    const quick=window.openStockQuickFoundV3;if(typeof quick==='function'&&!quick.__rdLateGuard){const f=function(mode){const cap=mode==='direct'?'RECTIFY':'COUNT';if(!can(cap))return deny?.(mode==='direct'?'Rettifica':'Conteggio assistito');return quick.apply(this,arguments)};f.__rdLateGuard=true;f.__previous=quick;window.openStockQuickFoundV3=f}
    const confirmQuick=window.confirmStockQuickFoundV3;if(typeof confirmQuick==='function'&&!confirmQuick.__rdLateGuard){const f=function(){if(!(can('RECTIFY')||can('COUNT')))return deny?.('Aggiunta materiale');return confirmQuick.apply(this,arguments)};f.__rdLateGuard=true;f.__previous=confirmQuick;window.confirmStockQuickFoundV3=f}
  }

  function patchRequestRoutes(){
    const p=window.openRoleRequestProgressV1;if(typeof p==='function'&&!p.__rdReturn){const f=function(){window.__rdRequestReturnV1='progress';return p.apply(this,arguments)};f.__rdReturn=true;window.openRoleRequestProgressV1=f}
    const c=window.openRoleRequestCompletionV1;if(typeof c==='function'&&!c.__rdReturn){const f=function(){window.__rdRequestReturnV1='completion';return c.apply(this,arguments)};f.__rdReturn=true;window.openRoleRequestCompletionV1=f}
    const screen=$('requestDetail'),back=screen?.querySelector(':scope>.back');if(back&&!back.dataset.rdRoleBack){back.dataset.rdRoleBack='1';back.addEventListener('click',e=>{if(!window.__rdRequestReturnV1)return;e.preventDefault();e.stopImmediatePropagation();window.__rdRequestReturnV1==='completion'?window.openRoleRequestCompletionV1?.():window.openRoleRequestProgressV1?.()},true)}
  }

  function smartphoneMode(){return !document.body.classList.contains('desktopMode')&&(window.matchMedia?.('(max-width:430px)')?.matches??window.innerWidth<=430)}
  function readMasterMeta(){try{return JSON.parse(localStorage.getItem('so_local_master_meta_v3')||'{}')}catch{return{}}}
  function formatWhen(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
  function dirtyCount(){
    try{const m=readMasterMeta(),base=m.lastExportAt||m.importedAt;if(!base)return Array.isArray(db?.audits)?db.audits.length:0;const t=new Date(base).getTime();return(db?.audits||[]).filter(a=>new Date(a.at||0).getTime()>t).length}catch{return 0}
  }
  function mobileExportVisible(){
    if(!smartphoneMode()||!can('EXPORT'))return false;
    try{if(!(db?.master?.rows||[]).length)return false}catch{return false}
    if(dirtyCount()<=0)return false;
    return document.querySelector('.screen.on')?.id==='home';
  }
  function ensureMobileExportDialog(){
    let d=$('rdMobileExportDialog');if(d)return d;
    d=document.createElement('dialog');d.id='rdMobileExportDialog';d.innerHTML='<div class="rdMobileExportHead"><h2>Esporta Master</h2><button type="button" class="rdMobileExportClose" aria-label="Chiudi">×</button></div><div id="rdMobileExportBody" class="rdMobileExportBody"></div>';
    document.body.appendChild(d);d.querySelector('.rdMobileExportClose').onclick=()=>d.close();d.addEventListener('cancel',e=>{e.preventDefault();d.close()});return d;
  }
  function openMobileExportDialog(){
    if(!mobileExportVisible())return false;
    const d=ensureMobileExportDialog(),body=$('rdMobileExportBody'),count=dirtyCount(),meta=readMasterMeta();
    body.innerHTML=`<div class="rdMobileExportCount">${count}</div><p><b>${count===1?'modifica da esportare':'modifiche da esportare'}</b><br>Ultimo export: ${formatWhen(meta.lastExportAt)}</p><p>Le modifiche sono già salvate nel browser. L’export genera il Master Excel aggiornato.</p><div class="rdMobileExportActions"><button type="button" class="rdMobileExportCancel">ANNULLA</button><button type="button" class="rdMobileExportGo">ESPORTA MASTER</button></div>`;
    body.querySelector('.rdMobileExportCancel').onclick=()=>d.close();body.querySelector('.rdMobileExportGo').onclick=async()=>{d.close();await window.LocalMaster?.exportUpdatedMaster?.()};d.showModal();return true;
  }
  function patchMobileExport(){
    const bar=$('uxDirtyBar'),btn=$('uxDirtyExport');if(!bar||!btn)return;
    const mobile=smartphoneMode(),visible=mobileExportVisible();
    bar.classList.toggle('rdMobileDirtyCompact',mobile);
    bar.classList.toggle('rdMobileExportContextHidden',mobile&&!visible);
    const dlg=$('rdMobileExportDialog');if(mobile&&!visible&&dlg?.open)dlg.close();
    if(btn.dataset.rdMobileExportBound==='1')return;
    btn.dataset.rdMobileExportBound='1';
    btn.addEventListener('click',e=>{if(!smartphoneMode())return;e.preventDefault();e.stopImmediatePropagation();openMobileExportDialog()},true);
  }

  function decorate(){style();applyLateGuards();relabelAbsence();patchRequestRoutes();patchMobileExport();window.WarehouseRoleDashboardV1?.syncViewIcons?.()}
  function install(){
    style();decorate();
    if(!observer){observer=new MutationObserver(()=>requestAnimationFrame(decorate));observer.observe(document.body,{childList:true,subtree:true})}
    if(!timer)timer=setInterval(decorate,700);
    if(!clickBound){clickBound=true;document.addEventListener('click',()=>setTimeout(patchMobileExport,0),true)}
    window.addEventListener('resize',decorate,{passive:true});return true
  }

  window.WarehouseRoleDashboardPatchV1={version:VERSION,install,decorate,confirmAbsence,patchMobileExport,openMobileExportDialog,mobileExportVisible};install();
})();
