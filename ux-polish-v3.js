/* Final UX polish for REMOTO V1 managerial interface.
   - semantic pastel action cards
   - Registry keeps operational history only; duplicate Master controls stay in DOM but hidden
     so LocalMaster can still reuse #masterInput from the Home Master panel.
*/
(function installWarehouseUxPolishV3(){
  'use strict';
  if(window.WarehouseUxPolishV3)return;

  const VERSION='2026.08.26-ux-polish-v3';
  let installed=false,baseRenderRegistry=null;

  function injectCss(){
    if(document.getElementById('warehouseUxPolishV3Css'))return;
    const s=document.createElement('style');
    s.id='warehouseUxPolishV3Css';
    s.textContent=`
      /* MOVIMENTA: colori semantici delicati, non saturi. */
      #mgrMoveHub .mgrAction[onclick*="openOperation('CARICA')"]{
        background:#E7F6EE!important;border-color:#CBE9D8!important;color:#185B40!important;
      }
      #mgrMoveHub .mgrAction[onclick*="openOperation('CARICA')"] small{color:#47715F!important}
      #mgrMoveHub .mgrAction[onclick*="openOperation('SCARICA')"]{
        background:#FDEBEA!important;border-color:#F4CECA!important;color:#913C36!important;
      }
      #mgrMoveHub .mgrAction[onclick*="openOperation('SCARICA')"] small{color:#855C58!important}
      #mgrMoveHub .mgrAction[onclick*="openStockMoveV2"]{
        background:#FFF6D8!important;border-color:#F0E0A6!important;color:#755A08!important;
      }
      #mgrMoveHub .mgrAction[onclick*="openStockMoveV2"] small{color:#786B3D!important}

      /* GIACENZE. */
      #mgrStockHub .mgrAction[onclick*="openSearch"]{
        background:#E8F4FC!important;border-color:#CDE5F5!important;color:#245D8B!important;
      }
      #mgrStockHub .mgrAction[onclick*="openSearch"] small{color:#56758E!important}
      #mgrStockHub .mgrAction[onclick*="openStockControlV2"]{
        background:#FFF0E2!important;border-color:#F2D6BC!important;color:#9A5721!important;
      }
      #mgrStockHub .mgrAction[onclick*="openStockControlV2"] small{color:#856B55!important}

      #mgrMoveHub .mgrAction,#mgrStockHub .mgrAction{
        transition:transform .12s ease,filter .12s ease,box-shadow .12s ease;
      }
      #mgrMoveHub .mgrAction:active,#mgrStockHub .mgrAction:active{
        transform:scale(.985);filter:saturate(1.08) brightness(.985);
      }

      /* La gestione Master ha un solo punto canonico: MASTER EXCEL nella Home. */
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
    const wrapped=function(){
      const out=baseRenderRegistry.apply(this,arguments);
      hideRegistryMaster();
      return out;
    };
    wrapped.__uxPolishV3=true;
    wrapped.__previous=baseRenderRegistry;
    window.renderRegistry=wrapped;
    return true;
  }

  function install(){
    if(typeof document==='undefined')return false;
    injectCss();hideRegistryMaster();wrapRegistry();
    installed=true;
    return true;
  }

  window.WarehouseUxPolishV3={version:VERSION,install,hideRegistryMaster};
  install();
})();
