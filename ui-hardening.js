/* Robustezza UI: rende affidabili le azioni critiche e segnala subito eventuali handler mancanti. */
(function installWarehouseUiHardening(){
  'use strict';
  const IGNORE_CALLEES=new Set(['if','for','while','switch','return','Math','JSON','String','Number','Date','Array','Object','Promise','console','setTimeout','setInterval']);
  let lastReport={ok:true,checked:0,missing:[]};

  function toast(message,type='error'){
    if(typeof window.warehouseToast==='function')window.warehouseToast(message,type);
    else console[type==='error'?'error':'log']('[UI]',message);
  }
  function handlerNames(code){
    const out=[];const re=/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;let m;
    while((m=re.exec(String(code||'')))){const n=m[2];if(!IGNORE_CALLEES.has(n)&&!out.includes(n))out.push(n)}
    return out;
  }
  function globalFunctionExists(name){
    try{return typeof window[name]==='function'||Function(`return typeof ${name}==='function'`)()}catch{return false}
  }
  function auditButtons(root=document){
    const missing=[];let checked=0;
    root.querySelectorAll?.('button').forEach(btn=>{
      if(!btn.hasAttribute('type'))btn.type='button';
      const code=btn.getAttribute('onclick');if(!code)return;checked++;
      for(const name of handlerNames(code))if(!globalFunctionExists(name))missing.push({button:(btn.id||btn.textContent||'').trim().slice(0,80),handler:name,code});
    });
    lastReport={ok:missing.length===0,checked,missing};
    document.documentElement.dataset.uiHealth=lastReport.ok?'ok':'error';
    if(missing.length){console.error('Handler UI mancanti',missing);toast(`Errore interfaccia: ${missing.length} azioni non sono disponibili. Ricarica la pagina.`,'error')}
    return lastReport;
  }

  function hardenMasterConfirm(){
    const dlg=document.getElementById('masterDialog');
    const btn=dlg?.querySelector('.btn.success');
    if(!btn||btn.dataset.hardImportBound==='1')return false;
    const legacyImport=window.importMappedMaster;
    if(typeof legacyImport!=='function'){
      console.error('importMappedMaster non disponibile durante il binding robusto');
      return false;
    }
    btn.dataset.hardImportBound='1';
    btn.removeAttribute('onclick');
    btn.onclick=null;

    const execute=async function(event){
      if(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
      if(btn.dataset.running==='1')return;
      btn.dataset.running='1';
      const oldText=btn.textContent||'CONFERMA IMPORTAZIONE';
      const info=document.getElementById('masterPreviewInfo');
      let before='';
      try{before=typeof db!=='undefined'?(db.master?.imported_at||''):''}catch{}
      btn.disabled=true;btn.textContent='⏳ IMPORTAZIONE IN CORSO…';
      const cancel=dlg.querySelector('.lmMasterCancel');const close=dlg.querySelector('.dialogHead button');
      if(cancel)cancel.disabled=true;if(close)close.disabled=true;
      if(info){info.className='status warn';info.textContent='Importazione del master in corso. Non chiudere questa schermata…'}
      try{
        if(typeof window.WarehouseUX?.beforeMasterImport==='function'){
          const allowed=await window.WarehouseUX.beforeMasterImport();
          if(allowed===false){if(info){info.className='status';info.textContent='Importazione annullata. Il master attuale non è stato modificato.'}return}
        }
        const result=legacyImport.call(window);
        if(result&&typeof result.then==='function')await result;
        let changed=false;
        for(let i=0;i<40;i++){
          try{changed=typeof db!=='undefined'&&!!db.master?.imported_at&&db.master.imported_at!==before&&Array.isArray(db.master?.rows)&&db.master.rows.length>0}catch{}
          if(changed||!dlg.open)break;
          await new Promise(r=>setTimeout(r,50));
        }
        try{changed=typeof db!=='undefined'&&!!db.master?.imported_at&&db.master.imported_at!==before&&Array.isArray(db.master?.rows)&&db.master.rows.length>0}catch{}
        if(!changed&&dlg.open)throw new Error('Il comando di importazione è stato eseguito, ma il master non è stato salvato.');
      }catch(err){
        console.error('Importazione master - errore intercettato',err);
        const msg=String(err?.message||err||'Errore sconosciuto');
        if(info){info.className='status error';info.textContent='Importazione non riuscita: '+msg}
        toast('Importazione master non riuscita.','error');
        try{alert('Importazione non riuscita:\n\n'+msg)}catch{}
      }finally{
        btn.disabled=false;btn.textContent=oldText;delete btn.dataset.running;
        if(cancel)cancel.disabled=false;if(close)close.disabled=false;
      }
    };
    btn.addEventListener('click',execute,true);
    window.importMappedMaster=execute;
    return true;
  }

  function installErrorBoundary(){
    if(window.__warehouseErrorBoundary)return;window.__warehouseErrorBoundary=true;
    window.addEventListener('error',e=>{if(!e?.error&&!e?.message)return;console.error('Errore UI non gestito',e.error||e.message)});
    window.addEventListener('unhandledrejection',e=>{console.error('Promise UI non gestita',e.reason)});
  }

  function install(){
    installErrorBoundary();
    hardenMasterConfirm();
    auditButtons(document);
    if(!window.__warehouseUiObserver){
      window.__warehouseUiObserver=new MutationObserver(records=>{
        let needs=false;for(const r of records)if(r.addedNodes?.length){needs=true;break}
        if(needs){hardenMasterConfirm();auditButtons(document)}
      });
      window.__warehouseUiObserver.observe(document.body,{childList:true,subtree:true});
    }
  }
  window.WarehouseUIHealth={run:()=>auditButtons(document),getReport:()=>lastReport,hardenMasterConfirm};
  install();
})();
