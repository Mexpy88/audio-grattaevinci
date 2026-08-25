/* REMOTO dictation client.
   Voice controls delegate to a top-level text editor outside the iframe so Android
   keyboards can provide voice typing reliably. */
(function installWarehouseVoiceTopClient(){
  'use strict';
  if(window.WarehouseVoiceTopClient)return;

  const VERSION='2026.08.25-top-editor1';
  let installed=false;
  const $id=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const norm=v=>String(v??'').trim().toUpperCase();

  function notify(message,type=''){
    if(typeof document!=='undefined')document.querySelectorAll('.voiceStatus').forEach(el=>{el.textContent=message;el.className=`voiceStatus ${type}`});
    try{if(typeof warehouseToast==='function'&&!/dettatura|tastiera/i.test(message))warehouseToast(message,type==='error'?'error':type==='warn'?'warn':'success')}catch{}
  }
  function voiceControl(target){return target?.closest?.('.voiceBtn,#voiceSpeakMore,#voiceDirectSpeakMore,#voiceFlexSpeakMore')||null}
  function hintFor(control){
    if(control?.id==='voiceSpeakMore'||control?.id==='voiceDirectSpeakMore'||control?.id==='voiceFlexSpeakMore'||control?.closest?.('#voiceModifyBlock'))return 'MODIFICA';
    if(control?.closest?.('#voiceSearchBlock'))return 'CERCA';
    if(control?.closest?.('#voiceOperationBlock')){try{return window.WarehouseVoiceCommands?.currentHint?.()||'AUTO'}catch{return 'AUTO'}}
    try{return window.WarehouseVoiceCommands?.currentHint?.()||'AUTO'}catch{return 'AUTO'}
  }
  function positionValues(hint){
    if(hint==='MODIFICA')return {location:norm($id('stockEditLocation')?.value),pallet:norm($id('stockEditPallet')?.value)};
    if(hint==='CARICA'||hint==='SCARICA')return {location:norm($id('filaScaffale')?.value),pallet:norm($id('bancale')?.value)};
    return {location:'',pallet:''};
  }
  function validateContext(hint){
    if(!['CERCA','CARICA','SCARICA','MODIFICA'].includes(hint))return 'Apri prima CERCA, CARICA, SCARICA oppure MODIFICA.';
    if(hint==='CARICA'||hint==='SCARICA'||hint==='MODIFICA'){
      const p=positionValues(hint);if(!p.location&&!p.pallet)return 'Inserisci Fila/Scaffale oppure Bancale/Carrello.';
    }
    return '';
  }
  function modeTitle(hint){return hint==='MODIFICA'?'Detta rettifiche':hint==='CARICA'?'Detta articoli da caricare':hint==='SCARICA'?'Detta articoli da scaricare':'Cerca con la voce'}
  function modeExample(hint){
    if(hint==='MODIFICA')return 'elimina articolo I 3 0 8 7 1 N E R U H F taglia S pezzi 30 scaricato';
    if(hint==='CARICA')return 'articolo I 3 0 8 7 2 M U H F taglia L pezzi 50 nuovo';
    if(hint==='SCARICA')return 'articolo I 3 0 8 7 2 M U H F taglia L pezzi 20 nuovo';
    return 'articolo I 3 0 8 7 2 M U H F taglia L';
  }
  function contextItems(hint){
    const p=positionValues(hint),out=[];
    if(p.location)out.push(`Fila/Scaffale ${p.location}`);
    if(p.pallet)out.push(`Bancale/Carrello ${p.pallet}`);
    if(!out.length&&hint==='CERCA')out.push('Ricerca giacenze');
    return out;
  }
  function openCapture(hint='AUTO'){
    const problem=validateContext(hint);if(problem){notify(problem,'error');return false}
    try{
      const top=window.parent&&window.parent!==window?window.parent:null;
      if(top?.WarehouseTopLevelDictation?.open){
        return top.WarehouseTopLevelDictation.open(hint,{mode:hint,title:modeTitle(hint),example:modeExample(hint),context:contextItems(hint)});
      }
    }catch{}
    notify('Riquadro di dettatura non disponibile. Ricarica la pagina.','error');return false;
  }
  function openFallback(hint='AUTO'){return openCapture(hint)}
  function markVoiceControls(){if(typeof document!=='undefined')document.querySelectorAll('.voiceBtn,#voiceSpeakMore,#voiceDirectSpeakMore,#voiceFlexSpeakMore').forEach(el=>el.dataset.noTapSound='1')}
  function onVoiceClick(e){
    const control=voiceControl(e.target);if(!control)return;
    e.preventDefault?.();e.stopImmediatePropagation?.();e.stopPropagation?.();control.dataset.noTapSound='1';openCapture(hintFor(control));
  }
  function install(){if(installed||typeof document==='undefined')return !!installed;installed=true;markVoiceControls();document.addEventListener('click',onVoiceClick,true);return true}

  window.WarehouseVoiceTopClient={version:VERSION,notify,hintFor,positionValues,validateContext,openCapture,openFallback,markVoiceControls,install};
  install();
})();
