/* Top-level live dictation sheet for REMOTO.
   The editable field lives in the main document (outside the warehouse iframe),
   so Android IMEs such as Gboard see a normal text editor and can dictate into it. */
(function installWarehouseTopLevelDictation(){
  'use strict';
  if(window.WarehouseTopLevelDictation)return;

  const VERSION='2026.08.25-top-live1';
  let activeHint='AUTO';

  const $=id=>document.getElementById(id);
  const frame=()=>document.getElementById('warehouseApp');
  const child=()=>frame()?.contentWindow||null;

  function ensureStyle(){
    if($('wtldStyle'))return;
    const s=document.createElement('style');s.id='wtldStyle';s.textContent=`
      #wtldDialog{width:min(96vw,580px);max-height:min(90dvh,820px);padding:0;border:0;border-radius:28px;overflow:hidden;background:#f7fbff;color:#17314d;box-shadow:0 24px 80px #071a2d66}
      #wtldDialog::backdrop{background:#071a2dcc;backdrop-filter:blur(3px)}
      .wtldHead{padding:18px 20px 14px;background:linear-gradient(135deg,#245caa,#4c87ca);color:#fff}.wtldHeadTop{display:flex;align-items:center;justify-content:space-between;gap:12px}.wtldMode{font-size:11px;letter-spacing:.12em;font-weight:950;opacity:.86}.wtldHead h2{margin:4px 0 5px;font-size:24px}.wtldHead p{margin:0;color:#eef6ff;font-size:14px}.wtldClose{width:42px;height:42px;border:0;border-radius:50%;background:#ffffff20;color:#fff;font-size:25px;font-weight:700}
      .wtldBody{padding:16px 18px 10px;overflow:auto}.wtldContext{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px}.wtldChip{background:#e2edf8;color:#245b91;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:900}.wtldCoach{display:flex;gap:11px;align-items:flex-start;background:#e8f5ee;border:1px solid #c9ead9;border-radius:17px;padding:12px 13px;margin-bottom:12px}.wtldCoachIcon{font-size:24px;line-height:1}.wtldCoach b{display:block;color:#14633f;margin-bottom:2px}.wtldCoach span{font-size:13px;color:#3f6252;line-height:1.35}
      .wtldInputWrap{background:#fff;border:2px solid #b8ccdf;border-radius:20px;overflow:hidden;transition:.18s box-shadow,.18s border-color}.wtldInputWrap:focus-within{border-color:#2c60aa;box-shadow:0 0 0 4px #2c60aa18}.wtldText{display:block;box-sizing:border-box;width:100%;min-height:200px;max-height:40dvh;resize:none;border:0;outline:0;padding:16px 16px 10px;background:#fff;color:#17314d;font-size:18px;line-height:1.45;font-weight:650;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wtldText::placeholder{color:#8ca0b3;font-weight:500}.wtldMeta{display:flex;justify-content:space-between;gap:10px;padding:8px 13px 11px;border-top:1px solid #edf2f6;font-size:12px;color:#697d90}.wtldLive{font-weight:900;color:#2c60aa}.wtldExample{font-size:12px;color:#718397;line-height:1.4;margin:10px 2px 0}.wtldExample b{color:#405a72}
      .wtldActions{display:grid;grid-template-columns:auto auto 1fr;gap:8px;padding:12px 18px calc(12px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #dce6ef}.wtldActions button{min-height:54px;border:0;border-radius:16px;font-weight:950;font-size:15px;padding:0 15px}.wtldClear{background:#e8eef4;color:#40556a}.wtldCancel{background:#f3e9e8;color:#8d3b36}.wtldRun{background:#00a45b;color:#fff}.wtldRun:disabled,.wtldClear:disabled{opacity:.42}
      @media(max-width:430px){#wtldDialog{width:100vw;max-width:none;border-radius:26px 26px 0 0;margin:auto auto 0}.wtldBody{padding:14px 14px 8px}.wtldActions{padding-left:14px;padding-right:14px}.wtldText{min-height:190px;font-size:17px}.wtldActions{grid-template-columns:1fr 1fr}.wtldRun{grid-column:1/-1}.wtldHead{padding-left:16px;padding-right:16px}}
    `;document.head.appendChild(s);
  }

  function ensureDialog(){
    ensureStyle();let dlg=$('wtldDialog');if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='wtldDialog';dlg.innerHTML=`
      <div class="wtldHead"><div class="wtldHeadTop"><div><div class="wtldMode" id="wtldMode">COMANDO VOCALE</div><h2 id="wtldTitle">Dettatura</h2><p>Controlla ciò che viene scritto prima di elaborarlo.</p></div><button type="button" class="wtldClose" id="wtldClose" aria-label="Chiudi">×</button></div></div>
      <div class="wtldBody"><div id="wtldContext" class="wtldContext"></div><div class="wtldCoach"><div class="wtldCoachIcon">🎙</div><div><b>Parla usando il microfono della tastiera</b><span>Il testo apparirà qui in tempo reale. Puoi correggerlo prima di continuare.</span></div></div><div class="wtldInputWrap"><textarea id="wtldText" class="wtldText" inputmode="text" enterkeyhint="done" autocomplete="on" autocorrect="on" autocapitalize="sentences" spellcheck="true" aria-label="Testo dettato" placeholder="Detta o scrivi qui…"></textarea><div class="wtldMeta"><span id="wtldCount">0 parole</span><span id="wtldState" class="wtldLive">PRONTO</span></div></div><div id="wtldExample" class="wtldExample"></div></div>
      <div class="wtldActions"><button type="button" id="wtldClear" class="wtldClear" disabled>PULISCI</button><button type="button" id="wtldCancel" class="wtldCancel">ANNULLA</button><button type="button" id="wtldRun" class="wtldRun" disabled>ELABORA</button></div>`;
    document.body.appendChild(dlg);

    const text=$('wtldText'),run=$('wtldRun'),clear=$('wtldClear');
    const refresh=()=>{const raw=text.value,trim=raw.trim(),words=trim?trim.split(/\s+/).length:0;$('wtldCount').textContent=`${words} ${words===1?'parola':'parole'}`;$('wtldState').textContent=trim?'TESTO ACQUISITO':'PRONTO';run.disabled=!trim;clear.disabled=!trim};
    text.addEventListener('input',refresh);
    clear.addEventListener('click',()=>{text.value='';refresh();text.focus({preventScroll:true})});
    const close=()=>{try{dlg.close()}catch{dlg.removeAttribute('open')}};
    $('wtldClose').addEventListener('click',close);$('wtldCancel').addEventListener('click',close);
    run.addEventListener('click',()=>{const raw=text.value.trim();if(!raw)return;close();const w=child();if(!w?.WarehouseVoiceCommands?.executeTranscript){return}w.WarehouseVoiceCommands.executeTranscript(raw,activeHint)});
    dlg.addEventListener('cancel',e=>{e.preventDefault();close()});
    return dlg;
  }

  function open(hint='AUTO',options={}){
    activeHint=String(hint||'AUTO').toUpperCase();const dlg=ensureDialog(),text=$('wtldText');
    $('wtldMode').textContent=options.mode||activeHint;$('wtldTitle').textContent=options.title||'Dettatura';
    const context=Array.isArray(options.context)?options.context.filter(Boolean):[];$('wtldContext').innerHTML=context.length?context.map(x=>`<span class="wtldChip">${String(x).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}</span>`).join(''):'<span class="wtldChip">Acquisizione vocale</span>';
    $('wtldExample').innerHTML=options.example?`<b>Esempio:</b> ${String(options.example).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}`:'';
    text.value='';text.placeholder=options.example||'Detta o scrivi qui…';$('wtldCount').textContent='0 parole';$('wtldState').textContent='PRONTO';$('wtldRun').disabled=true;$('wtldClear').disabled=true;
    try{dlg.showModal()}catch{dlg.setAttribute('open','')}
    requestAnimationFrame(()=>{requestAnimationFrame(()=>{try{text.focus({preventScroll:true});text.setSelectionRange(0,0)}catch{}})});return true;
  }

  window.WarehouseTopLevelDictation={version:VERSION,open};
})();
