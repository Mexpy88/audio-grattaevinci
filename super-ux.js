/* Super UX — dashboard, ricerca avanzata, posizione facoltativa, login robusto,
   pre-conferme, undo, barcode, registro avanzato, checkpoint e versionamento master. */
(function installWarehouseSuperUX(){
  'use strict';

  const UX_VERSION='2026.08.19-super1';
  const META_KEY='so_local_master_meta_v3';
  const CHECKPOINT_KEY='so_super_checkpoint_v1';
  const VALID_STATES=['NUOVO','SCARICATO','USATO'];
  let renderTimer=null;
  let importCandidate={name:'',version:null,hasAppData:false,promise:null};
  let undoPayload=null;
  let undoTimer=null;
  let quickSeed=null;
  let scannerState=null;

  const byId=id=>document.getElementById(id);
  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const html=v=>typeof esc==='function'?esc(v):text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const nowIso=()=>new Date().toISOString();

  function readMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch{return {}}}
  function dirtyCount(){
    const m=readMeta(),base=m.lastExportAt||m.importedAt;
    if(!base)return Array.isArray(db?.audits)?db.audits.length:0;
    const t=new Date(base).getTime();
    return (db?.audits||[]).filter(a=>new Date(a.at||0).getTime()>t).length;
  }
  function fmtWhen(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
  function currentVersion(){return Math.max(1,Number(db?.app_meta?.master_version)||1)}
  function ensureAppMeta(){
    if(!db||typeof db!=='object')return;
    db.app_meta=db.app_meta||{};
    if(db?.master?.rows?.length&&!Number(db.app_meta.master_version))db.app_meta.master_version=1;
    db.app_meta.ux_version=UX_VERSION;
  }
  function checkpoint(){
    try{
      localStorage.setItem(CHECKPOINT_KEY,JSON.stringify({at:nowIso(),master:db?.master?.filename||'',version:currentVersion(),moves:(db?.movements||[]).length,docs:(db?.documents||[]).length,requests:(db?.requests||[]).length,dirty:dirtyCount()}));
    }catch{}
  }
  function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{renderDashboard();enhanceRegistryFilters();},35)}

  function ensureModal(){
    let dlg=byId('uxModal');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='uxModal';dlg.className='uxModal';
    dlg.innerHTML='<div class="uxModalHead"><h2 id="uxModalTitle"></h2><button type="button" class="uxModalClose" aria-label="Chiudi">×</button></div><div id="uxModalBody" class="uxModalBody"></div><div id="uxModalActions" class="uxModalActions"></div>';
    document.body.appendChild(dlg);
    return dlg;
  }
  function uxModal({title,body,actions=[{label:'CHIUDI',value:'close',kind:'primary'}],dismissValue='cancel'}){
    return new Promise(resolve=>{
      const dlg=ensureModal(),titleEl=byId('uxModalTitle'),bodyEl=byId('uxModalBody'),acts=byId('uxModalActions'),close=dlg.querySelector('.uxModalClose');
      titleEl.textContent=title;bodyEl.innerHTML=body;acts.innerHTML='';acts.classList.toggle('one',actions.length===1);
      let settled=false;const finish=v=>{if(settled)return;settled=true;try{dlg.close()}catch{}resolve(v)};
      close.onclick=()=>finish(dismissValue);
      for(const a of actions){const b=document.createElement('button');b.type='button';b.className=`uxBtn ${a.kind||'soft'}`;b.textContent=a.label;b.onclick=()=>finish(a.value);acts.appendChild(b)}
      dlg.oncancel=e=>{e.preventDefault();finish(dismissValue)};
      dlg.showModal();
    });
  }

  function toast(msg,type='success'){if(typeof warehouseToast==='function')warehouseToast(msg,type);else console.log('[SUPER UX]',msg)}

  function integrityReport(){
    const rows=db?.master?.rows||[],seen=new Map();let missingArticle=0,missingPallet=0,unassigned=0,invalidState=0,invalidQty=0;
    for(const r of rows){
      if(!norm(r.article_base))missingArticle++;
      if(!norm(r.bancale))missingPallet++;
      if(!norm(typeof locationOf==='function'?locationOf(r):r.fila_scaffale))unassigned++;
      if(!VALID_STATES.includes(norm(r.state)))invalidState++;
      if(!Number.isFinite(Number(r.quantity))||Number(r.quantity)<0)invalidQty++;
      const key=typeof bucketKey==='function'?bucketKey(r):[norm(r.article_base),norm(r.size),norm(r.state),norm(r.fila_scaffale),norm(r.bancale)].join('|');
      seen.set(key,(seen.get(key)||0)+1);
    }
    let duplicates=0;for(const n of seen.values())if(n>1)duplicates+=n-1;
    const blocking=missingArticle+missingPallet+invalidState+invalidQty;
    return {rows:rows.length,missingArticle,missingPallet,unassigned,invalidState,invalidQty,duplicates,blocking,ok:blocking===0};
  }

  function ensureDashboard(){
    const panel=byId('localMasterPanel');if(!panel)return null;
    let d=byId('uxMasterDashboard');
    if(!d){
      d=document.createElement('div');d.id='uxMasterDashboard';d.className='uxMasterDashboard';
      const buttons=panel.querySelector('.lmButtons');panel.insertBefore(d,buttons||null);
      const actions=document.createElement('div');actions.id='uxMasterActions';actions.className='uxMasterActions';
      actions.innerHTML='<button type="button" class="uxMiniBtn primary" id="uxIntegrityBtn">✓ VERIFICA MASTER</button><button type="button" class="uxMiniBtn" id="uxSessionBtn">↻ STATO SESSIONE</button>';
      panel.insertBefore(actions,buttons||null);
      byId('uxIntegrityBtn').onclick=showIntegrity;
      byId('uxSessionBtn').onclick=showSessionState;
    }
    return d;
  }

  function ensureDirtyBar(){
    let bar=byId('uxDirtyBar');if(bar)return bar;
    bar=document.createElement('div');bar.id='uxDirtyBar';bar.className='uxDirtyBar hidden';
    bar.innerHTML='<div class="uxDirtyText" id="uxDirtyText"></div><button type="button" id="uxDirtyExport">ESPORTA ORA</button>';
    document.body.appendChild(bar);
    byId('uxDirtyExport').onclick=()=>window.LocalMaster?.exportUpdatedMaster?.();
    return bar;
  }

  function renderDashboard(){
    ensureAppMeta();
    const d=ensureDashboard(),bar=ensureDirtyBar();if(!d||!bar)return;
    const loaded=!!db?.master?.rows?.length,dirty=dirtyCount(),m=readMeta(),rep=loaded?integrityReport():null;
    const buckets=loaded&&typeof stockBuckets==='function'?stockBuckets():[];
    const totalQty=buckets.reduce((a,s)=>a+Number(s.quantity||0),0),openReq=(db?.requests||[]).filter(r=>r.status!=='COMPLETATA').length;
    d.innerHTML=loaded?`<div class="uxMetric"><b>v${currentVersion()}</b><span>VERSIONE MASTER</span></div><div class="uxMetric"><b>${buckets.length.toLocaleString('it-IT')}</b><span>GIACENZE ATTIVE</span></div><div class="uxMetric"><b>${totalQty.toLocaleString('it-IT')}</b><span>PEZZI TOTALI</span></div><div class="uxMetric ${openReq?'warn':'good'}"><b>${openReq}</b><span>RICHIESTE APERTE</span></div><div class="uxMetric ${rep?.ok?'good':'error'}"><b>${rep?.ok?'OK':rep?.blocking}</b><span>INTEGRITÀ MASTER</span></div><div class="uxMetric ${rep?.unassigned?'warn':'good'}"><b>${rep?.unassigned||0}</b><span>SENZA FILA/SCAFFALE</span></div>`:'';
    if(loaded&&dirty>0){bar.classList.remove('hidden');byId('uxDirtyText').innerHTML=`<b>${dirty} modifiche da esportare</b><br>Ultimo export: ${html(fmtWhen(m.lastExportAt))}`}
    else bar.classList.add('hidden');
    const lmState=byId('lmState');if(lmState&&loaded)lmState.title=`Versione master v${currentVersion()}`;
  }

  async function showIntegrity(){
    if(!db?.master?.rows?.length)return uxModal({title:'Nessun master',body:'<p>Importa prima il file Excel master.</p>',actions:[{label:'CHIUDI',value:'close',kind:'primary'}]});
    const r=integrityReport();
    await uxModal({title:r.ok?'Master verificato':'Controllo Master',body:`<p><b>${r.rows.toLocaleString('it-IT')}</b> giacenze importate.</p><table class="uxTable"><tbody><tr><td>Articoli mancanti</td><td><b>${r.missingArticle}</b></td></tr><tr><td>Bancale/Carrello mancante</td><td><b>${r.missingPallet}</b></td></tr><tr><td>Stato non valido</td><td><b>${r.invalidState}</b></td></tr><tr><td>Quantità non valida</td><td><b>${r.invalidQty}</b></td></tr><tr><td>Duplicati identici</td><td><b>${r.duplicates}</b></td></tr><tr><td>Senza Fila/Scaffale <small>(consentito)</small></td><td><b>${r.unassigned}</b></td></tr></tbody></table>${r.ok?'<p>✓ Il master è utilizzabile. Le righe senza Fila/Scaffale restano valide e sono ricercabili tramite Bancale/Carrello.</p>':'<p>Le anomalie evidenziate non vengono corrette automaticamente: conviene verificarle prima dell’export definitivo.</p>'}`,actions:[{label:'CHIUDI',value:'close',kind:r.ok?'success':'primary'}]});
  }
  async function showSessionState(){
    const m=readMeta();let cp={};try{cp=JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||'{}')}catch{}
    await uxModal({title:'Stato sessione',body:`<p><b>Master:</b> ${html(db?.master?.filename||'—')}<br><b>Versione:</b> v${currentVersion()}<br><b>Importato:</b> ${html(fmtWhen(db?.master?.imported_at))}<br><b>Ultimo export:</b> ${html(fmtWhen(m.lastExportAt))}<br><b>Ultimo autosave:</b> ${html(fmtWhen(cp.at))}</p><p><b>${dirtyCount()}</b> modifiche sono attualmente in attesa di export.</p><p>Le operazioni vengono salvate automaticamente nel browser dopo ogni modifica.</p>`,actions:[{label:'CHIUDI',value:'close',kind:'primary'}]});
  }

  function makeLocationOptional(){
    const loc=byId('filaScaffale'),pal=byId('bancale');
    if(loc){const label=loc.closest('label');if(label&&!label.dataset.uxOptional){label.dataset.uxOptional='1';label.childNodes.forEach(n=>{if(n.nodeType===3&&/Fila\/Scaffale/i.test(n.textContent||''))n.textContent='Fila/Scaffale (facoltativo)'});const note=document.createElement('small');note.className='uxOptionalNote';note.textContent='Può rimanere vuoto se il bancale/carrello non è ancora assegnato.';label.appendChild(note)}loc.placeholder='Facoltativo · es. 69'}
    if(pal){const label=pal.closest('label');if(label&&!label.dataset.uxRequired){label.dataset.uxRequired='1';label.childNodes.forEach(n=>{if(n.nodeType===3&&/Bancale/i.test(n.textContent||''))n.textContent='Bancale / Carrello *'});pal.placeholder='Obbligatorio · es. 38 o CARRELLO 7'}}
    const seLoc=byId('stockEditLocation'),sePal=byId('stockEditPallet');
    if(seLoc){const l=seLoc.closest('label');if(l&&!l.dataset.uxOptional){l.dataset.uxOptional='1';l.childNodes.forEach(n=>{if(n.nodeType===3&&/Fila\/Scaffale/i.test(n.textContent||''))n.textContent='Fila/Scaffale (facoltativo)'});const n=document.createElement('small');n.className='uxOptionalNote';n.textContent='Lascia vuoto per cercare il bancale/carrello in qualsiasi posizione.';l.appendChild(n)}}
    if(sePal){const l=sePal.closest('label');if(l)l.childNodes.forEach(n=>{if(n.nodeType===3&&/^Bancale/i.test((n.textContent||'').trim()))n.textContent='Bancale / Carrello *'})}
    window.validateLocation=function(){const p=norm(byId('bancale')?.value);if(!p){alert('Inserisci almeno il Bancale / Carrello. Fila/Scaffale può rimanere vuoto.');byId('bancale')?.focus();return false}return true};
  }

  function hardenLogin(){
    const original=window.submitLogin;if(typeof original!=='function'||original.__uxWrapped)return;
    const wrapped=async function(){
      const err=byId('loginError'),input=byId('pinInput'),pin=text(input?.value).replace(/\D/g,'').slice(0,4);
      if(err){err.classList.add('hidden');err.classList.remove('uxVisible')}
      if(pin.length!==4){if(err){err.textContent='PIN non valido: inserisci esattamente 4 cifre.';err.classList.remove('hidden');err.classList.add('uxVisible')}input?.classList.add('uxShake');setTimeout(()=>input?.classList.remove('uxShake'),320);input?.focus();return}
      try{await original.apply(this,arguments)}catch(e){console.error('Errore login',e);if(err){err.textContent='Impossibile verificare il PIN. Riprova.';err.classList.remove('hidden');err.classList.add('uxVisible')}}
      if(!currentUser){if(err){err.textContent='PIN errato. Controlla le 4 cifre e riprova.';err.classList.remove('hidden');err.classList.add('uxVisible')}input?.classList.add('uxShake');setTimeout(()=>input?.classList.remove('uxShake'),320)}
    };
    wrapped.__uxWrapped=true;window.submitLogin=wrapped;
    const input=byId('pinInput');if(input&&!input.dataset.uxLogin){input.dataset.uxLogin='1';input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();window.submitLogin()}});input.addEventListener('input',()=>{const err=byId('loginError');err?.classList.add('hidden');err?.classList.remove('uxVisible')})}
  }

  function enhanceSearch(){
    const input=byId('searchInput');if(!input)return;
    const card=input.closest('.card');if(!card)return;
    if(!byId('uxSearchTools')){
      const box=document.createElement('div');box.id='uxSearchTools';
      box.innerHTML='<div class="uxSearchTools"><select id="uxSearchState" class="field"><option value="">TUTTI GLI STATI</option><option>NUOVO</option><option>SCARICATO</option><option>USATO</option></select><button type="button" id="uxBarcodeBtn" class="uxScanBtn">▦ SCANSIONA</button></div><div class="uxSearchSummary" id="uxSearchSummary">Cerca per articolo, taglia, stato, Fila/Scaffale o Bancale/Carrello.</div>';
      card.appendChild(box);byId('uxSearchState').onchange=()=>window.renderStock();byId('uxBarcodeBtn').onclick=startBarcodeScanner;
      input.placeholder='Articolo, taglia, fila, bancale/carrello…';
    }
  }

  function rowMatchesSearch(s,q){
    const tokens=norm(q).split(/\s+/).filter(Boolean);if(!tokens.length)return true;
    const hay=[s.article_base,s.size,s.state,typeof locationOf==='function'?locationOf(s):s.fila_scaffale,s.bancale].map(norm).join(' ');
    return tokens.every(t=>hay.includes(t));
  }
  function renderAdvancedStock(){
    enhanceSearch();const q=byId('searchInput')?.value||'',state=norm(byId('uxSearchState')?.value),all=typeof stockBuckets==='function'?stockBuckets():[];
    const rows=all.filter(s=>rowMatchesSearch(s,q)&&(!state||norm(s.state)===state));
    const total=rows.reduce((a,s)=>a+Number(s.quantity||0),0);const summary=byId('uxSearchSummary');if(summary)summary.textContent=`${rows.length} giacenze · ${total.toLocaleString('it-IT')} pezzi`;
    const list=byId('stockList');if(!list)return;
    list.innerHTML=rows.length?rows.slice(0,300).map(s=>{const loc=norm(typeof locationOf==='function'?locationOf(s):s.fila_scaffale);const payload=encodeURIComponent(JSON.stringify({article_base:s.article_base,size:s.size||'',state:s.state||'NUOVO',fila_scaffale:loc,bancale:s.bancale||''}));return `<div class="stockCard ${loc?'':'uxPositionMissing'}"><div class="stockTop"><div><div class="sku">${html(s.article_base)} ${s.size?`· ${html(s.size)}`:''}</div><div class="dateLine">${html(s.state)}</div></div><div class="bigQty">${Number(s.quantity||0)}</div></div><div class="meta"><span>Fila/Scaffale ${html(loc||'NON ASSEGNATO')}</span><span>Bancale/Carrello ${html(s.bancale||'—')}</span></div><div class="uxQuickActions"><button type="button" class="uxQuickOut" onclick="uxQuickOperation('SCARICA','${payload}')">SCARICA</button><button type="button" class="uxQuickIn" onclick="uxQuickOperation('CARICA','${payload}')">CARICA</button><button type="button" class="uxQuickEdit" onclick="uxQuickEdit('${payload}')">MODIFICA</button></div></div>`}).join(''):'<p>Nessuna giacenza trovata.</p>';
    if(rows.length>300)list.insertAdjacentHTML('beforeend',`<div class="status warn">Mostro i primi 300 risultati su ${rows.length}. Restringi la ricerca.</div>`);
  }

  window.uxQuickOperation=function(type,payload){
    try{quickSeed=JSON.parse(decodeURIComponent(payload))}catch{return}
    window.openOperation(type);setTimeout(()=>{if(byId('filaScaffale'))byId('filaScaffale').value=quickSeed.fila_scaffale||'';if(byId('bancale'))byId('bancale').value=quickSeed.bancale||'';const manual=[...document.querySelectorAll('#operation .btn.soft')].find(b=>/INSERISCI MANUALMENTE/i.test(b.textContent));if(manual)manual.textContent=`INSERISCI ${quickSeed.article_base}${quickSeed.size?' · '+quickSeed.size:''} MANUALMENTE`},0);
  };
  window.uxQuickEdit=function(payload){
    let s;try{s=JSON.parse(decodeURIComponent(payload))}catch{return}
    window.openStockEdit();setTimeout(()=>{if(byId('stockEditLocation'))byId('stockEditLocation').value=s.fila_scaffale||'';if(byId('stockEditPallet'))byId('stockEditPallet').value=s.bancale||'';window.loadStockPallet?.()},0);
  };

  function wrapManualEntry(){
    const original=window.startManualEntry;if(typeof original!=='function'||original.__uxWrapped)return;
    const wrapped=function(){const out=original.apply(this,arguments);if(quickSeed&&Array.isArray(importedPhotos)&&importedPhotos[0]?.groups?.[0]){const g=importedPhotos[0].groups[0],v=g.variants?.[0];g.article_base=quickSeed.article_base||'';if(v){v.size=quickSeed.size||'';v.state=quickSeed.state||'NUOVO';v.quantity=0}quickSeed=null;window.renderResults?.()}return out};wrapped.__uxWrapped=true;window.startManualEntry=wrapped;
  }

  async function startBarcodeScanner(){
    if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia)return uxModal({title:'Scanner non disponibile',body:'<p>Questo browser non espone lo scanner barcode nativo. Puoi comunque cercare digitando il codice articolo o il bancale/carrello.</p>',actions:[{label:'CHIUDI',value:'close',kind:'primary'}]});
    if(scannerState)return;
    let dlg=byId('uxScanDialog');if(!dlg){dlg=document.createElement('dialog');dlg.id='uxScanDialog';dlg.className='uxScanDialog';dlg.innerHTML='<div class="uxScanTop"><b>Scansiona codice</b><button type="button" id="uxScanClose">×</button></div><video id="uxScanVideo" class="uxScanVideo" autoplay playsinline muted></video><div class="uxScanHint">Inquadra il barcode o QR. La ricerca partirà automaticamente.</div>';document.body.appendChild(dlg);byId('uxScanClose').onclick=stopBarcodeScanner}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});const video=byId('uxScanVideo');video.srcObject=stream;dlg.showModal();
      const detector=new BarcodeDetector({formats:['code_128','code_39','ean_13','ean_8','qr_code','data_matrix','itf']});scannerState={stream,detector,active:true};
      const loop=async()=>{if(!scannerState?.active)return;try{if(video.readyState>=2){const codes=await detector.detect(video);if(codes?.length){const value=text(codes[0].rawValue).trim();stopBarcodeScanner();if(value&&byId('searchInput')){byId('searchInput').value=value;window.renderStock();toast(`Codice rilevato: ${value}`)}return}}}catch{}setTimeout(loop,260)};loop();
    }catch(e){console.error(e);stopBarcodeScanner();uxModal({title:'Fotocamera non disponibile',body:'<p>Non è stato possibile aprire la fotocamera. Controlla il permesso del browser oppure usa la ricerca manuale.</p>',actions:[{label:'CHIUDI',value:'close',kind:'primary'}]})}
  }
  function stopBarcodeScanner(){if(!scannerState){try{byId('uxScanDialog')?.close()}catch{}return}scannerState.active=false;scannerState.stream?.getTracks?.().forEach(t=>t.stop());scannerState=null;try{byId('uxScanDialog')?.close()}catch{}}
  window.startBarcodeScanner=startBarcodeScanner;window.stopBarcodeScanner=stopBarcodeScanner;

  function enhanceRegistryFilters(){
    const host=byId('registryFilters');if(!host)return;
    let box=byId('uxRegBox');if(!box){box=document.createElement('div');box.id='uxRegBox';box.className='uxRegBox';box.innerHTML='<div class="uxRegGrid"><input id="uxRegSearch" class="field" placeholder="Cerca articolo, documento, bancale…"><select id="uxRegOperator" class="field"><option value="">TUTTI GLI OPERATORI</option></select><select id="uxRegType" class="field"><option value="">TUTTE LE OPERAZIONI</option><option>CARICA</option><option>SCARICA</option></select><select id="uxRegState" class="field"><option value="">TUTTI GLI STATI</option><option>NUOVO</option><option>SCARICATO</option><option>USATO</option></select></div><div id="uxRegCount" class="uxRegCount"></div>';host.appendChild(box);['uxRegSearch','uxRegOperator','uxRegType','uxRegState'].forEach(id=>{const el=byId(id);el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>window.renderRegistry())})}
    const sel=byId('uxRegOperator');if(sel){const cur=sel.value,ops=[...new Set((db?.movements||[]).map(m=>m.operator).filter(Boolean))].sort();sel.innerHTML='<option value="">TUTTI GLI OPERATORI</option>'+ops.map(o=>`<option ${o===cur?'selected':''}>${html(o)}</option>`).join('')}
  }

  function renderAdvancedRegistry(){
    enhanceRegistryFilters();const dest=byId('regDest')?.value||'',q=norm(byId('uxRegSearch')?.value),op=norm(byId('uxRegOperator')?.value),typ=norm(byId('uxRegType')?.value),state=norm(byId('uxRegState')?.value),list=byId('registryList');if(!list)return;
    if(registryTab==='MOVIMENTI'){
      const rows=(db?.movements||[]).filter(m=>registryDateMatch(m.operation_at)&&(!dest||m.destination===dest)&&(!op||norm(m.operator)===op)&&(!typ||norm(m.movement_type)===typ)&&(!state||norm(m.state)===state)).filter(m=>{if(!q)return true;const hay=[m.article_base,m.size,m.state,m.movement_type,m.operator,m.document_id,typeof locationOf==='function'?locationOf(m):m.fila_scaffale,m.bancale,m.destination,m.note].map(norm).join(' ');return hay.includes(q)});
      byId('uxRegCount').textContent=`${rows.length} movimenti visualizzati`;
      list.innerHTML=rows.length?rows.map(m=>`<div class="movementCard ${m.cancelled_at?'cancelled':''}"><div class="movementTop"><div><div class="sku">${html(m.article_base)} ${m.size?`· ${html(m.size)}`:''}</div><div class="dateLine">${fmtDateTime(m.operation_at)}</div></div><div class="bigQty">${m.movement_type==='CARICA'?'+':'−'}${Number(m.quantity||0)}</div></div><div class="meta"><span>${html(m.movement_type)}</span><span>${html(m.state)}</span><span>Fila/Scaffale ${html((typeof locationOf==='function'?locationOf(m):m.fila_scaffale)||'NON ASSEGNATO')}</span><span>Bancale/Carrello ${html(m.bancale||'—')}</span>${m.destination?`<span>${html(m.destination)}</span>`:''}<span>${html(m.operator)}</span>${m.document_id?`<span>${html(m.document_id)}</span>`:''}${m.cancelled_at?'<span>ANNULLATO</span>':''}</div>${m.note?`<p>${html(m.note)}</p>`:''}${!m.cancelled_at?`<div class="actions"><button class="mini" onclick="openMovementEdit('${m.id}')">MODIFICA</button><button class="mini danger" onclick="cancelMovement('${m.id}')">ANNULLA</button></div>`:''}</div>`).join(''):'<p>Nessun movimento trovato.</p>';
    }else{
      const docs=(db?.documents||[]).filter(d=>d.type==='SCARICO'&&registryDateMatch(d.operation_at)&&(!dest||d.destination===dest)&&(!op||norm(d.operator)===op)).filter(d=>{if(!q)return true;const items=typeof documentRows==='function'?documentRows(d):[];const hay=[d.id,d.destination,d.operator,d.request_id,...items.flatMap(m=>[m.article_base,m.size,m.state,m.bancale,typeof locationOf==='function'?locationOf(m):m.fila_scaffale])].map(norm).join(' ');return hay.includes(q)});
      byId('uxRegCount').textContent=`${docs.length} scarichi visualizzati`;
      list.innerHTML=docs.length?docs.map(d=>{const items=documentRows(d),total=items.reduce((a,m)=>a+Number(m.quantity||0),0);return `<div class="documentCard"><div class="docTop"><div><div class="sku">${html(d.id)}</div><div class="dateLine">${fmtDateTime(d.operation_at)}</div></div><div class="bigQty">${total}</div></div><div class="meta"><span>${html(d.destination||'—')}</span><span>${html(d.operator)}</span><span>${items.length} righe</span>${d.request_id?`<span>${html(d.request_id)}</span>`:''}</div><div class="actions"><button class="mini" onclick="openDocument('${d.id}')">APRI</button><button class="mini" onclick="exportDocument('${d.id}')">EXCEL</button></div></div>`}).join(''):'<p>Nessuno scarico trovato.</p>';
    }
  }

  function operationPreviewRows(){const out=[];for(const p of (importedPhotos||[]))for(const g of (p.groups||[]))for(const v of (g.variants||[])){const q=Number(v.quantity)||0;if(q>0)out.push({article_base:normalizeArticle(g.article_base),size:norm(v.size),quantity:q,state:norm(v.state),note:v.note||''})}return out}
  function stockQtyFor(row,loc,pallet){const all=typeof stockBuckets==='function'?stockBuckets():[];return all.filter(s=>norm(s.article_base)===norm(row.article_base)&&norm(s.size)===norm(row.size)&&norm(s.state)===norm(row.state)&&norm(typeof locationOf==='function'?locationOf(s):s.fila_scaffale)===norm(loc)&&norm(s.bancale)===norm(pallet)).reduce((a,s)=>a+Number(s.quantity||0),0)}

  function showUndo(message,movementIds,documentIds=[]){
    if(!movementIds?.length)return;undoPayload={movementIds:[...movementIds],documentIds:[...documentIds],expires:Date.now()+15000};clearTimeout(undoTimer);
    byId('uxSnackbar')?.remove();const s=document.createElement('div');s.id='uxSnackbar';s.className='uxSnackbar';s.innerHTML=`<span>${html(message)} · Puoi annullare per 15 secondi.</span><button type="button">ANNULLA</button>`;document.body.appendChild(s);s.querySelector('button').onclick=undoLastOperation;undoTimer=setTimeout(()=>{s.classList.add('fade');setTimeout(()=>s.remove(),260);undoPayload=null},15000)
  }
  function undoLastOperation(){
    const p=undoPayload;if(!p||Date.now()>p.expires)return;const at=nowIso(),changed=[];
    for(const id of p.movementIds){const m=(db.movements||[]).find(x=>x.id===id);if(m&&!m.cancelled_at){const before=clone(m);m.cancelled_at=at;m.updated_at=at;changed.push(id);if(typeof audit==='function')audit('UNDO','MOVEMENT',m.id,before,clone(m))}}
    if(p.documentIds?.length)db.documents=(db.documents||[]).filter(d=>!p.documentIds.includes(d.id));
    if(changed.length){if(typeof audit==='function')audit('UNDO_OPERATION','SESSION',at,null,{movement_ids:changed});window.saveDb();window.renderStock?.();window.renderRegistry?.();toast('Ultima operazione annullata.','success')}
    byId('uxSnackbar')?.remove();clearTimeout(undoTimer);undoPayload=null;
  }
  window.undoLastOperation=undoLastOperation;

  function wrapOperationConfirm(){
    const original=window.confirmOperation;if(typeof original!=='function'||original.__uxWrapped)return;
    const wrapped=async function(){
      if(!window.validateLocation())return;
      const rows=operationPreviewRows();if(!rows.length)return original.apply(this,arguments);
      const loc=norm(byId('filaScaffale')?.value),pallet=norm(byId('bancale')?.value),type=operation;
      const tr=rows.map(r=>{const before=stockQtyFor(r,loc,pallet),after=type==='CARICA'?before+r.quantity:before-r.quantity;return `<tr><td>${html(r.article_base)}${r.size?'<br><small>'+html(r.size)+'</small>':''}</td><td>${html(r.state)}</td><td>${r.quantity}</td><td class="uxDelta ${type==='CARICA'?'plus':'minus'}">${before} → ${after}</td></tr>`}).join('');
      const ok=await uxModal({title:type==='CARICA'?'Conferma carico':'Conferma scarico',body:`<p><b>Bancale/Carrello:</b> ${html(pallet)}<br><b>Fila/Scaffale:</b> ${html(loc||'NON ASSEGNATO')}${type==='SCARICA'?`<br><b>Destinazione:</b> ${html(byId('destination')?.value||'')}`:''}</p><table class="uxTable"><thead><tr><th>Articolo</th><th>Stato</th><th>Qtà</th><th>Giacenza</th></tr></thead><tbody>${tr}</tbody></table>`,actions:[{label:'ANNULLA',value:'cancel',kind:'soft'},{label:type==='CARICA'?'CONFERMA CARICO':'CONFERMA SCARICO',value:'ok',kind:type==='CARICA'?'success':'danger'}]});
      if(ok!=='ok')return;
      const beforeMoves=new Set((db.movements||[]).map(m=>m.id)),beforeDocs=new Set((db.documents||[]).map(d=>d.id));
      const result=await original.apply(this,arguments);
      const newMoves=(db.movements||[]).filter(m=>!beforeMoves.has(m.id)).map(m=>m.id),newDocs=(db.documents||[]).filter(d=>!beforeDocs.has(d.id)).map(d=>d.id);
      if(newMoves.length)showUndo(type==='CARICA'?'Carico registrato':'Scarico registrato',newMoves,newDocs);
      return result;
    };wrapped.__uxWrapped=true;window.confirmOperation=wrapped;
  }

  function wrapPickingConfirm(){
    const original=window.confirmPicking;if(typeof original!=='function'||original.__uxWrapped)return;
    const wrapped=async function(){const req=(db.requests||[]).find(r=>r.id===activeRequestId);if(!req)return original.apply(this,arguments);const selected=[...(req.draft?.allocations||[]),...(req.draft?.extraAllocations||[])].filter(a=>a.checked&&Number(a.quantity)>0&&!a.missing);if(!selected.length)return original.apply(this,arguments);const total=selected.reduce((a,x)=>a+Number(x.quantity||0),0);const ok=await uxModal({title:'Conferma prelievo',body:`<p>Stai per scaricare <b>${total}</b> pezzi su <b>${selected.length}</b> righe per <b>${html(req.destination)}</b>.</p><p>La giacenza verrà verificata nuovamente al momento della conferma.</p>`,actions:[{label:'ANNULLA',value:'cancel',kind:'soft'},{label:'CONFERMA E SCARICA',value:'ok',kind:'danger'}]});if(ok!=='ok')return;return original.apply(this,arguments)};wrapped.__uxWrapped=true;window.confirmPicking=wrapped;
  }

  function installStockEditOptionalLocation(){
    if(typeof window.loadStockPallet!=='function')return;
    window.stockEditRowsAtSource=function(){return stockBuckets().filter(s=>norm(s.bancale)===norm(stockEditSource.bancale)&&(!norm(stockEditSource.fila_scaffale)||norm(locationOf(s))===norm(stockEditSource.fila_scaffale)))};
    window.loadStockPallet=function(){if(!requireLogin())return;const loc=norm(byId('stockEditLocation')?.value),pallet=norm(byId('stockEditPallet')?.value);if(!pallet){alert('Inserisci il Bancale / Carrello. Fila/Scaffale è facoltativo.');byId('stockEditPallet')?.focus();return}stockEditSource={fila_scaffale:loc,bancale:pallet};const rows=window.stockEditRowsAtSource();if(!rows.length){stockEditRowsDraft=[];byId('stockEditEditor').classList.add('hidden');setStatus('stockEditSearchStatus',`Nessuna giacenza trovata per Bancale/Carrello ${pallet}${loc?' in Fila/Scaffale '+loc:''}.`,'error');return}stockEditBuildDraft(rows);setStatus('stockEditSearchStatus',`Trovate ${rows.length} righe per ${pallet}${loc?' · Fila/Scaffale '+loc:' · qualsiasi Fila/Scaffale'}.`,'good');byId('stockEditEditor').classList.remove('hidden');renderStockEditRows()};
    window.addStockEditRow=function(){if(!norm(stockEditSource.bancale))return alert('Cerca prima il Bancale / Carrello da modificare.');stockEditRowsDraft.push({edit_id:uid(),original:null,deleted:false,article_base:'',size:'',quantity:0,state:'NUOVO',fila_scaffale:norm(stockEditSource.fila_scaffale),bancale:norm(stockEditSource.bancale)});renderStockEditRows();setTimeout(()=>{const rows=document.querySelectorAll('#stockEditRows .stockEditRow');rows[rows.length-1]?.scrollIntoView({behavior:'smooth',block:'center'})},30)};
    window.renderStockEditRows=function(){const active=stockEditRowsDraft.filter(r=>!r.deleted).length;byId('stockEditSummary').textContent=`${stockEditSource.fila_scaffale?'Fila/Scaffale '+stockEditSource.fila_scaffale+' · ':''}Bancale/Carrello ${stockEditSource.bancale} · ${active} righe attive`;byId('stockEditRows').innerHTML=stockEditRowsDraft.map(stockEditRowHtml).join('')};

    window.saveStockEdit=function(){
      if(!requireLogin())return;if(!stockEditRowsDraft.length)return alert('Cerca prima un bancale/carrello da modificare.');const specs=[];
      for(const draft of stockEditRowsDraft){const old=draft.original?stockEditNormalize(draft.original):null,next=stockEditNormalize(draft);if(!draft.deleted&&next.quantity>0){if(!next.article_base)return alert('Completa il codice articolo in tutte le righe attive.');if(!next.bancale)return alert('Completa il Bancale / Carrello in tutte le righe attive. Fila/Scaffale può rimanere vuoto.')}if(!old){if(!draft.deleted&&next.quantity>0)specs.push({type:'CARICA',row:next,quantity:next.quantity});continue}if(draft.deleted||next.quantity<=0){specs.push({type:'SCARICA',row:old,quantity:old.quantity});continue}if(bucketKey(old)===bucketKey(next)){const delta=next.quantity-old.quantity;if(delta>0)specs.push({type:'CARICA',row:next,quantity:delta});else if(delta<0)specs.push({type:'SCARICA',row:old,quantity:-delta})}else{specs.push({type:'SCARICA',row:old,quantity:old.quantity});specs.push({type:'CARICA',row:next,quantity:next.quantity})}}
      if(!specs.length)return alert('Nessuna modifica da salvare.');const discharges=specs.filter(s=>s.type==='SCARICA').map(s=>({...s.row,quantity:s.quantity})),check=validateDischargeRows(discharges);if(!check.ok)return alert(`La giacenza è cambiata e la rettifica non può essere applicata. Disponibili ${check.available}, necessari ${check.needed}. Cerca di nuovo e riprova.`);if(!confirm(`Confermi le modifiche? Verranno registrate ${specs.length} rettifiche nello storico.`))return;
      const beforeIds=new Set((db.movements||[]).map(m=>m.id)),before=stockEditRowsDraft.filter(r=>r.original).map(r=>clone(r.original)),at=nowIso();for(const s of specs){const m=stockEditMovement(s.type,s.row,s.quantity,at);db.movements.unshift(m);audit('CREATE','MOVEMENT',m.id,null,m)}const after=stockEditRowsDraft.filter(r=>!r.deleted&&Number(r.quantity)>0).map(r=>stockEditNormalize(r));audit('STOCK_EDIT','PALLET',`${stockEditSource.fila_scaffale||''}|${stockEditSource.bancale}`,before,after);window.saveDb();const remaining=window.stockEditRowsAtSource();if(remaining.length){stockEditBuildDraft(remaining);renderStockEditRows();setStatus('stockEditSearchStatus',`Modifiche salvate. Restano ${remaining.length} righe di giacenza.`,'good')}else{stockEditRowsDraft=[];byId('stockEditRows').innerHTML='';byId('stockEditEditor').classList.add('hidden');setStatus('stockEditSearchStatus','Modifiche salvate. Il bancale/carrello di origine non contiene più giacenze.','good')}window.renderStock?.();const ids=(db.movements||[]).filter(m=>!beforeIds.has(m.id)).map(m=>m.id);showUndo('Rettifica salvata',ids,[]);toast('Modifiche alla giacenza salvate.','success')
    };
  }

  function parseEmbeddedVersion(file){
    importCandidate={name:file?.name||'',version:null,hasAppData:false,promise:null};if(!file||typeof XLSX==='undefined')return Promise.resolve(importCandidate);
    const promise=file.arrayBuffer().then(buf=>{const wb=XLSX.read(buf,{type:'array',cellDates:true}),ws=wb.Sheets?.APP_DATI;if(!ws)return importCandidate;const a=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});if(text(a?.[0]?.[0])!=='SO_WAREHOUSE_APP_DATA_V3')return importCandidate;const chunks=[];for(let i=4;i<a.length;i++)if(a[i]?.[0])chunks.push(text(a[i][0]));try{const p=JSON.parse(chunks.join(''));importCandidate.hasAppData=true;importCandidate.version=Number(p?.db?.app_meta?.master_version)||1}catch{}return importCandidate}).catch(()=>importCandidate);importCandidate.promise=promise;return promise;
  }

  async function beforeMasterImport(){
    if(importCandidate.promise)await importCandidate.promise;const incoming=Number(importCandidate.version)||null,current=db?.master?.rows?.length?currentVersion():null;
    if(current&&incoming&&incoming<current){const v=await uxModal({title:'Master precedente rilevato',body:`<p>Il file selezionato è <b>versione v${incoming}</b>, mentre l’app sta lavorando con la <b>v${current}</b>.</p><p>Importandolo potresti tornare a una situazione di magazzino più vecchia.</p>`,actions:[{label:'ANNULLA',value:'cancel',kind:'soft'},{label:'IMPORTA COMUNQUE',value:'ok',kind:'danger'}]});return v==='ok'}
    return true;
  }

  function wrapExport(){
    if(!window.LocalMaster?.exportUpdatedMaster||window.LocalMaster.exportUpdatedMaster.__uxWrapped)return;
    const original=window.LocalMaster.exportUpdatedMaster.bind(window.LocalMaster);
    const wrapped=async function(){if(!db?.master?.rows?.length)return original();const counts={moves:(db.movements||[]).length,docs:(db.documents||[]).length,reqs:(db.requests||[]).length,dirty:dirtyCount()},next=currentVersion()+1;const ok=await uxModal({title:'Esporta Master aggiornato',body:`<p>Verrà creato il nuovo file <b>versione v${next}</b>.</p><table class="uxTable"><tbody><tr><td>Modifiche dall’ultimo export</td><td><b>${counts.dirty}</b></td></tr><tr><td>Movimenti storici</td><td><b>${counts.moves}</b></td></tr><tr><td>Scarichi</td><td><b>${counts.docs}</b></td></tr><tr><td>Richieste</td><td><b>${counts.reqs}</b></td></tr></tbody></table><p>Il foglio MAGAZZINO verrà aggiornato e lo storico resterà nei fogli dedicati.</p>`,actions:[{label:'ANNULLA',value:'cancel',kind:'soft'},{label:'ESPORTA v'+next,value:'ok',kind:'success'}]});if(ok!=='ok')return false;ensureAppMeta();const previous=currentVersion();db.app_meta.master_version=next;db.app_meta.last_export_started_at=nowIso();window.saveDb();let result=false;try{result=await original();if(result===false)throw new Error('Export non completato');db.app_meta.last_export_completed_at=nowIso();checkpoint();scheduleRender();return result}catch(e){db.app_meta.master_version=previous;window.saveDb();throw e}};wrapped.__uxWrapped=true;window.LocalMaster.exportUpdatedMaster=wrapped;
  }

  function installSaveCheckpoint(){
    const original=window.saveDb;if(typeof original!=='function'||original.__uxWrapped)return;const wrapped=function(){ensureAppMeta();const out=original.apply(this,arguments);checkpoint();scheduleRender();return out};wrapped.__uxWrapped=true;window.saveDb=wrapped;
  }

  function installHooks(){
    makeLocationOptional();hardenLogin();enhanceSearch();wrapManualEntry();installStockEditOptionalLocation();wrapOperationConfirm();wrapPickingConfirm();wrapExport();installSaveCheckpoint();enhanceRegistryFilters();
    window.renderStock=renderAdvancedStock;window.renderRegistry=renderAdvancedRegistry;
    const input=byId('masterInput');if(input&&!input.dataset.uxVersionProbe){input.dataset.uxVersionProbe='1';input.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)parseEmbeddedVersion(f)},true)}
    window.WarehouseUX={version:UX_VERSION,beforeMasterImport,renderDashboard,showIntegrity,startBarcodeScanner,stopBarcodeScanner};
    window.addEventListener('beforeunload',e=>{if(dirtyCount()>0){e.preventDefault();e.returnValue=''}});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){scheduleRender();window.renderStock?.()}});
    scheduleRender();
    setTimeout(()=>{const cp=(()=>{try{return JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||'{}')}catch{return {}}})();if(db?.master?.rows?.length&&dirtyCount()>0&&cp.at)toast(`Sessione ripristinata: ${dirtyCount()} modifiche non ancora esportate.`,'success')},450);
  }

  installHooks();
})();
