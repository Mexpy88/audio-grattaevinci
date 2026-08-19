/* UX supplementare per il flusso Master Excel locale. */
(function(){
  'use strict';
  const DB_NAME='so_warehouse_files_v1',STORE='files',ACTIVE='active-master-xlsx',PENDING='pending-master-xlsx';
  function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  async function put(key,value){const d=await openDb();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>{d.close();resolve()};tx.onerror=()=>{const e=tx.error;d.close();reject(e)}})}
  async function get(key){const d=await openDb();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>{const v=r.result;d.close();resolve(v)};r.onerror=()=>{const e=r.error;d.close();reject(e)}})}
  async function del(key){const d=await openDb();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>{d.close();resolve()};tx.onerror=()=>{const e=tx.error;d.close();reject(e)}})}

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

  const registryInput=document.getElementById('masterInput');
  if(registryInput){
    registryInput.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f||!/\.xlsx$/i.test(f.name))return;f.arrayBuffer().then(b=>put(PENDING,b)).catch(()=>{})},true);
    const label=registryInput.closest('label');
    if(label){
      label.childNodes.forEach(n=>{if(n.nodeType===3&&/IMPORTA FILE EXCEL MASTER/i.test(n.textContent||''))n.textContent=' REIMPORTA / SOSTITUISCI MASTER '});
      label.title='Carica un file Excel .xlsx come master operativo';
    }
  }

  const imported=window.importMappedMaster;
  if(typeof imported==='function'){
    window.importMappedMaster=async function(){
      const before=db.master?.imported_at||'',nativeConfirm=window.confirm,nativeAlert=window.alert;
      window.confirm=()=>true;
      window.alert=message=>{const text=String(message||'');if(/^Master importato:/i.test(text))return;nativeAlert(message)};
      try{
        const result=await imported.apply(this,arguments);
        if(db.master?.imported_at&&db.master.imported_at!==before){const bytes=await get(PENDING).catch(()=>null);if(bytes)await put(ACTIVE,bytes);await del(PENDING).catch(()=>{})}
        return result;
      }finally{window.confirm=nativeConfirm;window.alert=nativeAlert}
    };
  }
})();
