/* REMOTO live dictation client.
   Voice controls open a polished text-capture sheet immediately.
   The phone keyboard microphone writes into the textarea in real time; no browser
   SpeechRecognition session is started, avoiding Chromium/Android abort loops. */
(function installWarehouseVoiceTopClient(){
  'use strict';
  if(window.WarehouseVoiceTopClient)return;

  const VERSION='2026.08.24-live-text2';
  let installed=false;
  let activeHint='AUTO';

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
    if(hint==='MODIFICA')return 'Es. elimina articolo I 3 0 8 7 1 N E R U H F taglia S pezzi 30 scaricato';
    if(hint==='CARICA')return 'Es. articolo I 3 0 8 7 2 M U H F taglia L pezzi 50 nuovo';
    if(hint==='SCARICA')return 'Es. articolo I 3 0 8 7 2 M U H F taglia L pezzi 20 nuovo';
    return 'Es. articolo I 3 0 8 7 2 M U H F taglia L';
  }
  function contextText(hint){
    const p=positionValues(hint),bits=[];
    if(p.location)bits.push(`Fila/Scaffale ${p.location}`);
    if(p.pallet)bits.push(`Bancale/Carrello ${p.pallet}`);
    return bits.join(' · ');
  }
  function ensureStyle(){
    if($id('voiceLiveCaptureStyle'))return;
    const s=document.createElement('style');s.id='voiceLiveCaptureStyle';s.textContent=`
      #voiceLiveDialog{width:min(96vw,560px);max-height:min(88dvh,760px);padding:0;border:0;border-radius:28px;overflow:hidden;background:#f7fbff;color:#17314d;box-shadow:0 24px 80px #071a2d66}
      #voiceLiveDialog::backdrop{background:#071a2dcc;backdrop-filter:blur(3px)}
      .vlHead{padding:18px 20px 14px;background:linear-gradient(135deg,#245caa,#4c87ca);color:#fff;position:relative}.vlHeadTop{display:flex;align-items:center;justify-content:space-between;gap:12px}.vlMode{font-size:11px;letter-spacing:.12em;font-weight:950;opacity:.85}.vlHead h2{margin:4px 0 5px;font-size:24px}.vlHead p{margin:0;color:#eef6ff;font-size:14px}.vlClose{width:42px;height:42px;border:0;border-radius:50%;background:#ffffff20;color:#fff;font-size:25px;font-weight:700}
      .vlBody{padding:16px 18px 10px;overflow:auto}.vlContext{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px}.vlChip{background:#e2edf8;color:#245b91;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:900}.vlCoach{display:flex;gap:11px;align-items:flex-start;background:#e8f5ee;border:1px solid #c9ead9;border-radius:17px;padding:12px 13px;margin-bottom:12px}.vlCoachIcon{font-size:24px;line-height:1}.vlCoach b{display:block;color:#14633f;margin-bottom:2px}.vlCoach span{font-size:13px;color:#3f6252;line-height:1.35}
      .vlInputWrap{background:#fff;border:2px solid #b8ccdf;border-radius:20px;overflow:hidden;transition:.18s box-shadow,.18s border-color}.vlInputWrap:focus-within{border-color:#2c60aa;box-shadow:0 0 0 4px #2c60aa18}.vlText{display:block;width:100%;min-height:190px;max-height:38dvh;resize:none;border:0;outline:0;padding:16px 16px 10px;background:#fff;color:#17314d;font-size:18px;line-height:1.45;font-weight:650}.vlText::placeholder{color:#8ca0b3;font-weight:500}.vlMeta{display:flex;justify-content:space-between;gap:10px;padding:8px 13px 11px;border-top:1px solid #edf2f6;font-size:12px;color:#697d90}.vlLive{font-weight:900;color:#2c60aa}.vlExample{font-size:12px;color:#718397;line-height:1.4;margin:10px 2px 0}.vlExample b{color:#405a72}
      .vlActions{display:grid;grid-template-columns:auto auto 1fr;gap:8px;padding:12px 18px calc(12px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #dce6ef}.vlActions button{min-height:54px;border:0;border-radius:16px;font-weight:950;font-size:15px;padding:0 15px}.vlClear{background:#e8eef4;color:#40556a}.vlCancel{background:#f3e9e8;color:#8d3b36}.vlRun{background:#00a45b;color:#fff}.vlRun:disabled,.vlClear:disabled{opacity:.42}
      @media(max-width:430px){#voiceLiveDialog{width:100vw;max-width:none;border-radius:26px 26px 0 0;margin:auto auto 0}.vlBody{padding:14px 14px 8px}.vlActions{padding-left:14px;padding-right:14px}.vlText{min-height:170px;font-size:17px}.vlActions{grid-template-columns:1fr 1fr}.vlRun{grid-column:1/-1}.vlHead{padding-left:16px;padding-right:16px}}
    `;document.head.appendChild(s);
  }
  function ensureCapture(){
    ensureStyle();let dlg=$id('voiceLiveDialog');if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='voiceLiveDialog';dlg.innerHTML=`
      <div class="vlHead"><div class="vlHeadTop"><div><div class="vlMode" id="voiceLiveMode">COMANDO VOCALE</div><h2 id="voiceLiveTitle">Dettatura</h2><p>Controlla ciò che viene scritto prima di elaborarlo.</p></div><button type="button" class="vlClose" id="voiceLiveClose" aria-label="Chiudi">×</button></div></div>
      <div class="vlBody"><div id="voiceLiveContext" class="vlContext"></div><div class="vlCoach"><div class="vlCoachIcon">🎙</div><div><b>Detta direttamente nel riquadro</b><span>Tocca il microfono della tastiera e parla. Il testo comparirà qui in tempo reale mentre detti.</span></div></div><div class="vlInputWrap"><textarea id="voiceLiveText" class="vlText" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false"></textarea><div class="vlMeta"><span id="voiceLiveCount">0 parole</span><span id="voiceLiveState" class="vlLive">PRONTO</span></div></div><div id="voiceLiveExample" class="vlExample"></div></div>
      <div class="vlActions"><button type="button" id="voiceLiveClear" class="vlClear" disabled>PULISCI</button><button type="button" id="voiceLiveCancel" class="vlCancel">ANNULLA</button><button type="button" id="voiceLiveRun" class="vlRun" disabled>ELABORA</button></div>`;
    document.body.appendChild(dlg);
    const text=$id('voiceLiveText'),run=$id('voiceLiveRun'),clear=$id('voiceLiveClear');
    const refresh=()=>{const raw=text.value,trim=raw.trim(),words=trim?trim.split(/\s+/).length:0;$id('voiceLiveCount').textContent=`${words} ${words===1?'parola':'parole'}`;$id('voiceLiveState').textContent=trim?'TESTO ACQUISITO':'PRONTO';run.disabled=!trim;clear.disabled=!trim};
    text.addEventListener('input',refresh);
    text.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!run.disabled){e.preventDefault();run.click()}});
    clear.addEventListener('click',()=>{text.value='';refresh();text.focus()});
    const close=()=>{try{dlg.close()}catch{dlg.removeAttribute('open')}};
    $id('voiceLiveClose').addEventListener('click',close);$id('voiceLiveCancel').addEventListener('click',close);
    run.addEventListener('click',()=>{const raw=text.value.trim();if(!raw)return;close();window.WarehouseVoiceCommands?.executeTranscript?.(raw,activeHint)});
    dlg.addEventListener('cancel',e=>{e.preventDefault();close()});
    return dlg;
  }
  function openCapture(hint='AUTO'){
    activeHint=hint;const problem=validateContext(hint);if(problem){notify(problem,'error');return false}
    const dlg=ensureCapture(),title=modeTitle(hint),ctx=contextText(hint),text=$id('voiceLiveText');
    $id('voiceLiveMode').textContent=hint==='CERCA'?'CERCA':hint;$id('voiceLiveTitle').textContent=title;
    $id('voiceLiveContext').innerHTML=ctx?ctx.split(' · ').map(x=>`<span class="vlChip">${x}</span>`).join(''):'<span class="vlChip">Ricerca giacenze</span>';
    $id('voiceLiveExample').innerHTML=`<b>Esempio:</b> ${modeExample(hint)}`;text.value='';text.placeholder=modeExample(hint);$id('voiceLiveCount').textContent='0 parole';$id('voiceLiveState').textContent='PRONTO';$id('voiceLiveRun').disabled=true;$id('voiceLiveClear').disabled=true;
    try{dlg.showModal()}catch{dlg.setAttribute('open','')}
    setTimeout(()=>{text.focus();try{text.setSelectionRange(0,0)}catch{}},80);return true;
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
