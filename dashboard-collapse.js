/* Home compatta: rende collassabili i dettagli tecnici del Master Excel. */
(function installMasterDashboardCollapse(){
  'use strict';
  const KEY='so_master_details_open_v1';

  function css(){
    if(document.getElementById('masterDashboardCollapseStyle'))return;
    const s=document.createElement('style');
    s.id='masterDashboardCollapseStyle';
    s.textContent=`
      #uxMasterDetailsFold{margin:14px 0 6px;border:1px solid #d8e4ee;border-radius:22px;background:#f7fafc;overflow:hidden}
      #uxMasterDetailsFold>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:58px;padding:0 20px;cursor:pointer;user-select:none;font-weight:950;font-size:15px;letter-spacing:.04em;color:#173b5e}
      #uxMasterDetailsFold>summary::-webkit-details-marker{display:none}
      #uxMasterDetailsFold>summary .uxFoldChevron{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#e5eef6;color:#2c60aa;font-size:22px;font-weight:800;transition:transform .18s ease,background .18s ease}
      #uxMasterDetailsFold[open]>summary .uxFoldChevron{transform:rotate(180deg);background:#d9e8f5}
      #uxMasterDetailsFold>summary:active{background:#eef5fa}
      #uxMasterDetailsFold .uxFoldBody{padding:0 14px 14px}
      #uxMasterDetailsFold:not([open]) .uxFoldBody{display:none}
      #uxMasterDetailsFold #uxMasterDashboard{margin-top:4px}
      #uxMasterDetailsFold #uxMasterActions{margin-bottom:0}
      @media(max-width:430px){
        #uxMasterDetailsFold{margin-top:10px;border-radius:18px}
        #uxMasterDetailsFold>summary{min-height:54px;padding:0 16px;font-size:14px}
        #uxMasterDetailsFold .uxFoldBody{padding:0 10px 10px}
      }
    `;
    document.head.appendChild(s);
  }

  function install(){
    css();
    const panel=document.getElementById('localMasterPanel');
    const dash=document.getElementById('uxMasterDashboard');
    const actions=document.getElementById('uxMasterActions');
    if(!panel||!dash||!actions)return false;
    if(document.getElementById('uxMasterDetailsFold'))return true;

    const details=document.createElement('details');
    details.id='uxMasterDetailsFold';
    details.open=localStorage.getItem(KEY)==='1';
    details.innerHTML='<summary><span>DETTAGLI MASTER</span><span class="uxFoldChevron" aria-hidden="true">⌄</span></summary><div class="uxFoldBody"></div>';
    const body=details.querySelector('.uxFoldBody');
    panel.insertBefore(details,dash);
    body.appendChild(dash);
    body.appendChild(actions);
    details.addEventListener('toggle',()=>localStorage.setItem(KEY,details.open?'1':'0'));
    return true;
  }

  if(!install()){
    const ob=new MutationObserver(()=>{if(install())ob.disconnect()});
    ob.observe(document.body,{childList:true,subtree:true});
  }
  window.WarehouseMasterCollapse={install};
})();
