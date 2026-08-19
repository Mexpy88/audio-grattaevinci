/* UX supplementare per il flusso Master Excel locale. */
(function(){
  'use strict';
  const DB_NAME='so_warehouse_files_v1',STORE='files',ACTIVE='active-master-xlsx',PENDING='pending-master-xlsx';
  let importRunning=false;

  function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  async function put(key,value){const d=await openDb();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>{d.close();resolve()};tx.onerror=()=>{const e=tx.error;d.close();reject(e)}})}
  async function get(key){const d=await openDb();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>{const v=r.result;d.close();resolve(v)};r.onerror=()=>{const e=r.error;d.close();reject(e)}})}
  async function del(key){const d=await openDb();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>{d.close();resolve()};tx.onerror=()=>{const e=tx.error;d.close();reject(e)}})}
  function toast(message,type='success'){if(typeof warehouseToast==='function')warehouseToast(message,type)}
  function compactMaster(x){return {filename:x?.filename||'',sheet:x?.sheet||'',imported_at:x?.imported_at||null,operator:x?.operator||'',rows_count:Array.isArray(x?.rows)?x.rows.length:0}}
  function compactOldMasterAudits(){if(!Array.isArray(db?.audits))return;db.audits=db.audits.map(a=>{if(a?.action!=='MASTER_IMPORT'||a?.entityType!=='MASTER')return a;const beforeRows=Array.isArray(a?.before?.rows)?a.before.rows.length:0,afterRows=Array.isArray(a?.after?.rows)?a.after.rows.length:0;if(!beforeRows&&!afterRows)return a;return {...a,before:compactMaster(a.before),after:compactMaster(a.after)}})}

  const dlg=document.getElementById('masterDialog');
  if(dlg){
    const close=dlg.querySelector('.dialogHead button');
    if(close){close.setAttribute('aria-label','Chiudi importazione');close.title='Chiudi'}
    const confirmBtn=dlg.querySelector('.btn.success');
    if(confirmBtn){
      confirmBtn.type='button';
      if(!dlg.querySelector('.lmMasterCancel')){
        const cancel=document.createElement('button');
        cancel.type='button';cancel.className='btn soft lmMasterCancel';cancel.textContent='ANNULLA';cancel.onclick=()=>{if(!importRunning)dlg.close()};
        confirmBtn.insertAdjacentElement('beforebegin',cancel);
      }
    }
  }

  const registryInput=document.getElementById('masterInput');
  if(registryInput){
    registryInput.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f||!/\.xlsx$/i.test(f.name))return;f.arrayBuffer().then(b=>put(PENDING,b)).catch(err=>console.warn('Copia temporanea master non salvata',err))},true);
    const label=registryInput.closest('label');
    if(label){
      label.childNodes.forEach(n=>{if(n.nodeType===3&&/IMPORTA FILE EXCEL MASTER/i.test(n.textContent||''))n.textContent=' REIMPORTA / SOSTITUISCI MASTER '});
      label.title='Carica un file Excel .xlsx come master operativo';
    }
  }

  const imported=window.importMappedMaster;
  if(typeof imported==='function'){
    window.importMappedMaster=async function(){
      if(importRunning)return;
      importRunning=true;
      const before=db.master?.imported_at||'';
      const nativeConfirm=window.confirm,nativeAlert=window.alert,nativeAudit=window.audit;
      const confirmBtn=document.querySelector('#masterDialog .btn.success');
      const cancelBtn=document.querySelector('#masterDialog .lmMasterCancel');
      const closeBtn=document.querySelector('#masterDialog .dialogHead button');
      const info=document.getElementById('masterPreviewInfo');
      const oldText=confirmBtn?.textContent||'CONFERMA IMPORTAZIONE';

      if(confirmBtn){confirmBtn.disabled=true;confirmBtn.textContent='⏳ IMPORTAZIONE IN CORSO…'}
      if(cancelBtn)cancelBtn.disabled=true;
      if(closeBtn)closeBtn.disabled=true;
      if(info){info.className='status warn';info.textContent='Importazione del master in corso. Non chiudere questa schermata…'}

      window.confirm=()=>true;
      window.alert=message=>{const text=String(message||'');if(/^Master importato:/i.test(text))return;nativeAlert(message)};

      /* Il vecchio import salvava nell'audit una copia completa del master prima e dopo
         l'importazione. Con ~10.000 righe questo può superare la quota localStorage e
         interrompere il click senza feedback. Durante MASTER_IMPORT salviamo solo un
         riepilogo compatto; lo storico operativo resta invece completo. */
      if(typeof nativeAudit==='function'){
        window.audit=function(action,entityType,entityId,beforeState,afterState){
          if(action==='MASTER_IMPORT'&&entityType==='MASTER'){
            compactOldMasterAudits();
            db.audits=db.audits||[];
            db.audits.unshift({
              id:typeof uid==='function'?uid():String(Date.now()),
              action,entityType,entityId,
              operator:typeof operatorName==='function'?operatorName():'',
              at:new Date().toISOString(),
              before:compactMaster(beforeState),
              after:compactMaster(afterState)
            });
            saveDb();
            return;
          }
          return nativeAudit.apply(this,arguments);
        };
      }

      try{
        /* Lascia al browser un frame per mostrare subito lo stato di caricamento. */
        await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,20)));
        const result=await imported.apply(this,arguments);

        if(!db.master?.imported_at||db.master.imported_at===before||!(db.master?.rows||[]).length){
          throw new Error('L’importazione non è stata completata. Riprova a selezionare il file master.');
        }

        const bytes=await get(PENDING).catch(()=>null);
        if(bytes)await put(ACTIVE,bytes);
        await del(PENDING).catch(()=>{});
        return result;
      }catch(err){
        console.error('Importazione Master Excel fallita',err);
        const msg=String(err?.message||err||'Errore sconosciuto');
        if(info){info.className='status error';info.textContent='Importazione non riuscita: '+msg}
        toast('Importazione master non riuscita.','error');
        nativeAlert('Importazione non riuscita:\n\n'+msg+'\n\nIl file non è stato confermato. Riprova.');
      }finally{
        window.confirm=nativeConfirm;
        window.alert=nativeAlert;
        if(typeof nativeAudit==='function')window.audit=nativeAudit;
        if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent=oldText}
        if(cancelBtn)cancelBtn.disabled=false;
        if(closeBtn)closeBtn.disabled=false;
        importRunning=false;
      }
    };
  }
})();
