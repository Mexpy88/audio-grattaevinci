/* REMOTO contextual voice entry.
   Voice lives inside CERCA / CARICA / SCARICA / MODIFICA.
   Common location/pallet values are entered manually and never guessed from speech.
   Voice never commits stock changes automatically: every operation remains review-only. */
(function installWarehouseVoiceCommands(){
  'use strict';
  if(window.WarehouseVoiceCommands)return;

  const VERSION='2026.08.24-voice5-contextual';
  const VALID_STATES=['NUOVO','SCARICATO','USATO'];
  const RESULTS_BACK_DEFAULT="show('bridge')";
  let recognition=null;
  let listening=false;
  let activeHint='AUTO';
  let modifyReviewRows=[];
  let modifyContext={location:'',pallet:''};
  let modifyAppliedSignature='';

  const $id=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const html=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clean=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.,;:!?()]/g,' ').replace(/\s+/g,' ').trim();
  const norm=v=>String(v??'').trim().toUpperCase();
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const stateWord=v=>{const s=clean(v);if(/\bnuov[oaie]?\b/.test(s))return 'NUOVO';if(/\bscaricat[oaie]?\b/.test(s))return 'SCARICATO';if(/\busat[oaie]?\b/.test(s))return 'USATO';return ''};

  function normalizedArticle(v){
    let s=String(v??'').trim().replace(/[^a-z0-9]/gi,'').toUpperCase();
    if(/^1\d{3,}/.test(s))s='I'+s.slice(1);
    if(/^\d{4,}/.test(s))s='I'+s;
    try{if(typeof normalizeArticle==='function')s=normalizeArticle(s,true)||s}catch{}
    return String(s||'').toUpperCase();
  }
  function numberWord(v){
    const s=clean(v).replace(/\s+/g,'');
    const map={zero:0,uno:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,ventuno:21,ventidue:22,ventitre:23,ventiquattro:24,venticinque:25,ventisei:26,ventisette:27,ventotto:28,ventinove:29,trenta:30,trentuno:31,trentadue:32,trentatre:33,quaranta:40,cinquanta:50,sessanta:60,settant:70,settanta:70,ottanta:80,novanta:90,cento:100,duecento:200,trecento:300,quattrocento:400,cinquecento:500,seicento:600,settecento:700,ottocento:800,novecento:900,mille:1000};
    return Object.prototype.hasOwnProperty.call(map,s)?map[s]:null;
  }
  function parseQuantity(s){
    let m=s.match(/(?:quantita|qta|pezzi?|unita)\s+(?:di\s+)?(\d+(?:[.,]\d+)?)/i);if(m)return Number(m[1].replace(',','.'));
    m=s.match(/(\d+(?:[.,]\d+)?)\s*(?:pezzi?|unita)\b/i);if(m)return Number(m[1].replace(',','.'));
    m=s.match(/(?:taglia|misura|size)\s+[a-z0-9\/.-]+\s+(\d+(?:[.,]\d+)?)/i);if(m)return Number(m[1].replace(',','.'));
    m=s.match(/(?:quantita|qta|pezzi?|unita)\s+(?:di\s+)?([a-z]+)/i);if(m){const n=numberWord(m[1]);if(n!==null)return n}
    m=s.match(/(?:taglia|misura|size)\s+[a-z0-9\/.-]+\s+([a-z]+)/i);if(m){const n=numberWord(m[1]);if(n!==null)return n}
    return null;
  }
  function stockRows(){try{return typeof stockBuckets==='function'?stockBuckets():[]}catch{return []}}
  function knownArticleFromSpeech(s){
    try{
      const compact=clean(s).replace(/[^a-z0-9]/g,'');
      const articles=[...new Set(stockRows().map(r=>normalizedArticle(r.article_base)).filter(Boolean))].sort((a,b)=>b.length-a.length);
      return articles.find(a=>compact.includes(a.toLowerCase().replace(/[^a-z0-9]/g,'')))||'';
    }catch{return ''}
  }
  function articleMarkers(s){
    const out=[],re=/\b(?:articolo|codice|sku)\s+(?:i(?=\s*\d)|1(?=(?:\s*\d){3,}))|\bi(?=\s*\d)|\b1(?=(?:\s*\d){3,})/ig;let m;
    while((m=re.exec(s)))out.push({index:m.index,end:re.lastIndex});
    return out;
  }
  function bareTailFields(tail){
    const state=stateWord(tail);let quantity=parseQuantity(tail),size='';
    let m=tail.match(/\b(?:taglia|misura|size)\s+([a-z0-9][a-z0-9\/.-]{0,7})\b/i);if(m)size=norm(m[1]);
    if(!size){
      const b=tail.match(/^(.*?)\s+(xxxs|xxl|xxxl|xxs|xs|s|m|l|xl|2xl|3xl|4xl)\s+(\d+(?:[.,]\d+)?)\s*(?:nuov[oaie]?|usat[oaie]?|scaricat[oaie]?)?\s*$/i);
      if(b){size=norm(b[2]);if(quantity===null)quantity=Number(b[3].replace(',','.'));return {size,quantity,state,codeBody:b[1]}}
      const b2=tail.match(/^(.*?)\s+(xxxs|xxl|xxxl|xxs|xs|s|m|l|xl|2xl|3xl|4xl)\s*(?:nuov[oaie]?|usat[oaie]?|scaricat[oaie]?)\s*$/i);
      if(b2){size=norm(b2[2]);return {size,quantity,state,codeBody:b2[1]}}
    }
    let cut=tail.length;
    for(const re of [/\b(?:taglia|misura|size)\b/i,/\b(?:quantita|qta|pezzi?|unita)\b/i,/\b(?:nuov[oaie]?|usat[oaie]?|scaricat[oaie]?)\b/i,/\bstato\b/i]){const x=re.exec(tail);if(x)cut=Math.min(cut,x.index)}
    let codeBody=tail.slice(0,cut).trim();
    if(quantity===null&&cut<tail.length){const before=tail.slice(0,cut).trim(),q=before.match(/^(.*?\D)\s+(\d+(?:[.,]\d+)?)$/);if(q){codeBody=q[1];quantity=Number(q[2].replace(',','.'))}}
    return {size,quantity,state,codeBody};
  }
  function parseItemSegment(segment,prefix=''){
    const s=clean(segment),known=knownArticleFromSpeech(s);
    const marker=s.match(/(?:\barticolo\s+|\bcodice\s+|\bsku\s+)?\b(?:i(?=\s*\d)|1(?=(?:\s*\d){3,}))/i);
    let tail=marker?s.slice((marker.index||0)+marker[0].length):s;
    const fields=bareTailFields(tail);
    let article=known;
    if(!article){const body=String(fields.codeBody||'').replace(/[^a-z0-9]/gi,'');article=normalizedArticle('I'+body.replace(/^[i1]/i,''))}
    const pre=clean(prefix+' '+s.slice(0,Math.max(0,marker?.index||0)));
    let action='MODIFICA';
    const hits=[...pre.matchAll(/\b(elimina(?:re)?|rimuovi|togli|cancella|aggiungi|inserisci|carica|modifica|rettifica|correggi|cambia|imposta)\b/ig)];
    const last=hits.length?hits[hits.length-1][1].toLowerCase():'';
    if(/elimina|rimuovi|togli|cancella/.test(last))action='ELIMINA';else if(/aggiungi|inserisci|carica/.test(last))action='AGGIUNGI';
    return {article,size:fields.size,quantity:fields.quantity,spokenState:fields.state,action,raw:segment};
  }
  function parseItems(raw,mode='CARICA'){
    const s=clean(raw),marks=articleMarkers(s),rows=[];
    if(!marks.length){const known=knownArticleFromSpeech(s);if(!known)return [];const single=parseItemSegment('articolo '+known+' '+s,'');single.action=mode==='MODIFICA'?single.action:'RIGA';return [single]}
    for(let i=0;i<marks.length;i++){
      const start=marks[i].index,end=i+1<marks.length?marks[i+1].index:s.length,segment=s.slice(start,end),prefix=s.slice(Math.max(0,start-55),start);const row=parseItemSegment(segment,prefix);row.action=mode==='MODIFICA'?row.action:'RIGA';rows.push(row)
    }
    return rows;
  }

  function currentHint(){
    if(typeof document==='undefined')return 'AUTO';
    if($id('searchScreen')?.classList.contains('on'))return 'CERCA';
    if($id('stockEditScreen')?.classList.contains('on'))return 'MODIFICA';
    if($id('operation')?.classList.contains('on')){try{return operation==='SCARICA'?'SCARICA':'CARICA'}catch{return 'CARICA'}}
    return 'AUTO';
  }
  function notify(message,type='good'){
    if(typeof document!=='undefined')document.querySelectorAll('.voiceStatus').forEach(el=>{el.textContent=message;el.className=`voiceStatus ${type}`});
    try{if(typeof warehouseToast==='function'&&!/ascolto|microfono/i.test(message))warehouseToast(message,type==='error'?'error':type==='warn'?'warn':'success')}catch{}
  }
  function setListening(on){
    listening=!!on;if(typeof document==='undefined')return;
    document.querySelectorAll('.voiceBtn').forEach(btn=>{
      if(on){btn.dataset.voiceOld=btn.innerHTML;btn.classList.add('listening');btn.innerHTML='<span class="voiceMicPulse">●</span> ASCOLTO…';btn.disabled=true}
      else{btn.classList.remove('listening');if(btn.dataset.voiceOld){btn.innerHTML=btn.dataset.voiceOld;delete btn.dataset.voiceOld}btn.disabled=false}
    });
  }
  function speechCtor(){return window.SpeechRecognition||window.webkitSpeechRecognition||null}
  function recognitionErrorMessage(code){
    const c=String(code||'sconosciuto');
    if(c==='not-allowed'||c==='service-not-allowed')return 'Microfono non autorizzato. Consenti il microfono per questo sito.';
    if(c==='no-speech')return 'Non ho sentito una frase. Tocca PARLA e riprova.';
    if(c==='audio-capture')return 'Il browser non riesce ad acquisire il microfono. Controlla che non sia occupato da un’altra app.';
    if(c==='network')return 'Il microfono funziona, ma il servizio di riconoscimento vocale del browser non è raggiungibile.';
    if(c==='aborted')return 'Ascolto interrotto. Tocca PARLA per riprovare.';
    if(c==='language-not-supported')return 'Il riconoscimento vocale italiano non è disponibile in questo browser.';
    return `Riconoscimento vocale non riuscito (${c}).`;
  }
  async function microphonePreflight(){
    if(typeof window!=='undefined'&&window.isSecureContext===false)return {ok:false,message:'Il comando vocale richiede una connessione HTTPS sicura.'};
    if(typeof navigator==='undefined'||!navigator.mediaDevices?.getUserMedia)return {ok:true};
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});for(const t of stream.getTracks?.()||[])try{t.stop()}catch{};await new Promise(r=>setTimeout(r,60));return {ok:true};
    }catch(e){
      const name=String(e?.name||'');if(name==='NotAllowedError'||name==='SecurityError')return {ok:false,message:'Accesso al microfono negato. Abilitalo nelle autorizzazioni del sito.'};if(name==='NotFoundError')return {ok:false,message:'Nessun microfono disponibile sul dispositivo.'};if(name==='NotReadableError'||name==='AbortError')return {ok:false,message:'Il microfono è occupato o non può essere aperto dal browser.'};return {ok:false,message:'Impossibile aprire il microfono: '+(e?.message||name||'errore sconosciuto')};
    }
  }
  async function start(hint='AUTO'){
    if(listening)return false;const C=speechCtor();if(!C){notify('Il riconoscimento vocale non è supportato da questo browser.','error');return false}
    activeHint=hint==='AUTO'?currentHint():hint;if(!['CERCA','CARICA','SCARICA','MODIFICA'].includes(activeHint)){notify('Apri prima CERCA, CARICA, SCARICA oppure MODIFICA.','warn');return false}
    if((activeHint==='CARICA'||activeHint==='SCARICA')&&(!$id('filaScaffale')?.value.trim()||!$id('bancale')?.value.trim())){notify('Prima inserisci Fila/Scaffale e Bancale, poi premi PARLA.','error');return false}
    if(activeHint==='MODIFICA'&&(!$id('stockEditLocation')?.value.trim()||!$id('stockEditPallet')?.value.trim())){notify('Prima inserisci Fila/Scaffale e Bancale da rettificare, poi premi PARLA.','error');return false}
    notify('Attivo il microfono…','');const mic=await microphonePreflight();if(!mic.ok){notify(mic.message,'error');return false}
    try{
      recognition=new C();recognition.lang='it-IT';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
      recognition.onstart=()=>{setListening(true);notify('Ascolto… puoi dettare più articoli nella stessa frase.','')};
      recognition.onresult=e=>{const transcript=String(e.results?.[0]?.[0]?.transcript||'').trim();if(!transcript){notify('Non ho ricevuto alcun comando.','warn');return}notify(`Ho capito: “${transcript}”`,'good');executeTranscript(transcript,activeHint)};
      recognition.onerror=e=>notify(recognitionErrorMessage(e?.error),'error');
      recognition.onend=()=>{setListening(false);recognition=null};recognition.start();return true;
    }catch(e){setListening(false);recognition=null;notify('Impossibile avviare il riconoscimento vocale: '+(e?.message||e),'error');return false}
  }
  function stop(){try{recognition?.stop?.()}catch{}setListening(false);recognition=null}
  function ensureMasterAccess(){try{if(window.LocalMaster?.requireMaster)return !!window.LocalMaster.requireMaster()}catch{}return true}

  function positionRows(location,pallet){const l=norm(location),p=norm(pallet);return stockRows().filter(r=>locOf(r)===l&&norm(r.bancale)===p)}
  function uniqueSizes(rows){return [...new Set(rows.map(r=>norm(r.size)).filter(Boolean))]}
  function resolveOperationRows(parsed,mode,location,pallet){
    const out=[],pos=positionRows(location,pallet),used=new Map();
    for(const src of parsed){const r={...src,state:src.spokenState||'',error:''};
      if(!r.article)r.error='Codice articolo non riconosciuto.';
      if(!(Number(r.quantity)>0))r.error=r.error||'Quantità non riconosciuta o non valida.';
      if(mode==='CARICA'){r.state=r.state||'NUOVO';if(!r.size)r.size=''}
      else{
        let candidates=pos.filter(x=>normalizedArticle(x.article_base)===normalizedArticle(r.article));
        if(r.size)candidates=candidates.filter(x=>norm(x.size)===norm(r.size));else{const sizes=uniqueSizes(candidates);if(sizes.length===1){r.size=sizes[0];candidates=candidates.filter(x=>norm(x.size)===r.size)}else if(sizes.length>1)r.error=r.error||'Sono presenti più taglie: indica la taglia.'}
        if(r.state)candidates=candidates.filter(x=>norm(x.state)===r.state);else{const states=[...new Set(candidates.map(x=>norm(x.state)).filter(Boolean))];if(states.length===1){r.state=states[0];candidates=candidates.filter(x=>norm(x.state)===r.state)}else if(states.length>1)r.error=r.error||'Sono presenti più stati: indica NUOVO, SCARICATO o USATO.'}
        if(!candidates.length&&!r.error)r.error='Articolo/taglia/stato non presente nel bancale indicato.';
        if(candidates.length===1&&Number(r.quantity)>0){const c=candidates[0],key=[normalizedArticle(c.article_base),norm(c.size),norm(c.state)].join('|'),already=used.get(key)||0,available=Number(c.quantity||0);if(already+Number(r.quantity)>available)r.error=r.error||`Quantità insufficiente: disponibili ${Math.max(0,available-already)} pezzi.`;else used.set(key,already+Number(r.quantity))}
      }
      out.push(r)
    }
    return out;
  }
  function setResultsVoiceMode(active,mode='',location='',pallet='',rows=[]){
    if(typeof document==='undefined')return;const back=document.querySelector('#results .back');if(back)back.setAttribute('onclick',active?"show('operation')":RESULTS_BACK_DEFAULT);let box=$id('voiceReviewSummary');if(!active){box?.remove();return}const base=$id('resultSummary');if(!base)return;if(!box){box=document.createElement('div');box.id='voiceReviewSummary';box.className='voiceReviewSummary';base.parentNode.insertBefore(box,base)}
    const errors=rows.filter(r=>r.error).length;box.innerHTML=`<b>🎙 ${html(mode)} vocale · ${rows.length} righe</b><div>Fila/Scaffale <strong>${html(location)}</strong> · Bancale <strong>${html(pallet)}</strong></div>${errors?`<div class="voiceReviewError">⚠ ${errors} righe richiedono correzione manuale prima della conferma.</div>`:'<div>✓ Dati riconosciuti. Controllali comunque prima di confermare.</div>'}`;
  }
  function executeOperationTranscript(raw,mode){
    if(!ensureMasterAccess())return false;const location=norm($id('filaScaffale')?.value),pallet=norm($id('bancale')?.value);if(!location||!pallet){notify('Prima inserisci Fila/Scaffale e Bancale.','error');return false}
    const parsed=parseItems(raw,mode);if(!parsed.length){notify('Non ho riconosciuto nessun codice articolo. Prova a dire “articolo I… taglia… quantità…”.','error');return false}
    const rows=resolveOperationRows(parsed,mode,location,pallet);
    try{
      importedPhotos=[{photo_index:1,general_note:'Dettatura vocale',groups:rows.map(r=>({article_base:r.article||'',description:'',confidence:r.error?.1:1,variants:[{size:r.size||'',quantity:Number(r.quantity)||0,state:VALID_STATES.includes(r.state)?r.state:'NON_CHIARO',confidence:r.error?.1:1,note:r.error?`DA CORREGGERE: ${r.error}`:''}]}))}];
      renderResults();show('results');setResultsVoiceMode(true,mode,location,pallet,rows);
    }catch(e){notify('Non sono riuscito a preparare la lista: '+(e?.message||e),'error');return false}
    const errors=rows.filter(r=>r.error).length;notify(errors?`Lista creata: correggi ${errors} righe evidenziate e poi conferma.`:`${rows.length} righe pronte da controllare prima della conferma.`,errors?'warn':'good');return true;
  }

  function renderVoiceSearch(rows){
    const list=$id('stockList');if(!list)return;list.innerHTML=rows.length?rows.map(s=>`<div class="stockCard"><div class="stockTop"><div><div class="sku">${html(s.article_base)} ${s.size?`· ${html(s.size)}`:''}</div><div class="dateLine">${html(s.state)}</div></div><div class="bigQty">${Number(s.quantity)||0}</div></div><div class="meta"><span>Fila/Scaffale ${html(locOf(s)||'—')}</span><span>Bancale ${html(s.bancale||'—')}</span></div></div>`).join(''):'<p>Nessuna giacenza trovata.</p>';
  }
  function executeSearchTranscript(raw){
    if(!ensureMasterAccess())return false;const parsed=parseItems(raw,'CERCA');if(!parsed.length){notify('Non ho riconosciuto nessun articolo da cercare.','error');return false}
    const found=[],seen=new Set();for(const q of parsed){for(const r of stockRows()){if(q.article&&normalizedArticle(r.article_base)!==normalizedArticle(q.article))continue;if(q.size&&norm(r.size)!==norm(q.size))continue;const k=[normalizedArticle(r.article_base),norm(r.size),norm(r.state),locOf(r),norm(r.bancale)].join('|');if(!seen.has(k)){seen.add(k);found.push(r)}}}
    if(typeof openSearch==='function')openSearch();const input=$id('searchInput');if(input)input.value=parsed.map(x=>[x.article,x.size].filter(Boolean).join(' ')).join(' · ');renderVoiceSearch(found);notify(found.length?`Trovate ${found.length} giacenze.`:'Nessuna giacenza corrispondente.',found.length?'good':'warn');return true;
  }

  function parseModifyRows(raw){
    return parseItems(raw,'MODIFICA').map(r=>{
      const s=clean(r.raw),sourceMatch=s.match(/\bda\s+stato\s+(nuov[oaie]?|usat[oaie]?|scaricat[oaie]?)/i),targetMatch=s.match(/\b(?:a|in)\s+stato\s+(nuov[oaie]?|usat[oaie]?|scaricat[oaie]?)|\b(?:nuovo\s+stato|stato)\s+(nuov[oaie]?|usat[oaie]?|scaricat[oaie]?)/i);
      let sourceState=sourceMatch?stateWord(sourceMatch[1]):'',targetState='';
      if(r.action==='ELIMINA')sourceState=sourceState||r.spokenState;
      else if(r.action==='AGGIUNGI')targetState=r.spokenState||'NUOVO';
      else targetState=targetMatch?stateWord(targetMatch[1]||targetMatch[2]):(r.spokenState&&!sourceState?r.spokenState:'');
      return {action:r.action||'MODIFICA',article:r.article||'',size:r.size||'',quantity:r.quantity,sourceState,targetState,raw:r.raw,error:'',source:null};
    });
  }
  function validateModifyReviewRows(rows,availableRows){
    const out=rows.map(r=>({...r,error:'',source:null})),used=new Set();
    for(const r of out){
      if(!r.article){r.error='Codice articolo non riconosciuto.';continue}
      if(r.action==='AGGIUNGI'){
        if(!r.size){r.error='Indica la taglia da aggiungere.';continue}if(!(Number(r.quantity)>0)){r.error='Indica quanti pezzi aggiungere.';continue}r.targetState=VALID_STATES.includes(norm(r.targetState))?norm(r.targetState):'NUOVO';continue;
      }
      let candidates=(availableRows||[]).filter(x=>normalizedArticle(x.article_base)===normalizedArticle(r.article));
      if(r.size)candidates=candidates.filter(x=>norm(x.size)===norm(r.size));else{const sizes=uniqueSizes(candidates);if(sizes.length===1){r.size=sizes[0];candidates=candidates.filter(x=>norm(x.size)===r.size)}else if(sizes.length>1){r.error='Articolo presente in più taglie: scegli la taglia.';continue}}
      if(r.sourceState)candidates=candidates.filter(x=>norm(x.state)===norm(r.sourceState));
      if(!candidates.length){r.error='Articolo/taglia non presente su questo bancale.';continue}
      if(candidates.length>1){r.error='La stessa riga esiste con più stati: scegli lo stato di origine.';continue}
      const src=candidates[0],key=[normalizedArticle(src.article_base),norm(src.size),norm(src.state)].join('|');if(used.has(key)){r.error='La stessa giacenza compare più volte nella dettatura: unifica la modifica in una sola riga.';continue}used.add(key);r.source=src;r.sourceState=norm(src.state);
      if(r.action==='ELIMINA'&&r.quantity!==null&&r.quantity!==undefined&&Number(r.quantity)>Number(src.quantity||0)){r.error=`Non puoi eliminare ${Number(r.quantity)} pezzi: sul bancale ce ne sono ${Number(src.quantity||0)}.`;continue}
      if(r.action==='MODIFICA'){
        const hasQty=r.quantity!==null&&r.quantity!==undefined,hasState=!!r.targetState;if(!hasQty&&!hasState){r.error='Indica la nuova quantità e/o il nuovo stato.';continue}if(hasQty&&Number(r.quantity)<0){r.error='La quantità finale non può essere negativa.';continue}if(r.targetState&&!VALID_STATES.includes(norm(r.targetState))){r.error='Nuovo stato non valido.';continue}
      }
    }
    return out;
  }
  function modifyPositionRows(){return positionRows(modifyContext.location,modifyContext.pallet)}
  function reviewSignature(rows=modifyReviewRows){return JSON.stringify(rows.map(r=>[r.action,r.article,r.size,r.quantity,r.sourceState,r.targetState]))}
  function renderModifyReview(){
    if(typeof document==='undefined')return;let box=$id('voiceModifyReview');const card=$id('stockEditScreen')?.querySelector('.card');if(!card)return;if(!box){box=document.createElement('div');box.id='voiceModifyReview';box.className='voiceModifyReview';card.insertAdjacentElement('afterend',box)}
    const checked=validateModifyReviewRows(modifyReviewRows,modifyPositionRows());modifyReviewRows=checked;const errors=checked.filter(r=>r.error).length,currentSig=reviewSignature(checked),alreadyApplied=currentSig===modifyAppliedSignature&&!!currentSig;
    box.innerHTML=`<div class="voiceReviewHead"><div><b>🎙 Revisione rettifica vocale</b><small>Fila/Scaffale ${html(modifyContext.location)} · Bancale ${html(modifyContext.pallet)}</small></div><span class="${errors?'voiceBadgeError':'voiceBadgeOk'}">${errors?errors+' ERRORI':'VALIDA'}</span></div>${checked.map((r,i)=>`<div class="voiceEditRow ${r.error?'hasError':''}" data-row="${i}"><div class="voiceEditTop"><select data-field="action"><option ${r.action==='MODIFICA'?'selected':''}>MODIFICA</option><option ${r.action==='ELIMINA'?'selected':''}>ELIMINA</option><option ${r.action==='AGGIUNGI'?'selected':''}>AGGIUNGI</option></select><button type="button" data-remove="${i}">×</button></div><div class="voiceEditGrid"><label>Articolo<input data-field="article" value="${html(r.article)}"></label><label>Taglia<input data-field="size" value="${html(r.size)}"></label><label>${r.action==='ELIMINA'?'Qtà da eliminare':r.action==='AGGIUNGI'?'Qtà da aggiungere':'Qtà finale'}<input data-field="quantity" type="number" min="0" value="${r.quantity===null||r.quantity===undefined?'':html(r.quantity)}" placeholder="${r.action==='ELIMINA'?'vuoto = tutta':'facoltativo'}"></label><label>Stato origine<select data-field="sourceState"><option value="">AUTO</option>${VALID_STATES.map(s=>`<option ${s===r.sourceState?'selected':''}>${s}</option>`).join('')}</select></label><label>Nuovo stato<select data-field="targetState"><option value="">INVARIATO</option>${VALID_STATES.map(s=>`<option ${s===r.targetState?'selected':''}>${s}</option>`).join('')}</select></label></div><div class="voiceRowCheck ${r.error?'bad':'good'}">${r.error?'⚠ '+html(r.error):r.action==='AGGIUNGI'?'✓ Nuova giacenza pronta da aggiungere':`✓ Trovato: ${html(r.source?.article_base||r.article)} ${html(r.source?.size||r.size)} · ${html(r.source?.state||r.sourceState)} · ${Number(r.source?.quantity||0)} pezzi`}</div></div>`).join('')}<div class="voiceReviewActions"><button type="button" id="voiceSpeakMore" class="btn soft">🎙 PARLA ANCORA</button><button type="button" id="voiceApplyModify" class="btn success" ${errors||!checked.length||alreadyApplied?'disabled':''}>${alreadyApplied?'✓ APPLICATO — CONTROLLA SOTTO':'APPLICA ALLA RETTIFICA'}</button></div><div class="voiceReviewFoot">Le righe in errore non possono essere applicate. Dopo l’applicazione controlla l’editor e usa <b>SALVA MODIFICHE</b>.</div>`;
    box.querySelectorAll('[data-row]').forEach(rowEl=>{const i=Number(rowEl.dataset.row);rowEl.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('change',()=>{const k=el.dataset.field,v=k==='quantity'?(el.value===''?null:Number(el.value)):norm(el.value);modifyReviewRows[i][k]=v;modifyAppliedSignature='';renderModifyReview()}))});
    box.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{modifyReviewRows.splice(Number(b.dataset.remove),1);modifyAppliedSignature='';renderModifyReview()}));
    $id('voiceSpeakMore')?.addEventListener('click',()=>start('MODIFICA'));$id('voiceApplyModify')?.addEventListener('click',applyModifyReview);
  }
  function executeModifyTranscript(raw){
    if(!ensureMasterAccess())return false;const location=norm($id('stockEditLocation')?.value),pallet=norm($id('stockEditPallet')?.value);if(!location||!pallet){notify('Prima inserisci Fila/Scaffale e Bancale.','error');return false}
    const available=positionRows(location,pallet);if(!available.length){notify(`Nessuna giacenza presente in Fila/Scaffale ${location}, Bancale ${pallet}.`,'error');return false}
    const parsed=parseModifyRows(raw);if(!parsed.length){notify('Non ho riconosciuto nessun articolo da rettificare.','error');return false}
    if(modifyContext.location!==location||modifyContext.pallet!==pallet){modifyReviewRows=[];modifyAppliedSignature=''}modifyContext={location,pallet};modifyReviewRows.push(...parsed);modifyAppliedSignature='';
    try{if(typeof loadStockPallet==='function')loadStockPallet()}catch{}renderModifyReview();const checked=validateModifyReviewRows(modifyReviewRows,available),errors=checked.filter(r=>r.error).length;notify(errors?`Dettatura acquisita: ${errors} righe da correggere.`:`${parsed.length} rettifiche aggiunte alla revisione.`,errors?'warn':'good');return true;
  }
  function applyModifyReview(){
    const checked=validateModifyReviewRows(modifyReviewRows,modifyPositionRows()),errors=checked.filter(r=>r.error);if(errors.length){notify('Correggi tutte le righe in errore prima di applicare la rettifica.','error');renderModifyReview();return false}
    try{
      if(typeof loadStockPallet==='function'){if(norm($id('stockEditLocation')?.value)!==modifyContext.location)$id('stockEditLocation').value=modifyContext.location;if(norm($id('stockEditPallet')?.value)!==modifyContext.pallet)$id('stockEditPallet').value=modifyContext.pallet;loadStockPallet()}
      for(const r of checked){
        if(r.action==='AGGIUNGI'){
          let d=stockEditRowsDraft.find(x=>!x.deleted&&normalizedArticle(x.article_base)===normalizedArticle(r.article)&&norm(x.size)===norm(r.size)&&norm(x.state)===norm(r.targetState||'NUOVO'));
          if(d)d.quantity=Number(d.quantity||0)+Number(r.quantity||0);else stockEditRowsDraft.push({edit_id:typeof uid==='function'?uid():String(Date.now()+Math.random()),original:null,deleted:false,article_base:normalizedArticle(r.article),size:norm(r.size),quantity:Number(r.quantity||0),state:norm(r.targetState||'NUOVO'),fila_scaffale:modifyContext.location,bancale:modifyContext.pallet});continue;
        }
        const src=r.source,d=stockEditRowsDraft.find(x=>!x.deleted&&normalizedArticle(x.article_base)===normalizedArticle(src.article_base)&&norm(x.size)===norm(src.size)&&norm(x.state)===norm(src.state));if(!d)throw new Error(`Riga ${r.article} ${r.size} non più disponibile nell'editor`);
        if(r.action==='ELIMINA'){if(r.quantity===null||r.quantity===undefined||r.quantity==='')d.deleted=true;else d.quantity=Math.max(0,Number(src.quantity||0)-Number(r.quantity||0))}
        else{if(r.quantity!==null&&r.quantity!==undefined)d.quantity=Math.max(0,Number(r.quantity)||0);if(r.targetState)d.state=norm(r.targetState)}
      }
      if(typeof renderStockEditRows==='function')renderStockEditRows();if(typeof setStatus==='function')setStatus('stockEditSearchStatus','Rettifica vocale applicata all’editor. Controlla ogni riga e poi premi SALVA MODIFICHE.','good');modifyAppliedSignature=reviewSignature(checked);renderModifyReview();$id('stockEditEditor')?.scrollIntoView?.({behavior:'smooth',block:'start'});notify('Rettifica applicata all’editor. Controlla e poi premi SALVA MODIFICHE.','good');return true;
    }catch(e){notify('Non posso applicare la rettifica: '+(e?.message||e),'error');return false}
  }

  function executeTranscript(raw,hint){if(hint==='CERCA')return executeSearchTranscript(raw);if(hint==='CARICA'||hint==='SCARICA')return executeOperationTranscript(raw,hint);if(hint==='MODIFICA')return executeModifyTranscript(raw);return false}
  function makeContextBlock(id,label,hint,help){const block=document.createElement('div');block.id=id;block.className='voiceContextBlock';block.innerHTML=`<div class="voiceHelp">${html(help)}</div><button type="button" class="voiceBtn"><span class="voiceMicPulse">🎙</span> ${html(label)}</button><div class="voiceStatus" aria-live="polite"></div>`;block.querySelector('button').addEventListener('click',()=>start(hint));return block}
  function refreshOperationVoice(){const block=$id('voiceOperationBlock');if(!block)return;let op='CARICA';try{op=operation==='SCARICA'?'SCARICA':'CARICA'}catch{}const btn=block.querySelector('.voiceBtn');if(btn&&!listening)btn.innerHTML=`<span class="voiceMicPulse">🎙</span> DETTA ARTICOLI DA ${op}`}
  function wrapOpenOperation(){const base=window.openOperation;if(typeof base!=='function'||base.__voiceContextWrapped)return;const wrapped=function(){setResultsVoiceMode(false);const out=base.apply(this,arguments);setTimeout(refreshOperationVoice,0);return out};wrapped.__voiceContextWrapped=true;window.openOperation=wrapped}
  function installUi(){
    if(typeof document==='undefined')return false;wrapOpenOperation();$id('voiceCommandPanel')?.remove();
    const search=$id('searchScreen');if(search&&!$id('voiceSearchBlock'))search.querySelector('.card')?.appendChild(makeContextBlock('voiceSearchBlock','CERCA CON LA VOCE','CERCA','Puoi dettare uno o più codici articolo.'));
    const op=$id('operation');if(op&&!$id('voiceOperationBlock'))op.querySelector('.card')?.appendChild(makeContextBlock('voiceOperationBlock','DETTA ARTICOLI','AUTO','Prima inserisci Fila/Scaffale e Bancale. La posizione verrà applicata automaticamente a tutte le righe dettate.'));
    const edit=$id('stockEditScreen');if(edit&&!$id('voiceModifyBlock'))edit.querySelector('.card')?.appendChild(makeContextBlock('voiceModifyBlock','DETTA RETTIFICHE','MODIFICA','Prima inserisci Fila/Scaffale e Bancale. Ogni articolo dettato verrà verificato contro la giacenza reale di quella posizione.'));
    refreshOperationVoice();return true;
  }

  window.WarehouseVoiceCommands={version:VERSION,clean,normalizedArticle,parseQuantity,parseItems,parseModifyRows,resolveOperationRows,validateModifyReviewRows,microphonePreflight,currentHint,start,stop,executeTranscript,executeSearchTranscript,executeOperationTranscript,executeModifyTranscript,applyModifyReview,installUi};
  if(typeof document!=='undefined')installUi();
})();