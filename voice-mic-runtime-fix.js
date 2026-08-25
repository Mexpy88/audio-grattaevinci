/* Android/Chromium microphone handoff fix for contextual warehouse voice entry.
   Intercepts only voice-button clicks. SpeechRecognition owns the microphone directly:
   no separate capture preflight, no competing audio playback, one guarded retry on an
   immediate Chromium 'aborted' startup race. */
(function installWarehouseVoiceMicRuntimeFix(){
  'use strict';
  if(window.WarehouseVoiceMicRuntimeFix)return;

  const VERSION='2026.08.24-micfix1';
  let recognition=null;
  let listening=false;
  let installed=false;

  const $id=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const now=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();

  function api(){return window.WarehouseVoiceCommands||null}
  function notify(message,type='good'){
    if(typeof document!=='undefined')document.querySelectorAll('.voiceStatus').forEach(el=>{el.textContent=message;el.className=`voiceStatus ${type}`});
    try{if(typeof warehouseToast==='function'&&!/ascolto|microfono/i.test(message))warehouseToast(message,type==='error'?'error':type==='warn'?'warn':'success')}catch{}
  }
  function setListening(on){
    listening=!!on;if(typeof document==='undefined')return;
    document.querySelectorAll('.voiceBtn,#voiceSpeakMore').forEach(btn=>{
      if(on){
        if(!btn.dataset.voiceMicOld)btn.dataset.voiceMicOld=btn.innerHTML;
        btn.classList.add('listening');btn.disabled=true;
        btn.innerHTML='<span class="voiceMicPulse">●</span> ASCOLTO…';
      }else{
        btn.classList.remove('listening');btn.disabled=false;
        if(btn.dataset.voiceMicOld){btn.innerHTML=btn.dataset.voiceMicOld;delete btn.dataset.voiceMicOld}
      }
    });
  }
  function speechCtor(){return window.SpeechRecognition||window.webkitSpeechRecognition||null}
  function errorMessage(code){
    const c=String(code||'sconosciuto');
    if(c==='not-allowed'||c==='service-not-allowed')return 'Microfono non autorizzato. Consenti il microfono per questo sito.';
    if(c==='no-speech')return 'Non ho sentito una frase. Tocca PARLA e riprova.';
    if(c==='audio-capture')return 'Il browser non riesce ad acquisire il microfono. Controlla che non sia occupato da un’altra app.';
    if(c==='network')return 'Il microfono funziona, ma il servizio di riconoscimento vocale del browser non è raggiungibile.';
    if(c==='aborted')return 'Il browser ha interrotto l’ascolto. Tocca PARLA e riprova.';
    if(c==='language-not-supported')return 'Il riconoscimento vocale italiano non è disponibile in questo browser.';
    return `Riconoscimento vocale non riuscito (${c}).`;
  }
  function hintFor(control){
    if(control?.id==='voiceSpeakMore'||control?.closest?.('#voiceModifyBlock'))return 'MODIFICA';
    if(control?.closest?.('#voiceSearchBlock'))return 'CERCA';
    if(control?.closest?.('#voiceOperationBlock')){
      try{return api()?.currentHint?.()||'AUTO'}catch{return 'AUTO'}
    }
    try{return api()?.currentHint?.()||'AUTO'}catch{return 'AUTO'}
  }
  function validateContext(hint){
    if(!['CERCA','CARICA','SCARICA','MODIFICA'].includes(hint))return 'Apri prima CERCA, CARICA, SCARICA oppure MODIFICA.';
    if((hint==='CARICA'||hint==='SCARICA')&&(!$id('filaScaffale')?.value.trim()||!$id('bancale')?.value.trim()))return 'Prima inserisci Fila/Scaffale e Bancale, poi premi PARLA.';
    if(hint==='MODIFICA'&&(!$id('stockEditLocation')?.value.trim()||!$id('stockEditPallet')?.value.trim()))return 'Prima inserisci Fila/Scaffale e Bancale da rettificare, poi premi PARLA.';
    if(typeof window!=='undefined'&&window.isSecureContext===false)return 'Il comando vocale richiede una connessione HTTPS sicura.';
    return '';
  }
  function start(hint,retry=0){
    if(listening)return false;
    const voice=api();if(!voice?.executeTranscript){notify('Modulo vocale non disponibile. Ricarica la pagina.','error');return false}
    const problem=validateContext(hint);if(problem){notify(problem,'error');return false}
    const C=speechCtor();if(!C){notify('Il riconoscimento vocale non è supportato da questo browser.','error');return false}

    let rec=null,gotResult=false,errorCode='',retryAfterEnd=false;
    const startedAt=now();
    try{
      rec=new C();recognition=rec;
      rec.lang='it-IT';rec.continuous=false;rec.interimResults=false;rec.maxAlternatives=1;
      rec.onstart=()=>{setListening(true);notify('Ascolto… puoi parlare adesso.','')};
      rec.onaudiostart=()=>notify('Microfono attivo · sto ascoltando…','');
      rec.onresult=e=>{
        gotResult=true;
        const transcript=String(e.results?.[0]?.[0]?.transcript||'').trim();
        if(!transcript){notify('Non ho ricevuto alcun comando.','warn');return}
        notify(`Ho capito: “${transcript}”`,'good');
        voice.executeTranscript(transcript,hint);
      };
      rec.onerror=e=>{
        errorCode=String(e?.error||'sconosciuto');
        const elapsed=now()-startedAt;
        if(errorCode==='aborted'&&retry===0&&!gotResult&&elapsed<1800){retryAfterEnd=true;notify('Riattivo l’ascolto…','');return}
        notify(errorMessage(errorCode),'error');
      };
      rec.onend=()=>{
        if(recognition===rec)recognition=null;
        setListening(false);
        if(retryAfterEnd){setTimeout(()=>start(hint,1),280);return}
        if(!gotResult&&!errorCode)notify('Non ho sentito una frase. Tocca PARLA e riprova.','warn');
      };
      /* IMPORTANT: start speech recognition synchronously from the user click.
         Do not open and close a separate capture stream first; Chromium/Android
         can abort speech recognition during that handoff. */
      rec.start();return true;
    }catch(e){
      if(recognition===rec)recognition=null;setListening(false);
      notify('Impossibile avviare il riconoscimento vocale: '+(e?.message||e),'error');return false;
    }
  }
  function stop(){try{recognition?.stop?.()}catch{}recognition=null;setListening(false)}
  function voiceControl(target){return target?.closest?.('.voiceBtn,#voiceSpeakMore')||null}
  function onVoiceClick(e){
    const control=voiceControl(e.target);if(!control)return;
    e.preventDefault?.();e.stopImmediatePropagation?.();e.stopPropagation?.();
    control.dataset.noTapSound='1';
    start(hintFor(control),0);
  }
  function markVoiceControls(){if(typeof document!=='undefined')document.querySelectorAll('.voiceBtn,#voiceSpeakMore').forEach(el=>el.dataset.noTapSound='1')}
  function install(){
    if(installed||typeof document==='undefined')return !!installed;installed=true;
    markVoiceControls();
    document.addEventListener('click',onVoiceClick,true);
    return true;
  }

  window.WarehouseVoiceMicRuntimeFix={version:VERSION,start,stop,hintFor,validateContext,markVoiceControls,install};
  install();
})();
