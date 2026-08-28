/* Master UX compatibility shim.
   REFRACTOR 2026-08-28: non avvolge più importMappedMaster, audit, alert o confirm.
   Mantiene solo piccoli dettagli visuali richiesti dal dialog storico. */
(function installWarehouseLocalMasterUxCompat(){
  'use strict';
  if(window.WarehouseLocalMasterUxCompat)return;
  const VERSION='2026.08.28-local-master-ux-compat1';

  function decorate(){
    const dlg=document.getElementById('masterDialog');
    if(dlg){
      const close=dlg.querySelector('.dialogHead button');
      if(close){close.setAttribute('aria-label','Chiudi importazione');close.title='Chiudi'}
      const confirm=dlg.querySelector('.btn.success');
      if(confirm){
        confirm.type='button';
        if(!dlg.querySelector('.lmMasterCancel')){
          const cancel=document.createElement('button');
          cancel.type='button';cancel.className='btn soft lmMasterCancel';cancel.textContent='ANNULLA';
          cancel.onclick=()=>{if(!confirm.disabled)dlg.close()};
          confirm.insertAdjacentElement('beforebegin',cancel);
        }
      }
    }
    const input=document.getElementById('masterInput');
    const label=input?.closest('label');
    if(label)label.title='Carica un file Excel .xlsx come Master operativo';
    return true;
  }

  function install(){decorate();return true}
  window.WarehouseLocalMasterUxCompat={version:VERSION,install,decorate};
  install();
})();
