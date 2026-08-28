/* Master import visual cleanup.
   REFRACTOR 2026-08-28: nessun override globale di confirm/alert/toast e nessun wrapper di prepareMasterSheet. */
(function installWarehouseMasterImportUiCleanup(){
  'use strict';
  if(window.WarehouseMasterImportUiCleanup?.version==='2026.08.28-import-cleanup2')return;
  const VERSION='2026.08.28-import-cleanup2';
  const text=v=>String(v??'');

  function masterIsLoaded(){try{return Array.isArray(db?.master?.rows)&&db.master.rows.length>0}catch{return false}}
  function injectStyle(){
    if(document.getElementById('masterImportCleanupStyle'))return;
    const style=document.createElement('style');style.id='masterImportCleanupStyle';
    style.textContent='body.lmNoMaster #lmSub{display:none!important}';document.head.appendChild(style);
  }
  function cleanImportDialog(){
    const dlg=document.getElementById('masterDialog'),info=document.getElementById('masterPreviewInfo');
    if(info&&/MASTER\s+V4\s+riconosciuto/i.test(info.textContent||'')){
      const m=text(info.textContent).match(/(\d+)\s+righe\s+Excel/i);info.className='status good';
      info.textContent=`MASTER V4 RICONOSCIUTO${m?` · ${m[1]} RIGHE EXCEL`:''}`;
    }
    if(dlg){
      const warning=[...dlg.querySelectorAll('.status.warn')].find(el=>/L['’]importazione\s+sostituisce|MASTER ATTUALMENTE CARICATO/i.test(text(el.textContent)));
      if(warning){const replacing=masterIsLoaded();warning.classList.toggle('hidden',!replacing);if(replacing)warning.textContent='ATTENZIONE: IL MASTER ATTUALMENTE CARICATO VERRÀ SOSTITUITO.'}
    }
    return true;
  }
  function install(){injectStyle();cleanImportDialog();return true}
  window.WarehouseMasterImportUiCleanup={version:VERSION,cleanImportDialog,install};
  install();
})();
