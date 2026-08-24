/* Clean operational forms + manual default state.
   Removes field helper text/placeholders from the UI and makes manually created stock rows start as NUOVO.
   No stock, navigation, touch or export semantics are changed. */
(function installWarehouseCleanFormsDefaultNew(){
  'use strict';
  if(window.WarehouseCleanFormsDefaultNew)return;

  const VERSION='2026.08.24-clean-forms-new1';
  const byId=id=>document.getElementById(id);

  function ensureStyle(){
    let s=byId('warehouseCleanFormsStyle');
    if(s)return s;
    s=document.createElement('style');
    s.id='warehouseCleanFormsStyle';
    s.textContent=`
      input.field::placeholder,textarea.field::placeholder,input.notes::placeholder,textarea.notes::placeholder{color:transparent!important;opacity:0!important}
      label .uxOptionalNote,label .msv4PosHelp{display:none!important}
    `;
    document.head.appendChild(s);
    return s;
  }

  function setDirectLabel(inputId,labelText){
    const input=byId(inputId);if(!input)return;
    const label=input.closest?.('label');if(!label)return;
    let done=false;
    for(const n of label.childNodes||[]){
      if(n.nodeType===3&&String(n.textContent||'').trim()){
        n.textContent=labelText+' ';done=true;break;
      }
    }
    if(!done&&label.prepend)label.prepend(document.createTextNode(labelText+' '));
  }

  function cleanFields(root=document){
    ensureStyle();
    root?.querySelectorAll?.('input[placeholder],textarea[placeholder]').forEach(el=>el.removeAttribute('placeholder'));
    root?.querySelectorAll?.('label .uxOptionalNote,label .msv4PosHelp').forEach(el=>el.remove());
    setDirectLabel('filaScaffale','Fila/Scaffale');
    setDirectLabel('bancale','Bancale / Carrello');
    setDirectLabel('stockEditLocation','Fila/Scaffale');
    setDirectLabel('stockEditPallet','Bancale / Carrello');
  }

  function scheduleClean(){
    cleanFields();
    setTimeout(cleanFields,0);
    setTimeout(cleanFields,80);
  }

  function wrapForCleanup(name){
    const base=window[name];if(typeof base!=='function'||base.__warehouseCleanFormsWrapped)return;
    const wrapped=function(){const out=base.apply(this,arguments);scheduleClean();return out};
    wrapped.__warehouseCleanFormsWrapped=true;wrapped.__warehousePrevious=base;window[name]=wrapped;
  }

  function installManualDefaults(){
    if(typeof window.startManualEntry==='function'){
      const manual=function(){
        if(!requireLogin())return;
        if(!validateLocation())return;
        importedPhotos=[{photo_index:1,general_note:'',groups:[{article_base:'',description:'',confidence:1,variants:[{size:'',quantity:0,state:'NUOVO',confidence:1,note:''}]}]}];
        renderResults();show('results');scheduleClean();
      };
      manual.__warehouseManualDefaultNew=true;window.startManualEntry=manual;
    }
    if(typeof window.addGroup==='function'){
      const addGroupNew=function(pi){
        importedPhotos[pi].groups.push({article_base:'',description:'',confidence:1,variants:[{size:'',quantity:0,state:'NUOVO',confidence:1,note:''}]});
        renderResults();scheduleClean();
      };
      addGroupNew.__warehouseManualDefaultNew=true;window.addGroup=addGroupNew;
    }
    if(typeof window.addVariant==='function'){
      const addVariantNew=function(pi,gi){
        importedPhotos[pi].groups[gi].variants.push({size:'',quantity:0,state:'NUOVO',confidence:1,note:''});
        renderResults();scheduleClean();
      };
      addVariantNew.__warehouseManualDefaultNew=true;window.addVariant=addVariantNew;
    }
  }

  function install(){
    cleanFields();
    installManualDefaults();
    ['show','openOperation','openStockEdit','openSearch','openRegistry','openRequests','renderResults','renderStockEditRows','renderRequestDetail','renderExtraStockSearch'].forEach(wrapForCleanup);
    document.addEventListener?.('focusin',e=>{if(e.target?.matches?.('input[placeholder],textarea[placeholder]'))e.target.removeAttribute('placeholder')},true);
    return true;
  }

  window.WarehouseCleanFormsDefaultNew={version:VERSION,cleanFields,installManualDefaults,install};
  install();
})();
