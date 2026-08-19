/* UX supplementare per il flusso Master Excel locale. */
(function(){
  'use strict';
  const dlg=document.getElementById('masterDialog');
  if(dlg){
    const close=dlg.querySelector('.dialogHead button');
    if(close){close.setAttribute('aria-label','Chiudi importazione');close.title='Chiudi'}
    const confirmBtn=dlg.querySelector('.btn.success');
    if(confirmBtn&&!dlg.querySelector('.lmMasterCancel')){
      const cancel=document.createElement('button');
      cancel.type='button';cancel.className='btn soft lmMasterCancel';cancel.textContent='ANNULLA';cancel.onclick=()=>dlg.close();
      confirmBtn.insertAdjacentElement('beforebegin',cancel);
    }
  }

  const imported=window.importMappedMaster;
  if(typeof imported==='function'){
    window.importMappedMaster=async function(){
      const nativeConfirm=window.confirm,nativeAlert=window.alert;
      window.confirm=()=>true;
      window.alert=message=>{
        const text=String(message||'');
        if(/^Master importato:/i.test(text))return;
        nativeAlert(message);
      };
      try{return await imported.apply(this,arguments)}
      finally{window.confirm=nativeConfirm;window.alert=nativeAlert}
    };
  }

  const registryInput=document.getElementById('masterInput');
  if(registryInput){
    const label=registryInput.closest('label');
    if(label){
      label.childNodes.forEach(n=>{if(n.nodeType===3&&/IMPORTA FILE EXCEL MASTER/i.test(n.textContent||''))n.textContent=' REIMPORTA / SOSTITUISCI MASTER '});
      label.title='Carica un file Excel .xlsx come master operativo';
    }
  }
})();
