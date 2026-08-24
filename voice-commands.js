/* REMOTO voice commands for CERCA / CARICA / SCARICA / MODIFICA.
   Voice never commits warehouse changes automatically: it only searches or prepares a review/edit screen. */
(function installWarehouseVoiceCommands(){
  'use strict';
  if(window.WarehouseVoiceCommands)return;

  const VERSION='2026.08.24-voice1';
  let recognition=null;
  let listening=false;
  let activeHint='AUTO';

  const $id=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const html=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clean=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.,;:!?()]/g,' ').replace(/\s+/g,' ').trim();
  const norm=v=>String(v??'').trim().toUpperCase();

  function normalizedArticle(v){
    let s=String(v??'').trim().replace(/\s+/g,'').toUpperCase();
    if(/^1\d{3,}$/.test(s))s='I'+s.slice(1);
    if(/^\d{4,}$/.test(s))s='I'+s;
    try{if(typeof normalizeArticle==='function')s=normalizeArticle(s,true)||s}catch{}
    return String(s||'').toUpperCase();
  }
  function numberWord(v){
    const s=clean(v).replace(/\s+/g,'');
    const map={zero:0,uno:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,ventuno:21,ventidue:22,ventitre:23,ventiquattro:24,venticinque:25,ventisei:26,ventisette:27,ventotto:28,ventinove:29,trenta:30,trentuno:31,trentadue:32,trentatre:33,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90,cento:100,duecento:200,trecento:300,quattrocento:400,cinquecento:500,seicento:600,settecento:700,ottocento:800,novecento:900,mille:1000};
    return Object.prototype.hasOwnProperty.call(map,s)?map[s]:null;
  }
  function parseQuantity(s){
    let m=s.match(/(?:quantita|qta|pezzi?|unita)\s+(?:di\s+)?(\d+(?:[.,]\d+)?)/i);if(m)return Number(m[1].replace(',','.'));
    m=s.match(/(\d+(?:[.,]\d+)?)\s*(?:pezzi?|unita)\b/i);if(m)return Number(m[1].replace(',','.'));
    m=s.match(/(?:quantita|qta|pezzi?|unita)\s+(?:di\s+)?([a-z]+)/i);if(m){const n=numberWord(m[1]);if(n!==null)return n}
    return null;
  }
  function knownArticleFromSpeech(s){
    try{
      if(typeof stockBuckets!=='function')return '';
      const compact=s.replace(/[^a-z0-9]/g,'');
      const articles=[...new Set(stockBuckets().map(r=>normalizedArticle(r.article_base)).filter(Boolean))].sort((a,b)=>b.length-a.length);
      return articles.find(a=>compact.includes(a.toLowerCase().replace(/[^a-z0-9]/g,'')))||'';
    }catch{return ''}
  }
  function parseArticle(s){
    const known=knownArticleFromSpeech(s);if(known)return known;
    let m=s.match(/(?:articolo|codice|sku)\s+((?:[i1]\s*\d{3,})|(?:[a-z]\s*\d{3,})|(?:\d{4,})|(?:[a-z0-9][a-z0-9-]{2,}))/i);
    if(!m)m=s.match(/\b([i1]\s*\d{4,})\b/i);
    return m?normalizedArticle(m[1]):'';
  }
  function parseSize(s){const m=s.match(/(?:taglia|misura|size)\s+([a-z0-9][a-z0-9\/.-]{0,7})\b/i);return m?norm(m[1]):''}
  function parseState(s){if(/\bnuov[oaie]?\b/i.test(s))return 'NUOVO';if(/\bscaricat[oaie]?\b/i.test(s))return 'SCARICATO';if(/\busat[oaie]?\b/i.test(s))return 'USATO';return ''}
  function parseLocation(s){
    let m=s.match(/fila\s+([a-z0-9-]+)\s+scaffale\s+([a-z0-9-]+)/i);if(m)return norm(`${m[1]}/${m[2]}`);
    m=s.match(/(?:fila\s*\/?\s*scaffale|fila|scaffale|posizione)\s+([a-z0-9][a-z0-9\/-]*)/i);return m?norm(m[1]):'';
  }
  function parsePallet(s){const m=s.match(/(?:bancale|pallet)\s+([a-z0-9-]+)/i);return m?norm(m[1]):''}
  function parseSourceLocation(s){
    let m=s.match(/da\s+fila\s+([a-z0-9-]+)\s+scaffale\s+([a-z0-9-]+)/i);if(m)return norm(`${m[1]}/${m[2]}`);
    m=s.match(/da\s+(?:fila\s*\/?\s*scaffale|fila|scaffale|posizione)\s+([a-z0-9][a-z0-9\/-]*)/i);return m?norm(m[1]):'';
  }
  function parseTargetLocation(s){
    let m=s.match(/(?:a|in|su)\s+fila\s+([a-z0-9-]+)\s+scaffale\s+([a-z0-9-]+)/i);if(m)return norm(`${m[1]}/${m[2]}`);
    m=s.match(/(?:a|in|su)\s+(?:fila\s*\/?\s*scaffale|fila|scaffale|posizione)\s+([a-z0-9][a-z0-9\/-]*)/i);return m?norm(m[1]):'';
  }
  function parseSourcePallet(s){const m=s.match(/da\s+(?:bancale|pallet)\s+([a-z0-9-]+)/i);return m?norm(m[1]):''}
  function parseTargetPallet(s){const m=s.match(/(?:a|al|nel|sul|su)\s+(?:bancale|pallet)\s+([a-z0-9-]+)/i);return m?norm(m[1]):''}
  function parseDestination(s){
    const choices=[['CONTROLLO QUALITA','CONTROLLO QUALITÀ'],['SPEDIZIONI','SPEDIZIONI'],['PRODUZIONE','PRODUZIONE'],['LAVAGGIO','LAVAGGIO'],['LINA','LINA'],['ALTRO','ALTRO']];
    const u=norm(clean(s));for(const [key,value] of choices)if(u.includes(key))return value;return '';
  }
  function actionFrom(s,hint='AUTO'){
    if(/\b(cerca|trova|ricerca)\b/i.test(s))return 'CERCA';
    if(/\b(carica|carico|entrata)\b/i.test(s))return 'CARICA';
    if(/\b(scarica|scarico|preleva|prelievo|uscita)\b/i.test(s))return 'SCARICA';
    if(/\b(modifica|rettifica|correggi|sposta)\b/i.test(s))return 'MODIFICA';
    return ['CERCA','CARICA','SCARICA','MODIFICA'].includes(hint)?hint:'';
  }
  function parseCommand(raw,hint='AUTO'){
    const s=clean(raw),action=actionFrom(s,hint),sourceLocation=parseSourceLocation(s),sourcePallet=parseSourcePallet(s),explicitTargetLocation=parseTargetLocation(s),explicitTargetPallet=parseTargetPallet(s),genericLocation=parseLocation(s),genericPallet=parsePallet(s);
    const cmd={raw:String(raw||''),action,article:parseArticle(s),size:parseSize(s),quantity:parseQuantity(s),state:parseState(s),destination:parseDestination(s),location:'',pallet:'',sourceLocation,sourcePallet,targetLocation:'',targetPallet:''};
    if(action==='MODIFICA'){
      cmd.targetLocation=explicitTargetLocation||(!sourceLocation?genericLocation:'');
      cmd.targetPallet=explicitTargetPallet||(!sourcePallet?genericPallet:'');
    }else{
      cmd.location=genericLocation;cmd.pallet=genericPallet;
    }
    return cmd;
  }

  function currentHint(){
    if(typeof document==='undefined')return 'AUTO';
    if($id('searchScreen')?.classList.contains('on'))return 'CERCA';
    if($id('stockEditScreen')?.classList.contains('on'))return 'MODIFICA';
    if($id('operation')?.classList.contains('on')){try{return operation==='SCARICA'?'SCARICA':'CARICA'}catch{return 'CARICA'}}
    return 'AUTO';
  }
  function notify(message,type='good'){
    document?.querySelectorAll?.('.voiceStatus').forEach(el=>{el.textContent=message;el.className=`voiceStatus ${type}`});
    try{if(typeof warehouseToast==='function'&&!/ascolto/i.test(message))warehouseToast(message,type==='error'?'error':type==='warn'?'warn':'success')}catch{}
  }
  function setListening(on){
    listening=!!on;
    if(typeof document==='undefined')return;
    document.querySelectorAll('.voiceBtn').forEach(btn=>{
      if(on){btn.dataset.voiceOld=btn.innerHTML;btn.classList.add('listening');btn.innerHTML='<span class="voiceMicPulse">●</span> ASCOLTO…';btn.disabled=true}
      else{btn.classList.remove('listening');if(btn.dataset.voiceOld){btn.innerHTML=btn.dataset.voiceOld;delete btn.dataset.voiceOld}btn.disabled=false}
    });
  }
  function speechCtor(){return window.SpeechRecognition||window.webkitSpeechRecognition||null}
  function recognitionErrorMessage(code){
    if(code==='not-allowed'||code==='service-not-allowed')return 'Microfono non autorizzato. Consenti l’accesso al microfono nel browser.';
    if(code==='no-speech')return 'Non ho sentito una frase. Tocca il microfono e riprova.';
    if(code==='audio-capture')return 'Microfono non disponibile sul dispositivo.';
    if(code==='network')return 'Riconoscimento vocale non disponibile per un problema di rete.';
    return 'Non sono riuscito a riconoscere il comando vocale.';
  }
  function start(hint='AUTO'){
    if(listening)return;
    const C=speechCtor();if(!C){notify('Il riconoscimento vocale non è supportato da questo browser.','error');return false}
    activeHint=hint==='AUTO'?currentHint():hint;
    try{
      recognition=new C();recognition.lang='it-IT';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
      recognition.onstart=()=>{setListening(true);notify('Ascolto… parla normalmente.','')};
      recognition.onresult=e=>{const transcript=String(e.results?.[0]?.[0]?.transcript||'').trim();if(transcript){notify(`Ho capito: “${transcript}”`,'good');execute(parseCommand(transcript,activeHint))}else notify('Non ho ricevuto alcun comando.','warn')};
      recognition.onerror=e=>notify(recognitionErrorMessage(e.error),'error');
      recognition.onend=()=>{setListening(false);recognition=null};
      recognition.start();return true;
    }catch(e){setListening(false);recognition=null;notify('Impossibile avviare il microfono: '+(e.message||e),'error');return false}
  }
  function stop(){try{recognition?.stop?.()}catch{}setListening(false);recognition=null}

  function stockRows(){try{return typeof stockBuckets==='function'?stockBuckets():[]}catch{return []}}
  function matches(row,cmd){
    if(cmd.article&&normalizedArticle(row.article_base)!==normalizedArticle(cmd.article))return false;
    if(cmd.size&&norm(row.size)!==norm(cmd.size))return false;
    if(cmd.state&&norm(row.state)!==norm(cmd.state))return false;
    if(cmd.location&&norm(typeof locationOf==='function'?locationOf(row):row.fila_scaffale)!==norm(cmd.location))return false;
    if(cmd.pallet&&norm(row.bancale)!==norm(cmd.pallet))return false;
    return true;
  }
  function renderVoiceSearch(rows){
    const list=$id('stockList');if(!list)return;
    list.innerHTML=rows.length?rows.map(s=>`<div class="stockCard"><div class="stockTop"><div><div class="sku">${html(s.article_base)} ${s.size?`· ${html(s.size)}`:''}</div><div class="dateLine">${html(s.state)}</div></div><div class="bigQty">${Number(s.quantity)||0}</div></div><div class="meta"><span>Fila/Scaffale ${html(typeof locationOf==='function'?locationOf(s):s.fila_scaffale||'—')}</span><span>Bancale ${html(s.bancale||'—')}</span></div></div>`).join(''):'<p>Nessuna giacenza trovata.</p>';
  }
  function executeSearch(cmd){
    if(!cmd.article&&!cmd.size){notify('Per la ricerca pronuncia almeno il codice articolo o la taglia.','error');return false}
    if(typeof openSearch==='function')openSearch();
    const input=$id('searchInput');if(input)input.value=[cmd.article,cmd.size?`taglia ${cmd.size}`:''].filter(Boolean).join(' ');
    const rows=stockRows().filter(r=>matches(r,cmd));renderVoiceSearch(rows);notify(rows.length?`Trovate ${rows.length} giacenze.`:'Nessuna giacenza corrispondente. ',rows.length?'good':'warn');return true;
  }
  function setDestination(value){
    const select=$id('destination');if(!select||!value)return;
    const target=clean(value);const opt=[...select.options].find(o=>clean(o.value)===target||clean(o.textContent)===target);if(opt)select.value=opt.value;
  }
  function resolveDischargeState(cmd){
    if(cmd.state)return cmd.state;
    const probe={...cmd,state:''},rows=stockRows().filter(r=>matches(r,probe));const states=[...new Set(rows.map(r=>norm(r.state)).filter(Boolean))];
    return states.length===1?states[0]:'';
  }
  function voiceReviewSummary(cmd,state){
    const results=$id('results'),base=$id('resultSummary');if(!results||!base)return;
    let box=$id('voiceReviewSummary');if(!box){box=document.createElement('div');box.id='voiceReviewSummary';box.className='voiceReviewSummary';base.parentNode.insertBefore(box,base)}
    const parts=[cmd.action,cmd.location?`Fila/Scaffale ${cmd.location}`:'',cmd.pallet?`Bancale ${cmd.pallet}`:'',cmd.action==='SCARICA'?`Destinazione ${cmd.destination||$id('destination')?.value||'—'}`:''].filter(Boolean);
    box.innerHTML=`<b>🎙 Operazione preparata dalla voce</b>${html(parts.join(' · '))}<br>${html(cmd.article)}${cmd.size?` · ${html(cmd.size)}`:''} · Qtà ${Number(cmd.quantity)||0} · ${html(state)}<br><button type="button" onclick="show('operation')">MODIFICA DATI OPERAZIONE</button>`;
  }
  function executeOperation(cmd){
    if(!cmd.article){notify('Non ho riconosciuto il codice articolo.','error');return false}
    if(!(Number(cmd.quantity)>0)){notify('Non ho riconosciuto una quantità valida.','error');return false}
    if(!cmd.location||!cmd.pallet){notify('Pronuncia anche Fila/Scaffale e Bancale.','error');return false}
    let state=cmd.state;if(cmd.action==='CARICA'&&!state)state='NUOVO';if(cmd.action==='SCARICA'&&!state)state=resolveDischargeState(cmd);
    if(!state){notify('Per lo scarico ci sono più stati possibili: pronuncia NUOVO, SCARICATO oppure USATO.','error');return false}
    if(typeof openOperation!=='function')return false;openOperation(cmd.action);
    if($id('filaScaffale'))$id('filaScaffale').value=cmd.location;if($id('bancale'))$id('bancale').value=cmd.pallet;if(cmd.action==='SCARICA'&&cmd.destination)setDestination(cmd.destination);
    try{importedPhotos=[{photo_index:1,general_note:'Comando vocale',groups:[{article_base:cmd.article,description:'',confidence:1,variants:[{size:cmd.size||'',quantity:Number(cmd.quantity),state,confidence:1,note:''}]}]}];renderResults();show('results');voiceReviewSummary(cmd,state)}catch(e){notify('Non sono riuscito a preparare l’operazione: '+(e.message||e),'error');return false}
    notify('Operazione compilata. Controlla i dati e premi CONFERMA TUTTO.','good');return true;
  }
  function candidateRowsForModify(cmd){
    let rows=stockRows();if(cmd.article)rows=rows.filter(r=>normalizedArticle(r.article_base)===normalizedArticle(cmd.article));if(cmd.size)rows=rows.filter(r=>norm(r.size)===norm(cmd.size));if(cmd.state)rows=rows.filter(r=>norm(r.state)===norm(cmd.state));
    if(cmd.sourceLocation)rows=rows.filter(r=>norm(typeof locationOf==='function'?locationOf(r):r.fila_scaffale)===norm(cmd.sourceLocation));
    if(cmd.sourcePallet)rows=rows.filter(r=>norm(r.bancale)===norm(cmd.sourcePallet));
    return rows;
  }
  function executeModify(cmd){
    if(typeof openStockEdit!=='function'||typeof loadStockPallet!=='function'){notify('Modulo MODIFICA non disponibile.','error');return false}
    if(!cmd.article){
      const loc=cmd.sourceLocation||cmd.targetLocation,pal=cmd.sourcePallet||cmd.targetPallet;if(!loc||!pal){notify('Per MODIFICA pronuncia l’articolo oppure Fila/Scaffale e Bancale.','error');return false}
      openStockEdit();$id('stockEditLocation').value=loc;$id('stockEditPallet').value=pal;loadStockPallet();notify('Pallet aperto. Controlla le righe prima di salvare.','good');return true;
    }
    const candidates=candidateRowsForModify(cmd);
    if(!candidates.length){notify('Non trovo una giacenza corrispondente da modificare.','error');return false}
    if(candidates.length>1){notify('Ho trovato più giacenze corrispondenti. Specifica la taglia e, se necessario, la fila o il bancale di origine.','warn');return false}
    const source=candidates[0],sourceLoc=norm(typeof locationOf==='function'?locationOf(source):source.fila_scaffale),sourcePal=norm(source.bancale);
    openStockEdit();$id('stockEditLocation').value=sourceLoc;$id('stockEditPallet').value=sourcePal;loadStockPallet();
    let draft=null;try{draft=stockEditRowsDraft.find(r=>normalizedArticle(r.article_base)===normalizedArticle(source.article_base)&&norm(r.size)===norm(source.size)&&norm(r.state)===norm(source.state))}catch{}
    if(!draft){notify('La giacenza è stata trovata ma non riesco ad aprire la riga da modificare.','error');return false}
    if(cmd.quantity!==null&&cmd.quantity!==undefined)draft.quantity=Math.max(0,Number(cmd.quantity)||0);if(cmd.state)draft.state=cmd.state;if(cmd.targetLocation)draft.fila_scaffale=cmd.targetLocation;if(cmd.targetPallet)draft.bancale=cmd.targetPallet;
    try{renderStockEditRows();setStatus?.('stockEditSearchStatus','Comando vocale applicato. Controlla attentamente i valori e poi premi SALVA MODIFICHE.','good')}catch{}
    notify('Modifica preparata. Controlla i valori e premi SALVA MODIFICHE.','good');return true;
  }
  function execute(cmd){
    if(!cmd?.action){notify('Inizia il comando con CERCA, CARICA, SCARICA oppure MODIFICA.','warn');return false}
    if(cmd.action==='CERCA')return executeSearch(cmd);if(cmd.action==='CARICA'||cmd.action==='SCARICA')return executeOperation(cmd);if(cmd.action==='MODIFICA')return executeModify(cmd);return false;
  }

  function makeContextBlock(id,label,hint){
    const block=document.createElement('div');block.id=id;block.className='voiceContextBlock';block.innerHTML=`<button type="button" class="voiceBtn"><span class="voiceMicPulse">🎙</span> ${html(label)}</button><div class="voiceStatus" aria-live="polite"></div>`;block.querySelector('button').addEventListener('click',()=>start(hint));return block;
  }
  function installUi(){
    if(typeof document==='undefined')return false;
    const grid=document.querySelector('#home .homeGrid');if(grid&&!$id('voiceCommandPanel')){const panel=document.createElement('div');panel.id='voiceCommandPanel';panel.className='voiceCommandPanel';panel.innerHTML='<div class="voiceCommandTop"><div class="voiceCommandIcon">🎙</div><div class="voiceCommandCopy"><b>Comando vocale</b><small>Di’: “Cerca…”, “Carica…”, “Scarica…” oppure “Modifica…”</small></div></div><button type="button" class="voiceBtn"><span class="voiceMicPulse">🎙</span> PARLA</button><div class="voiceStatus" aria-live="polite"></div>';panel.querySelector('button').addEventListener('click',()=>start('AUTO'));grid.parentNode.insertBefore(panel,grid)}
    const search=$id('searchScreen');if(search&&!$id('voiceSearchBlock')){const card=search.querySelector('.card');card?.appendChild(makeContextBlock('voiceSearchBlock','CERCA CON LA VOCE','CERCA'))}
    const op=$id('operation');if(op&&!$id('voiceOperationBlock')){const h=op.querySelector('h1');h?.insertAdjacentElement('afterend',makeContextBlock('voiceOperationBlock','DETTA OPERAZIONE','AUTO'))}
    const edit=$id('stockEditScreen');if(edit&&!$id('voiceModifyBlock')){const card=edit.querySelector('.card');card?.appendChild(makeContextBlock('voiceModifyBlock','MODIFICA CON LA VOCE','MODIFICA'))}
    return true;
  }

  window.WarehouseVoiceCommands={version:VERSION,clean,normalizedArticle,parseQuantity,parseCommand,currentHint,start,stop,execute,executeSearch,executeOperation,executeModify,installUi};
  if(typeof document!=='undefined')installUi();
})();
