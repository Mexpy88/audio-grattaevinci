/* Registry Movements Fix V1
   Opens the MOVIMENTI registry directly, avoiding stale captured openRegistry references
   after the role/premium/floating-confirm UI layers.
*/
(function installRegistryMovementsFixV1(){
  'use strict';
  if(window.WarehouseRegistryMovementsFixV1)return;
  const VERSION='2026.08.27-registry-movements-fix1';

  function canView(){return window.WarehouseRoleDashboardV1?.can?.('REGISTRY_VIEW')??true}
  function deny(){return window.WarehouseRoleDashboardV1?.deny?.('Registro movimenti')??false}

  function decorate(){
    const s=document.getElementById('registryScreen');if(!s)return;
    const h=s.querySelector('h1');if(h)h.textContent='Movimenti';
    const back=s.querySelector(':scope>.back');if(back){back.textContent='← HOME';back.onclick=()=>show('home')}
    const tabs=s.querySelector('.tabs');if(tabs)tabs.style.display='none';
    if(document.body.classList.contains('rdReadOnly')){
      s.querySelectorAll('.movementCard .actions').forEach(a=>a.style.display='none');
    }
  }

  function openMovements(){
    if(!canView())return deny();
    try{
      // Use the live registry API instead of the historical captured openRegistry reference.
      if(typeof window.setRegistryTab==='function')window.setRegistryTab('MOVIMENTI');
      else if(typeof setRegistryTab==='function')setRegistryTab('MOVIMENTI');
      else {
        try{registryTab='MOVIMENTI'}catch{}
        if(typeof window.renderRegistry==='function')window.renderRegistry();
        else if(typeof renderRegistry==='function')renderRegistry();
      }
      try{if(typeof window.renderMasterStatus==='function')window.renderMasterStatus();else if(typeof renderMasterStatus==='function')renderMasterStatus()}catch{}
      if(typeof window.show==='function')window.show('registryScreen');
      else if(typeof show==='function')show('registryScreen');
      requestAnimationFrame(decorate);
      setTimeout(decorate,0);
      return true;
    }catch(err){
      console.error('[REGISTRY MOVIMENTI]',err);
      // Last-resort path: show the screen first, then render the live list.
      try{
        if(typeof window.show==='function')window.show('registryScreen');else show('registryScreen');
        if(typeof window.renderRegistry==='function')window.renderRegistry();else if(typeof renderRegistry==='function')renderRegistry();
        decorate();
        return true;
      }catch(fallbackErr){
        console.error('[REGISTRY MOVIMENTI FALLBACK]',fallbackErr);
        if(typeof warehouseToast==='function')warehouseToast('Impossibile aprire Movimenti.','error');
        else alert('Impossibile aprire Movimenti.');
        return false;
      }
    }
  }

  function install(){
    window.openRoleRegistryMovementsV1=openMovements;
    // Also repair any already-rendered dashboard action without forcing a dashboard rebuild.
    document.querySelectorAll('#rdDashboardV1 .rdAction').forEach(btn=>{
      if((btn.querySelector('b')?.textContent||'').trim().toUpperCase()==='MOVIMENTI')btn.setAttribute('onclick','openRoleRegistryMovementsV1()');
    });
    return true;
  }

  window.WarehouseRegistryMovementsFixV1={version:VERSION,openMovements,decorate,install};
  install();
})();
