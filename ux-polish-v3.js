/* Final UX polish for REMOTO V1 managerial interface.
   - semantic pastel action cards
   - Registry keeps operational history only; duplicate Master controls stay in DOM but hidden
   - bootstraps Role Dashboard V1 + Premium Dashboard V2 + mobile request confirmation + registry repair + optimized goods receipt
*/
(function installWarehouseUxPolishV3(){
  'use strict';
  if(window.WarehouseUxPolishV3)return;

  const VERSION='2026.08.28-ux-polish-v3-premium2-floating-confirm1-registryfix1-goods-receipt2';
  let installed=false,baseRenderRegistry=null;

  function injectCss(){
    if(document.getElementById('warehouseUxPolishV3Css'))return;
    const s=document.createElement('style');
    s.id='warehouseUxPolishV3Css';
    s.textContent=`
      #mgrMoveHub .mgrAction[onclick*="openOperation('CARICA')"]{background:#E7F6EE!important;border-color:#CBE9D8!important;color:#185B40!important}
      #mgrMoveHub .mgrAction[onclick*="openOperation('CARICA')"] small{color:#47715F!important}
      #mgrMoveHub .mgrAction[onclick*="openOperation('SCARICA')"]{background:#FDEBEA!important;border-color:#F4CECA!important;color:#913C36!important}
      #mgrMoveHub .mgrAction[onclick*="openOperation('SCARICA')"] small{color:#855C58!important}
      #mgrMoveHub .mgrAction[onclick*="openStockMoveV2"]{background:#FFF6D8!important;border-color:#F0E0A6!important;color:#755A08!important}
      #mgrMoveHub .mgrAction[onclick*="openStockMoveV2"] small{color:#786B3D!important}
      #mgrStockHub .mgrAction[onclick*="openSearch"]{background:#E8F4FC!important;border-color:#CDE5F5!important;color:#245D8B!important}
      #mgrStockHub .mgrAction[onclick*="openSearch"] small{color:#56758E!important}
      #mgrStockHub .mgrAction[onclick*="openStockControlV2"]{background:#FFF0E2!important;border-color:#F2D6BC!important;color:#9A5721!important}
      #mgrStockHub .mgrAction[onclick*="openStockControlV2"] small{color:#856B55!important}
      #mgrMoveHub .mgrAction,#mgrStockHub .mgrAction{transition:transform .12s ease,filter .12s ease,box-shadow .12s ease}
      #mgrMoveHub .mgrAction:active,#mgrStockHub .mgrAction:active{transform:scale(.985);filter:saturate(1.08) brightness(.985)}
      #registryScreen .mgrRegistryMasterDuplicate{display:none!important}
    `;
    document.head.appendChild(s);
  }

  function hideRegistryMaster(){
    const input=document.getElementById('masterInput');
    const card=input?.closest?.('#registryScreen .card')||input?.closest?.('.card');
    if(!card)return false;
    if(!card.classList.contains('mgrRegistryMasterDuplicate'))card.classList.add('mgrRegistryMasterDuplicate');
    card.setAttribute('aria-hidden','true');
    return true;
  }

  function wrapRegistry(){
    const base=window.renderRegistry;
    if(typeof base!=='function'||base.__uxPolishV3)return false;
    baseRenderRegistry=base;
    const wrapped=function(){const out=baseRenderRegistry.apply(this,arguments);hideRegistryMaster();return out};
    wrapped.__uxPolishV3=true;wrapped.__previous=baseRenderRegistry;window.renderRegistry=wrapped;return true;
  }

  function loadGoodsReceiptFix(){
    if(window.WarehouseGoodsReceiptV2Fix){window.WarehouseGoodsReceiptV2Fix.install?.();return true}
    const existing=document.getElementById('goodsReceiptV2FixJs');if(existing)return true;
    const f=document.createElement('script');f.id='goodsReceiptV2FixJs';f.src='goods-receipt-v2-fix.js?v=20260828-gr2fix1';f.async=false;f.onload=()=>window.WarehouseGoodsReceiptV2Fix?.install?.();f.onerror=()=>console.error('Impossibile caricare goods-receipt-v2-fix.js');document.body.appendChild(f);return true;
  }

  function loadGoodsReceipt(){
    if(window.WarehouseGoodsReceiptV1){window.WarehouseGoodsReceiptV1.install?.();loadGoodsReceiptFix();return true}
    if(!document.getElementById('goodsReceiptV1Css')){const l=document.createElement('link');l.id='goodsReceiptV1Css';l.rel='stylesheet';l.href='goods-receipt-v1.css?v=20260827-gr1';document.head.appendChild(l)}
    const existing=document.getElementById('goodsReceiptV1Js');if(existing){existing.addEventListener('load',loadGoodsReceiptFix,{once:true});return true}

    /* V1 had a body-wide MutationObserver plus a 1.6s repaint loop. During V1 bootstrap only,
       replace those two schedulers so the stock logic is preserved but the repaint loop is not installed. */
    const RealMutationObserver=window.MutationObserver,realSetInterval=window.setInterval;
    class GoodsReceiptNoopObserver{observe(){}disconnect(){}takeRecords(){return[]}}
    let restored=false;
    const restore=()=>{if(restored)return;restored=true;window.MutationObserver=RealMutationObserver;window.setInterval=realSetInterval};
    window.MutationObserver=GoodsReceiptNoopObserver;
    window.setInterval=function(fn,delay,...args){if(Number(delay)===1600&&String(fn).includes('decorateDashboard'))return 0;return realSetInterval.call(window,fn,delay,...args)};

    const g=document.createElement('script');g.id='goodsReceiptV1Js';g.src='goods-receipt-v1.js?v=20260827-gr1';g.async=false;
    g.onload=()=>{restore();window.WarehouseGoodsReceiptV1?.install?.();loadGoodsReceiptFix()};
    g.onerror=()=>{restore();console.error('Impossibile caricare goods-receipt-v1.js')};
    document.body.appendChild(g);return true;
  }
  function loadRegistryFix(){
    if(window.WarehouseRegistryMovementsFixV1){window.WarehouseRegistryMovementsFixV1.install?.();loadGoodsReceipt();return true}
    const existing=document.getElementById('registryMovementsFixV1Js');if(existing){existing.addEventListener('load',loadGoodsReceipt,{once:true});return true}
    const r=document.createElement('script');r.id='registryMovementsFixV1Js';r.src='registry-movements-fix-v1.js?v=20260827-registry-premium1';r.async=false;r.onload=()=>{window.WarehouseRegistryMovementsFixV1?.install?.();loadGoodsReceipt()};r.onerror=()=>console.error('Impossibile caricare registry-movements-fix-v1.js');document.body.appendChild(r);return true;
  }
  function loadFloatingConfirm(){
    if(window.WarehouseRequestFloatingConfirmV1){window.WarehouseRequestFloatingConfirmV1.install?.();loadRegistryFix();return true}
    if(!document.getElementById('requestFloatingConfirmV1Css')){const l=document.createElement('link');l.id='requestFloatingConfirmV1Css';l.rel='stylesheet';l.href='request-floating-confirm-v1.css?v=20260827-rf1';document.head.appendChild(l)}
    const existing=document.getElementById('requestFloatingConfirmV1Js');if(existing){existing.addEventListener('load',loadRegistryFix,{once:true});return true}
    const f=document.createElement('script');f.id='requestFloatingConfirmV1Js';f.src='request-floating-confirm-v1.js?v=20260827-rf1';f.async=false;f.onload=()=>{window.WarehouseRequestFloatingConfirmV1?.install?.();loadRegistryFix()};f.onerror=()=>console.error('Impossibile caricare request-floating-confirm-v1.js');document.body.appendChild(f);return true;
  }
  function loadPremiumFix(){
    if(window.WarehousePremiumDashboardV2Fix){window.WarehousePremiumDashboardV2Fix.install?.();loadFloatingConfirm();return true}
    const existing=document.getElementById('premiumDashboardV2FixJs');if(existing){existing.addEventListener('load',loadFloatingConfirm,{once:true});return true}
    const f=document.createElement('script');f.id='premiumDashboardV2FixJs';f.src='premium-dashboard-v2-fix.js?v=20260827-premium2-fix1';f.async=false;f.onload=()=>{window.WarehousePremiumDashboardV2Fix?.install?.();loadFloatingConfirm()};f.onerror=()=>console.error('Impossibile caricare premium-dashboard-v2-fix.js');document.body.appendChild(f);return true;
  }
  function loadPremiumDashboard(){
    if(window.WarehousePremiumDashboardV2){window.WarehousePremiumDashboardV2.install?.();loadPremiumFix();return true}
    if(!document.getElementById('premiumDashboardV2Css')){const l=document.createElement('link');l.id='premiumDashboardV2Css';l.rel='stylesheet';l.href='premium-dashboard-v2.css?v=20260827-premium2';document.head.appendChild(l)}
    const existing=document.getElementById('premiumDashboardV2Js');if(existing){existing.addEventListener('load',loadPremiumFix,{once:true});return true}
    const p=document.createElement('script');p.id='premiumDashboardV2Js';p.src='premium-dashboard-v2.js?v=20260827-premium2';p.async=false;p.onload=()=>{window.WarehousePremiumDashboardV2?.install?.();loadPremiumFix()};p.onerror=()=>console.error('Impossibile caricare premium-dashboard-v2.js');document.body.appendChild(p);return true;
  }
  function loadRolePatch(){
    if(window.WarehouseRoleDashboardPatchV1){window.WarehouseRoleDashboardPatchV1.install?.();loadPremiumDashboard();return true}
    const existing=document.getElementById('roleDashboardPatchV1Js');if(existing){existing.addEventListener('load',loadPremiumDashboard,{once:true});return true}
    const p=document.createElement('script');p.id='roleDashboardPatchV1Js';p.src='role-dashboard-v1-patch.js?v=20260827-role-dashboard-patch1';p.async=false;p.onload=()=>{window.WarehouseRoleDashboardPatchV1?.install?.();loadPremiumDashboard()};p.onerror=()=>console.error('Impossibile caricare role-dashboard-v1-patch.js');document.body.appendChild(p);return true;
  }
  function loadRoleDashboard(){
    if(window.WarehouseRoleDashboardV1){window.WarehouseRoleDashboardV1.install?.();loadRolePatch();return true}
    if(!document.getElementById('roleDashboardV1Css')){const l=document.createElement('link');l.id='roleDashboardV1Css';l.rel='stylesheet';l.href='role-dashboard-v1.css?v=20260827-role-dashboard1';document.head.appendChild(l)}
    const existing=document.getElementById('roleDashboardV1Js');if(existing){existing.addEventListener('load',loadRolePatch,{once:true});return true}
    const s=document.createElement('script');s.id='roleDashboardV1Js';s.src='role-dashboard-v1.js?v=20260827-role-dashboard1';s.async=false;s.onload=()=>{window.WarehouseRoleDashboardV1?.install?.();loadRolePatch()};s.onerror=()=>console.error('Impossibile caricare role-dashboard-v1.js');document.body.appendChild(s);return true;
  }

  function install(){if(typeof document==='undefined')return false;injectCss();hideRegistryMaster();wrapRegistry();loadRoleDashboard();installed=true;return true}

  window.WarehouseUxPolishV3={version:VERSION,install,hideRegistryMaster,loadRoleDashboard,loadRolePatch,loadPremiumDashboard,loadPremiumFix,loadFloatingConfirm,loadRegistryFix,loadGoodsReceipt,loadGoodsReceiptFix};
  install();
})();