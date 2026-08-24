/* Master import UX cleanup — keeps the stable V4 import logic intact while removing redundant confirmations. */
(function installWarehouseMasterImportUiCleanup(){
  'use strict';
  if(window.WarehouseMasterImportUiCleanup)return;

  const VERSION='2026.08.24-import-cleanup1';
  const text=v=>String(v??'');
  const nativeConfirm=typeof window.confirm==='function'?window.confirm.bind(window):()=>true;
  const nativeAlert=typeof window.alert==='function'?window.alert.bind(window):()=>{};
  const nativeToast=typeof window.warehouseToast==='function'?window.warehouseToast.bind(window):null;

  function isV4ImportConfirm(message){
    return /^Importare\s+\d+\s+giacenze\s+dal\s+Master\s+V4\?/i.test(text(message).trim());
  }
  function v4SuccessCount(message){
    const m=text(message).trim().match(/^Master\s+V4\s+importato:\s*(\d+)\s+giacenze\.?$/i);
    return m?Number(m[1]):0;
  }
  function isGenericV4SuccessToast(message){
    const s=text(message).trim();
    return /^Master V4 importato con storico ripristinato\.?$/i.test(s)||/^Master V4 importato:\s*nuovo ciclo di lavoro\.?$/i.test(s);
  }
  function showSuccess(count){
    const msg=`✓ MASTER IMPORTATO · ${Number(count)||0} GIACENZE`;
    if(typeof window.warehouseToast==='function')window.warehouseToast(msg,'success');
    else console.log(msg);
  }
  function masterIsLoaded(){
    try{return typeof db!=='undefined'&&Array.isArray(db?.master?.rows)&&db.master.rows.length>0}catch{return false}
  }
  function injectStyle(){
    if(typeof document==='undefined'||document.getElementById('masterImportCleanupStyle'))return;
    const style=document.createElement('style');
    style.id='masterImportCleanupStyle';
    style.textContent='body.lmNoMaster #lmSub{display:none!important}';
    document.head.appendChild(style);
  }
  function cleanImportDialog(){
    if(typeof document==='undefined')return;
    const dlg=document.getElementById('masterDialog');
    const info=document.getElementById('masterPreviewInfo');
    if(info&&/MASTER\s+V4\s+riconosciuto/i.test(info.textContent||'')){
      const m=text(info.textContent).match(/(\d+)\s+righe\s+Excel/i);
      info.className='status good';
      info.textContent=`MASTER V4 RICONOSCIUTO${m?` · ${m[1]} RIGHE EXCEL`:''}`;
    }
    if(dlg){
      const warning=[...dlg.querySelectorAll('.status.warn')].find(el=>/L['’]importazione\s+sostituisce\s+la\s+giacenza\s+master\s+attuale/i.test(text(el.textContent)));
      if(warning){
        const replacing=masterIsLoaded();
        warning.classList.toggle('hidden',!replacing);
        if(replacing)warning.textContent='ATTENZIONE: IL MASTER ATTUALMENTE CARICATO VERRÀ SOSTITUITO.';
      }
    }
  }
  function installPromptFilters(){
    if(window.__warehouseMasterImportPromptCleanup)return;
    window.__warehouseMasterImportPromptCleanup=true;
    window.confirm=function(message){
      if(isV4ImportConfirm(message))return true;
      return nativeConfirm(message);
    };
    window.alert=function(message){
      const count=v4SuccessCount(message);
      if(count){showSuccess(count);return}
      return nativeAlert(message);
    };
    if(nativeToast){
      window.warehouseToast=function(message,type){
        if(isGenericV4SuccessToast(message))return;
        return nativeToast(message,type);
      };
    }
  }
  function wrapPrepare(){
    const base=window.prepareMasterSheet;
    if(typeof base!=='function'||base.__masterImportCleanupWrapped)return;
    const wrapped=function(){const result=base.apply(this,arguments);cleanImportDialog();return result};
    wrapped.__masterImportCleanupWrapped=true;
    window.prepareMasterSheet=wrapped;
  }
  function install(){injectStyle();installPromptFilters();wrapPrepare();cleanImportDialog();return true}

  window.WarehouseMasterImportUiCleanup={version:VERSION,isV4ImportConfirm,v4SuccessCount,isGenericV4SuccessToast,cleanImportDialog,install};
  install();
})();
