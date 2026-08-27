/* Robustezza UI generale.
   IMPORTANTE: il flusso Master Excel è gestito da WarehouseMasterControllerV2.
   Questo modulo non sostituisce più importMappedMaster e non aggiunge wrapper di importazione. */
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

  /* Compatibilità con i moduli storici che chiamano ancora hardenMasterConfirm().
     Da ora è intenzionalmente PASSIVO: il controller Master finale possiede l'unico
     listener di conferma e l'unico percorso di importazione. */
  function hardenMasterConfirm(){
    const btn=document.querySelector('#masterDialog .btn.success');
    if(!btn)return false;
    btn.type='button';
    btn.dataset.masterConfirmPassive='1';
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
    return true;
  }
  window.WarehouseUIHealth={run:()=>auditButtons(document),getReport:()=>lastReport,hardenMasterConfirm,install};
  install();
})();
