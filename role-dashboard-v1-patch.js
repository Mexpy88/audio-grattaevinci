/* Role Dashboard V1 final integration patch.
   Handles late-loaded assisted-count modules, smartphone header density and contextual backs. */
(function installWarehouseRoleDashboardPatchV1(){
  'use strict';
  if(window.WarehouseRoleDashboardPatchV1)return;
  const VERSION='2026.08.27-role-dashboard-patch1';
  const $=id=>document.getElementById(id);
  const can=cap=>window.WarehouseRoleDashboardV1?.can?.(cap)??false;
  const deny=label=>window.WarehouseRoleDashboardV1?.deny?.(label);
  let timer=null,observer=null;

  function style(){
    if($('rdPatchCssV1'))return;
    const s=document.createElement('style');s.id='rdPatchCssV1';s.textContent=`
      @media(max-width:899px){
        .rdViewIcons{display:flex!important;margin-right:2px!important;gap:1px!important}
        .rdViewBtn{width:34px!important;height:36px!important;border-radius:10px!important;font-size:16px!important}
      }
      @media(max-width:430px){
        .topbar .logoButton img{width:min(124px,32vw)!important;max-width:none!important}
        .topNavLeft{flex:0 1 auto!important}.authArea{gap:2px!important}
        .rdViewBtn{width:30px!important;height:34px!important;font-size:14px!important}
        .userBtn{max-width:76px!important;font-size:12px!important;padding:0 7px!important;height:38px!important}
        .logoutBtn{height:38px!important;font-size:9px!important;padding:0 7px!important}
        #stickyTopBack{width:36px!important;height:36px!important;min-width:36px!important;font-size:24px!important}
      }
      #mgrCountAssistScreenV3 .scaZeroBtn{background:#fde9e5!important;color:#973a32!important;border:1px solid #f2d0cb!important;padding:9px 13px!important}
      #mgrCountAssistScreenV3 .scaZeroBtn.rdAbsenceDone{background:#e8eef4!important;color:#526b82!important;border-color:#d7e1e9!important}
      #mgrCountAssistScreenV3 .scaUnverified{display:none!important}
      #mgrCountAssistScreenV3 #scaCountBody>.status.warn:first-child{display:none!important}
      #mgrStockControlHub .mgrModeHint,#stockEditScreen #mgrRectificationHint{display:none!important}
    `;document.head.appendChild(s);
  }

  function relabelAbsence(){
    document.querySelectorAll('#mgrCountAssistScreenV3 .scaZeroBtn').forEach(btn=>{
      if(btn.dataset.rdAbsenceBound==='1')return;
      const attr=btn.getAttribute('onclick')||'',m=attr.match(/markCountZeroV3\('([^']+)'\)/);if(!m)return;
      const cid=m[1];btn.dataset.rdAbsenceBound='1';btn.textContent='NON PRESENTE';btn.removeAttribute('onclick');
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
    setTimeout(()=>{relabelAbsence();const fresh=[...document.querySelectorAll('#mgrCountAssistScreenV3 .scaZeroBtn')].find(x=>(x.getAttribute('data-rd-cid')||'')===cid);if(fresh)fresh.classList.add('rdAbsenceDone')},0);
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
    guardLate('confirmStockQuickFoundV3',can('RECTIFY')?'RECTIFY':'COUNT','Aggiunta materiale');
  }

  function patchRequestRoutes(){
    const p=window.openRoleRequestProgressV1;if(typeof p==='function'&&!p.__rdReturn){const f=function(){window.__rdRequestReturnV1='progress';return p.apply(this,arguments)};f.__rdReturn=true;window.openRoleRequestProgressV1=f}
    const c=window.openRoleRequestCompletionV1;if(typeof c==='function'&&!c.__rdReturn){const f=function(){window.__rdRequestReturnV1='completion';return c.apply(this,arguments)};f.__rdReturn=true;window.openRoleRequestCompletionV1=f}
    const screen=$('requestDetail'),back=screen?.querySelector(':scope>.back');if(back&&!back.dataset.rdRoleBack){back.dataset.rdRoleBack='1';back.addEventListener('click',e=>{if(!window.__rdRequestReturnV1)return;e.preventDefault();e.stopImmediatePropagation();window.__rdRequestReturnV1==='completion'?window.openRoleRequestCompletionV1?.():window.openRoleRequestProgressV1?.()},true)}
  }

  function decorate(){style();applyLateGuards();relabelAbsence();patchRequestRoutes();window.WarehouseRoleDashboardV1?.syncViewIcons?.()}
  function install(){style();decorate();if(!observer){observer=new MutationObserver(()=>requestAnimationFrame(decorate));observer.observe(document.body,{childList:true,subtree:true})}if(!timer)timer=setInterval(decorate,1000);return true}

  window.WarehouseRoleDashboardPatchV1={version:VERSION,install,decorate,confirmAbsence};install();
})();
