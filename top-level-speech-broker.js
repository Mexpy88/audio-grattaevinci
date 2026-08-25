/* Top-level speech broker for REMOTO.
   SpeechRecognition runs in the main document, not inside the warehouse iframe.
   The iframe only sends a start request and receives the transcript. */
(function installWarehouseSpeechBroker(){
  'use strict';
  if(window.WarehouseSpeechBroker)return;

  const VERSION='2026.08.24-top-speech1';
  let recognition=null;
  let listening=false;

  const frame=()=>document.getElementById('warehouseApp');
  const childWindow=()=>frame()?.contentWindow||null;
  const childDocument=()=>frame()?.contentDocument||null;
  const now=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();

  function notify(message,type=''){
    const d=childDocument();
    if(d)d.querySelectorAll('.voiceStatus').forEach(el=>{el.textContent=message;el.className=`voiceStatus ${type}`});
    try{const w=childWindow();if(w?.warehouseToast&&!/ascolto|microfono/i.test(message))w.warehouseToast(message,type==='error'?'error':type==='warn'?'warn':'success')}catch{}
  }
  function setListening(on){
    listening=!!on;
    const d=childDocument();if(!d)return;
    d.querySelectorAll('.voiceBtn,#voiceSpeakMore,#voiceDirectSpeakMore').forEach(btn=>{
      if(on){
        if(!btn.dataset.topVoiceOld)btn.dataset.topVoiceOld=btn.innerHTML;
        btn.dataset.noTapSound='1';btn.classList.add('listening');btn.disabled=true;
        btn.innerHTML='<span class="voiceMicPulse">●</span> ASCOLTO…';
      }else{
        btn.classList.remove('listening');btn.disabled=false;
        if(btn.dataset.topVoiceOld){btn.innerHTML=btn.dataset.topVoiceOld;delete btn.dataset.topVoiceOld}
      }
    });
  }
  function speechCtor(){return window.SpeechRecognition||window.webkitSpeechRecognition||null}
  function openFallback(hint,message){
    setListening(false);
    try{childWindow()?.WarehouseVoiceTopClient?.openFallback?.(hint,message)}catch{}
  }
  function hardError(code,hint){
    const c=String(code||'sconosciuto');
    if(c==='not-allowed'||c==='service-not-allowed'){notify('Microfono non autorizzato. Consenti il microfono per questo sito.','error');return}
    if(c==='no-speech'){notify('Non ho sentito una frase. Tocca PARLA e riprova.','warn');return}
    if(c==='language-not-supported'){notify('Il riconoscimento vocale italiano non è disponibile in questo browser.','error');return}
    if(c==='network'){openFallback(hint,'Il servizio vocale del browser non è raggiungibile. Puoi usare la dettatura della tastiera.');return}
    if(c==='audio-capture'){openFallback(hint,'Il browser non riesce ad acquisire il microfono. Puoi usare la dettatura della tastiera.');return}
    if(c==='aborted'){openFallback(hint,'Il motore vocale del browser ha interrotto l’ascolto. Puoi usare la dettatura della tastiera.');return}
    openFallback(hint,`Riconoscimento vocale non riuscito (${c}). Puoi usare la dettatura della tastiera.`);
  }

  function start(hint='AUTO',retry=0){
    if(recognition||listening)return false;
    const C=speechCtor();
    if(!C){openFallback(hint,'Questo browser non espone il riconoscimento vocale. Puoi usare la dettatura della tastiera.');return false}
    const startedAt=now();let gotResult=false,errorCode='',retryAfterEnd=false;
    try{
      const rec=new C();recognition=rec;
      rec.lang='it-IT';rec.continuous=false;rec.interimResults=false;rec.maxAlternatives=1;
      rec.onstart=()=>{setListening(true);notify('Ascolto… puoi parlare adesso.','')};
      rec.onaudiostart=()=>notify('Microfono attivo · sto ascoltando…','');
      rec.onresult=e=>{
        gotResult=true;
        const transcript=String(e.results?.[0]?.[0]?.transcript||'').trim();
        if(!transcript){notify('Non ho ricevuto alcun comando.','warn');return}
        notify(`Ho capito: “${transcript}”`,'good');
        const w=childWindow();
        if(!w?.WarehouseVoiceCommands?.executeTranscript){notify('Modulo vocale non disponibile. Ricarica la pagina.','error');return}
        w.WarehouseVoiceCommands.executeTranscript(transcript,hint);
      };
      rec.onerror=e=>{
        errorCode=String(e?.error||'sconosciuto');
        const elapsed=now()-startedAt;
        if(errorCode==='aborted'&&retry===0&&!gotResult&&elapsed<1800){retryAfterEnd=true;notify('Riattivo l’ascolto…','');return}
        hardError(errorCode,hint);
      };
      rec.onend=()=>{
        if(recognition===rec)recognition=null;
        setListening(false);
        if(retryAfterEnd){setTimeout(()=>start(hint,1),220);return}
        if(!gotResult&&!errorCode)notify('Non ho sentito una frase. Tocca PARLA e riprova.','warn');
      };
      rec.start();return true;
    }catch(e){
      if(recognition)recognition=null;setListening(false);
      openFallback(hint,'Non riesco ad avviare il motore vocale del browser. Puoi usare la dettatura della tastiera.');return false;
    }
  }
  function stop(){try{recognition?.stop?.()}catch{}recognition=null;setListening(false)}

  window.WarehouseSpeechBroker={version:VERSION,start,stop,notify,setListening};
})();
