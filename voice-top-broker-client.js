/* REMOTO voice client.
   Voice buttons inside the iframe delegate recognition to the top-level page.
   Includes a native-keyboard dictation fallback when browser speech fails. */
(function installWarehouseVoiceTopClient(){
  'use strict';
  if(window.WarehouseVoiceTopClient)return;

  const VERSION='2026.08.24-top-client1';
  let installed=false;
  let fallbackHint='AUTO';

  const $id=id=>typeof document!=='undefined'?document.getElementById(id):null;
  function notify(message,type=''){
    if(typeof document!=='undefined')document.querySelectorAll('.voiceStatus').forEach(el=>{el.textContent=message;el.className=`voiceStatus ${type}`});
    try{if(typeof warehouseToast==='function'&&!/ascolto|microfono/i.test(message))warehouseToast(message,type==='error'?'error':type==='warn'?'warn':'success')}catch{}
  }
  function voiceControl(target){return target?.closest?.('.voiceBtn,#voiceSpeakMore,#voiceDirectSpeakMore')||null}
  function hintFor(control){
    if(control?.id==='voiceSpeakMore'||control?.id==='voiceDirectSpeakMore'||control?.closest?.('#voiceModifyBlock'))return 'MODIFICA';
    if(control?.closest?.('#voiceSearchBlock'))return 'CERCA';
    if(control?.closest?.('#voiceOperationBlock')){try{return window.WarehouseVoiceCommands?.currentHint?.()||'AUTO'}catch{return 'AUTO'}}
    try{return window.WarehouseVoiceCommands?.currentHint?.()||'AUTO'}catch{return 'AUTO'}
  }
  function validateContext(hint){
    if(!['CERCA','CARICA','SCARICA','MODIFICA'].includes(hint))return 'Apri prima CERCA, CARICA, SCARICA oppure MODIFICA.';
    if((hint==='CARICA'||hint==='SCARICA')&&!$id('filaScaffale')?.value.trim())return 'Prima inserisci Fila/Scaffale. Bancale/Carrello può rimanere vuoto.';
    if(hint==='MODIFICA'&&!$id('stockEditLocation')?.value.trim())return 'Prima inserisci Fila/Scaffale da rettificare. Bancale/Carrello può rimanere vuoto.';
    return '';
  }
  function ensureFallback(){
    let dlg=$id('voiceFallbackDialog');if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='voiceFallbackDialog';
    dlg.innerHTML=`<div class="dialogHead"><h2>Dettatura alternativa</h2><button type="button" id="voiceFallbackClose">×</button></div><p id="voiceFallbackMessage">Il motore vocale del browser non è disponibile.</p><p>Puoi toccare il campo qui sotto e usare il <b>microfono della tastiera</b>, oppure scrivere il comando. Poi premi ELABORA.</p><textarea id="voiceFallbackText" class="field" style="min-height:150px" placeholder="Detta o scrivi qui…"></textarea><button type="button" id="voiceFallbackRun" class="btn success">ELABORA</button>`;
    document.body.appendChild(dlg);
    $id('voiceFallbackClose').addEventListener('click',()=>dlg.close());
    $id('voiceFallbackRun').addEventListener('click',()=>{
      const text=$id('voiceFallbackText').value.trim();if(!text){notify('Detta o scrivi prima un comando.','warn');return}
      dlg.close();window.WarehouseVoiceCommands?.executeTranscript?.(text,fallbackHint);
    });
    return dlg;
  }
  function openFallback(hint='AUTO',message='Il riconoscimento vocale del browser si è interrotto.'){
    fallbackHint=hint;const dlg=ensureFallback();$id('voiceFallbackMessage').textContent=message;$id('voiceFallbackText').value='';
    try{dlg.showModal()}catch{dlg.setAttribute('open','')}
    setTimeout(()=>$id('voiceFallbackText')?.focus(),80);
  }
  function markVoiceControls(){if(typeof document!=='undefined')document.querySelectorAll('.voiceBtn,#voiceSpeakMore,#voiceDirectSpeakMore').forEach(el=>el.dataset.noTapSound='1')}
  function onVoiceClick(e){
    const control=voiceControl(e.target);if(!control)return;
    e.preventDefault?.();e.stopImmediatePropagation?.();e.stopPropagation?.();control.dataset.noTapSound='1';
    const hint=hintFor(control),problem=validateContext(hint);if(problem){notify(problem,'error');return}
    try{
      if(window.parent&&window.parent!==window&&window.parent.WarehouseSpeechBroker?.start){window.parent.WarehouseSpeechBroker.start(hint);return}
    }catch{}
    openFallback(hint,'Il riconoscimento vocale principale non è disponibile. Usa la dettatura della tastiera.');
  }
  function install(){
    if(installed||typeof document==='undefined')return !!installed;installed=true;markVoiceControls();document.addEventListener('click',onVoiceClick,true);return true;
  }

  window.WarehouseVoiceTopClient={version:VERSION,notify,hintFor,validateContext,openFallback,markVoiceControls,install};
  install();
})();
