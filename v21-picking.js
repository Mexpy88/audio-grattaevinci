/* NOVA V21 — patch incrementale sopra V20.
   Ambito esclusivo: conferma progressiva dei prelievi, persistenza bozze,
   eccedenze fisiche senza giacenze negative, Audit e UX correlate. */
(()=>{
'use strict';
const V21_BASE_COMMIT='2d6d7de042d36a957f05d7f5b04bea0a39764009';
const V21_BUILD='NOVA_V21_PICKING_2026-09-02';
if(!globalThis.NOVA){console.error('[NOVA V21] NOVA non disponibile');return}
const {ui,domain,store}=globalThis.NOVA;

const activeDeliveries=request=>(request?.deliveries||[]).filter(d=>!d.cancelledAt);
const activeAlerts=request=>(request?.inventoryAlerts||[]).filter(a=>!a.resolvedAt);
const rowDraftKey=(lineId,sourceKey)=>`${lineId}::${sourceKey}`;
const inventoryNote=({location,pallet,availableBefore,actualPieces})=>`INVENTARIO RICHIESTO · Fila/Scaffale ${location||'—'} · Bancale ${pallet||'—'} · gestionale ${availableBefore} pezzi · prelevati ${actualPieces} pezzi · giacenza portata a 0.`;
const joinNotes=(manual,automatic)=>[String(manual||'').trim(),String(automatic||'').trim()].filter(Boolean).join(' · ');

/* ---------------------------------------------------------
   Dominio: avanzamento confermato e contabilizzazione sicura
   --------------------------------------------------------- */
domain.requests.deliveredForLine=function(request,lineId){
  let cartons=0,pieces=0;
  for(const delivery of activeDeliveries(request))for(const item of delivery.items||[])if(item.lineId===lineId&&!item.extra){cartons+=integer(item.cartons);pieces+=integer(item.pieces)}
  return{cartons,pieces};
};

domain.requests.fulfill=function(requestId,picks,note=''){
  if(!this.auth.can('REQUEST_PROCESS'))throw new Error('Operazione non autorizzata.');
  const request=this.store.db.requests.find(x=>x.id===requestId);
  if(!request)throw new Error('Richiesta non trovata.');
  if(['ANNULLATA','CHIUSA PARZIALE','COMPLETATA'].includes(request.status))throw new Error('La richiesta è già chiusa e non può essere lavorata.');
  const rawPicks=(picks||[]).filter(p=>integer(p.pieces??p.quantity)>0||integer(p.cartons)>0);
  if(!rawPicks.length)throw new Error('Inserisci almeno un prelievo con cartoni e pezzi.');

  const allocatedCartons=new Map(),availableByKey=new Map(),prepared=[];
  for(const pick of rawPicks){
    const actualPieces=integer(pick.pieces??pick.quantity),cartons=integer(pick.cartons),source=this.stock.findByKey(pick.sourceKey);
    if(!source||number(source.quantity)<=0)throw new Error('Posizione di prelievo non più disponibile. Aggiorna la schermata.');
    if(actualPieces<=0)throw new Error('Inserisci i pezzi realmente prelevati.');
    if(!pick.extra){
      const line=request.lines.find(l=>l.id===pick.lineId);
      if(!line)throw new Error('Riga richiesta non trovata.');
      if(cartons<=0)throw new Error(`Per ${line.article}${line.size?' · '+line.size:''} inserisci anche i cartoni presi.`);
      const delivered=this.deliveredForLine(request,line.id),already=allocatedCartons.get(line.id)||0,remaining=Math.max(0,line.cartonsRequested-delivered.cartons-already);
      if(cartons>remaining)throw new Error(`Troppi cartoni per ${line.article}: residui ${remaining}.`);
      allocatedCartons.set(line.id,already+cartons);
    }
    const key=pick.sourceKey,availableBefore=availableByKey.has(key)?availableByKey.get(key):Math.max(0,number(source.quantity)),stockDebitedPieces=Math.min(availableBefore,actualPieces),shortage=Math.max(0,actualPieces-stockDebitedPieces);
    availableByKey.set(key,Math.max(0,availableBefore-stockDebitedPieces));
    prepared.push({pick,source,actualPieces,cartons,availableBefore,stockDebitedPieces,shortage});
  }

  const issueId=this.issues.nextId(),createdAt=nowIso(),issue={id:issueId,createdAt,operator:this.auth.user,destination:norm(request.destination),note:String(note||'').trim(),requestId:request.id,movementIds:[],items:[],commitMode:'ROW_CONFIRM',inventoryDiscrepancy:false};
  const delivery={id:uid(),issueId,createdAt,operator:this.auth.user,note:String(note||'').trim(),items:[],commitMode:'ROW_CONFIRM'};
  request.inventoryAlerts=Array.isArray(request.inventoryAlerts)?request.inventoryAlerts:[];

  for(const row of prepared){
    const item=cleanItem(row.source),bucket=cleanBucket(row.source),automatic=row.shortage?inventoryNote({location:bucket.location,pallet:bucket.pallet,availableBefore:row.availableBefore,actualPieces:row.actualPieces}):'',movementSource={kind:'REQUEST',issueId,requestId:request.id,destination:issue.destination,note:joinNotes(note,automatic),actualPickedPieces:row.actualPieces,stockDebitedPieces:row.stockDebitedPieces,availableBefore:row.availableBefore,inventoryDiscrepancy:row.shortage>0};
    let movementId='';
    if(row.stockDebitedPieces>0){
      const event=this.issues.ledger.outgoing(item,bucket,row.stockDebitedPieces,movementSource);movementId=event.id;issue.movementIds.push(event.id);
      if(bucket.location===CONFIG.receivingLocation){
        const found=this.issues.receiving.findLineByPallet(row.source.pallet,row.source);
        if(found){const receivingBefore=number(found.line.remainingToPutAway),receivingDebited=Math.min(receivingBefore,row.stockDebitedPieces);found.line.remainingToPutAway=Math.max(0,receivingBefore-row.stockDebitedPieces);found.line.receivingMovements=found.line.receivingMovements||[];found.line.receivingMovements.push({at:createdAt,quantity:receivingDebited,stockQuantity:row.stockDebitedPieces,reason:'RICHIESTA',inventoryDiscrepancy:receivingDebited!==row.stockDebitedPieces});event.source.receiptLineId=found.line.id;event.source.receivingDebitedPieces=receivingDebited}
      }
    }
    const saved={article:item.article,size:item.size,state:item.state,pieces:row.actualPieces,cartons:row.cartons,source:bucket,movementId,lineId:row.pick.lineId||'',extra:!!row.pick.extra,stockDebitedPieces:row.stockDebitedPieces,availableBefore:row.availableBefore,inventoryShortage:row.shortage,note:automatic};
    issue.items.push(saved);delivery.items.push(clone(saved));
    if(row.shortage){
      issue.inventoryDiscrepancy=true;
      const alert={id:uid(),createdAt,requestId:request.id,issueId,deliveryId:delivery.id,lineId:saved.lineId,article:item.article,size:item.size,state:item.state,location:bucket.location,pallet:bucket.pallet,availableBefore:row.availableBefore,actualPieces:row.actualPieces,stockDebitedPieces:row.stockDebitedPieces,shortage:row.shortage,note:automatic,resolvedAt:'',resolvedBy:''};
      request.inventoryAlerts.push(alert);
      this.audit.record('INVENTORY_CHECK_REQUIRED','STOCK',bucketKey({...item,...bucket}),{quantity:row.availableBefore},{quantity:0},{requestId:request.id,issueId,deliveryId:delivery.id,article:item.article,size:item.size,state:item.state,location:bucket.location,pallet:bucket.pallet,availableBefore:row.availableBefore,actualPickedPieces:row.actualPieces,stockDebitedPieces:row.stockDebitedPieces,shortage:row.shortage,note:automatic});
    }
  }

  issue.note=joinNotes(note,issue.items.map(x=>x.note).filter(Boolean).join(' · '));
  delivery.note=issue.note;
  this.store.db.issues.unshift(issue);request.deliveries.push(delivery);
  const beforeStatus=request.status,summary=this.summary(request);request.status=summary.remaining===0?'COMPLETATA':summary.delivered>0?'PARZIALE':'DA PREPARARE';request.completedAt=request.status==='COMPLETATA'?nowIso():'';
  this.notifications.create({recipient:request.operator||'Lina',title:`Richiesta ${request.status.toLowerCase()} · ${request.id}`,body:`${summary.delivered}/${summary.requested} cartoni · ${summary.pieces} pezzi prelevati`,type:'REQUEST_PROGRESS',entityType:'REQUEST',entityId:request.id});
  this.audit.record('REQUEST_PICK_CONFIRMED','REQUEST',request.id,{status:beforeStatus},{status:request.status,issueId,deliveryId:delivery.id,summary},{commitMode:'ROW_CONFIRM',items:clone(delivery.items),inventoryDiscrepancy:issue.inventoryDiscrepancy});
  this.audit.record('ISSUE_CONFIRMED','ISSUE',issueId,null,issue);
  this.store.save('request:pick-confirm');
  return issue;
};

domain.requests.reopenDelivery=function(requestId,deliveryId,reason='CORREZIONE PRELIEVO'){
  if(!this.auth.can('REQUEST_PROCESS'))throw new Error('Operazione non autorizzata.');
  const request=this.store.db.requests.find(x=>x.id===requestId),delivery=request?.deliveries?.find(d=>d.id===deliveryId&&!d.cancelledAt);
  if(!request||!delivery)throw new Error('Prelievo confermato non trovato.');
  if(delivery.commitMode!=='ROW_CONFIRM')throw new Error('Questo prelievo storico non può essere riaperto da questa schermata.');
  const before=clone(delivery),at=nowIso();
  for(const item of delivery.items||[]){
    if(!item.movementId)continue;
    const event=this.store.db.ledger.find(e=>e.id===item.movementId&&!e.cancelledAt);if(!event)throw new Error('Movimento del prelievo non più disponibile.');
    event.cancelledAt=at;event.cancelledBy=this.auth.user;event.cancelReason=reason;
    if(event.source?.receiptLineId)this.issues.receiving.restoreToReceiving(event.source.receiptLineId,event.source.receivingDebitedPieces??event.quantity);
  }
  const issue=this.store.db.issues.find(x=>x.id===delivery.issueId);if(issue&&!issue.cancelledAt){issue.cancelledAt=at;issue.cancelledBy=this.auth.user;issue.cancelReason=reason}
  delivery.cancelledAt=at;delivery.cancelledBy=this.auth.user;delivery.cancelReason=reason;
  for(const alert of request.inventoryAlerts||[])if(alert.deliveryId===delivery.id&&!alert.resolvedAt){alert.resolvedAt=at;alert.resolvedBy=this.auth.user;alert.resolution='PRELIEVO RIAPERTO'}
  this.stock.invalidate?.();
  const summary=this.summary(request);request.status=summary.remaining===0?'COMPLETATA':summary.delivered>0?'PARZIALE':'DA PREPARARE';request.completedAt=request.status==='COMPLETATA'?request.completedAt||at:'';
  this.audit.record('REQUEST_PICK_REOPENED','REQUEST',request.id,before,delivery,{deliveryId:delivery.id,issueId:delivery.issueId,reason,summary});
  this.store.save('request:pick-reopen');
  return{request,delivery,before,summary};
};

/* ---------------------------------------------------------
   Bozze locali: conservano digitazione, non avanzamento
   --------------------------------------------------------- */
ui.ensureRequestPickDraft=function(requestId){
  this.store.db.settings.requestPickDrafts=this.store.db.settings.requestPickDrafts||{};
  return this.store.db.settings.requestPickDrafts[requestId]||(this.store.db.settings.requestPickDrafts[requestId]={note:'',rows:{},updatedAt:nowIso()});
};
ui.saveRequestPickDraft=function(requestId){const d=this.ensureRequestPickDraft(requestId);d.updatedAt=nowIso();this.store.save('request:pick-draft');return d};
ui.clearRequestPickDraftRow=function(requestId,lineId,sourceKey){const d=this.ensureRequestPickDraft(requestId);delete d.rows[rowDraftKey(lineId,sourceKey)];d.updatedAt=nowIso();this.store.save('request:pick-draft-clear')};
ui.requestConfirmedForLine=function(request,lineId){const rows=[];for(const d of activeDeliveries(request))for(const item of d.items||[])if(item.lineId===lineId&&!item.extra)rows.push({delivery:d,item});return rows};

ui.requestPick=function(id){
  const request=this.store.db.requests.find(x=>x.id===id);if(!request)return this.emptyPage('Richiesta non trovata.');
  const draft=this.ensureRequestPickDraft(id);setTimeout(()=>this.renderRequestPickSources(),0);
  return `${this.sectionTitle('PRELIEVO',request.id,'Ogni spunta salva subito cartoni, pezzi e avanzamento.')}<div class="intro good v21-pick-intro"><b>Conferma un pallet alla volta</b><span>Dopo la spunta il prelievo è salvato, la giacenza viene aggiornata e puoi uscire senza perdere il lavoro.</span></div><div id="requestPickSources" data-request="${request.id}" aria-live="polite"></div><details class="extra-pick-collapsible"><summary><span class="extra-pick-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9M9 5l8 4.5"/></svg></span><span class="extra-pick-copy"><b>Materiale non richiesto</b><small>Facoltativo · viene registrato separatamente.</small></span><span class="extra-pick-chevron" aria-hidden="true">⌄</span></summary><div class="extra-pick-body"><p class="hint">Verrà scaricato dalla giacenza, ma non modifica i cartoni richiesti.</p><label>Giacenza${this.sourceSelect('extraPickSource')}</label><div class="two"><label>Cartoni<input id="extraPickCartons" type="number" min="0" value="0" class="field"></label><label>Pezzi<input id="extraPickPieces" type="number" min="0" value="0" class="field"></label></div><button type="button" class="primary v21-extra-confirm" data-action="request-extra-confirm" data-id="${request.id}">✓ CONFERMA MATERIALE EXTRA</button></div></details><section class="form-card v21-note-card"><label>Note preparazione<textarea id="requestPickNote" class="field textarea" placeholder="Facoltative">${esc(draft.note||'')}</textarea></label></section><div class="v21-bottom-actions"><button class="workflow-cancel" data-action="workflow-back">ESCI</button><button class="soft" data-action="request-pick-done" data-id="${request.id}">APRI AVANZAMENTO</button></div>`;
};

ui.confirmedPickMarkup=function(request,lineId){
  const rows=this.requestConfirmedForLine(request,lineId);if(!rows.length)return'';
  return `<div class="v21-confirmed-list">${rows.map(({delivery,item})=>`<div class="v21-confirmed-card"><span class="v21-confirmed-check" aria-hidden="true">✓</span><span class="v21-confirmed-copy"><b>${item.source?.location===CONFIG.receivingLocation?'AREA RICEVIMENTO':`Fila/Scaffale ${esc(item.source?.location||'—')}`}</b><small>Bancale ${esc(item.source?.pallet||'—')} · ${esc(item.state||'')} · ${fmtDateTime(delivery.createdAt)}</small>${item.inventoryShortage?`<em class="v21-anomaly-pill">INVENTARIO PALLET RICHIESTO</em>`:''}</span><span class="v21-confirmed-qty"><strong>${integer(item.cartons)} · ${integer(item.pieces)}</strong><small>CARTONI · PEZZI</small></span>${delivery.commitMode==='ROW_CONFIRM'?`<button type="button" class="v21-edit-pick" data-action="request-pick-reopen" data-id="${request.id}" data-delivery="${delivery.id}" aria-label="Correggi prelievo">✎ CORREGGI</button>`:''}</div>`).join('')}</div>`;
};

ui.renderRequestPickSources=function(){
  const host=document.getElementById('requestPickSources');if(!host)return;
  const request=this.store.db.requests.find(x=>x.id===host.dataset.request);if(!request)return;
  const draft=this.ensureRequestPickDraft(request.id);
  host.innerHTML=request.lines.map(line=>{
    const done=this.domain.requests.deliveredForLine(request,line.id),remaining=Math.max(0,line.cartonsRequested-done.cartons),sources=this.domain.stock.sources(line.article,line.size),confirmed=this.confirmedPickMarkup(request,line.id);
    const sourceRows=remaining>0?sources.map((source,index)=>{const sourceKey=bucketKey(source),saved=draft.rows[rowDraftKey(line.id,sourceKey)]||{},cartons=integer(saved.cartons),pieces=integer(saved.pieces),warning=pieces>number(source.quantity);return `<div class="pick-source v21-pick-source ${source.location===CONFIG.receivingLocation?'receiving':''} ${cartons>0&&pieces>0?'is-ready':''} ${warning?'is-warning':''}" data-pick-row data-request="${request.id}" data-line="${line.id}" data-key="${esc(sourceKey)}" data-available="${number(source.quantity)}"><span class="pick-dot">${index+1}</span><span class="v21-source-copy"><b>${source.location===CONFIG.receivingLocation?'📦 AREA RICEVIMENTO':`Fila/Scaffale ${esc(source.location)}`}</b><small>Bancale ${esc(source.pallet||'—')} · ${esc(source.state)} · <strong>${source.quantity} pezzi disponibili</strong></small></span><div class="pick-pair v21-pick-pair"><label>Cartoni<input type="number" min="0" max="${remaining}" value="${cartons}" inputmode="numeric" data-pick-cartons></label><label>Pezzi<input type="number" min="0" value="${pieces}" inputmode="numeric" data-pick-pieces></label></div><div class="v21-overdraw-hint">La quantità supera i ${source.quantity} pezzi registrati. Potrai confermarla: la giacenza andrà a 0 e Nova segnalerà l’inventario di questo pallet.</div><button type="button" class="v21-confirm-pick" data-action="request-pick-confirm" data-id="${request.id}" ${cartons>0&&pieces>0?'':'disabled'}>✓ CONFERMA PRELIEVO</button></div>`}).join(''):'<div class="v21-no-source">Nessuna giacenza disponibile per i cartoni residui.</div>';
    return `<article class="pick-line v21-pick-line"><div class="v21-pick-line-head"><div><h2>${esc(line.article)}${line.size?` · ${esc(line.size)}`:''}</h2><span>${done.cartons} cartoni · ${done.pieces} pezzi già confermati</span></div><div class="v21-pick-remaining"><b>${remaining}</b><small>RESIDUI</small></div></div>${confirmed}${remaining===0?'<div class="v21-complete-line"><i>✓</i> Riga completata e salvata</div>':sourceRows}</article>`;
  }).join('');
};

ui.updateRequestPickRow=function(input){
  const row=input.closest('[data-pick-row]');if(!row)return;
  input.value=String(integer(input.value));
  const cartons=integer(row.querySelector('[data-pick-cartons]')?.value),pieces=integer(row.querySelector('[data-pick-pieces]')?.value),available=number(row.dataset.available),draft=this.ensureRequestPickDraft(row.dataset.request);
  draft.rows[rowDraftKey(row.dataset.line,row.dataset.key)]={cartons,pieces,updatedAt:nowIso()};draft.updatedAt=nowIso();
  row.classList.toggle('is-ready',cartons>0&&pieces>0);row.classList.toggle('is-warning',pieces>available);
  const button=row.querySelector('[data-action="request-pick-confirm"]');if(button)button.disabled=!(cartons>0&&pieces>0);
  this.saveRequestPickDraft(row.dataset.request);
};

ui.confirmRequestPickRow=function(requestId,button){
  const row=button.closest('[data-pick-row]');if(!row)return;
  const cartons=integer(row.querySelector('[data-pick-cartons]')?.value),pieces=integer(row.querySelector('[data-pick-pieces]')?.value),note=this.ensureRequestPickDraft(requestId).note||'';
  if(cartons<=0||pieces<=0)throw new Error('Inserisci sia i cartoni sia i pezzi realmente prelevati.');
  button.disabled=true;button.classList.add('is-saving');button.textContent='SALVATAGGIO…';
  try{this.domain.requests.fulfill(requestId,[{lineId:row.dataset.line,sourceKey:row.dataset.key,cartons,pieces}],note);this.clearRequestPickDraftRow(requestId,row.dataset.line,row.dataset.key);this.toast('✓ Prelievo confermato e salvato.');this.renderRequestPickSources()}catch(error){button.disabled=false;button.classList.remove('is-saving');button.textContent='✓ CONFERMA PRELIEVO';throw error}
};

ui.confirmRequestExtra=function(requestId,button){
  const sourceKey=document.getElementById('extraPickSource')?.value||'',cartons=integer(document.getElementById('extraPickCartons')?.value),pieces=integer(document.getElementById('extraPickPieces')?.value),note=this.ensureRequestPickDraft(requestId).note||'';
  if(!sourceKey||pieces<=0)throw new Error('Seleziona una giacenza e inserisci i pezzi extra realmente prelevati.');
  button.disabled=true;button.textContent='SALVATAGGIO…';
  try{this.domain.requests.fulfill(requestId,[{lineId:'',sourceKey,cartons,pieces,extra:true}],note);this.toast('✓ Materiale extra confermato e salvato.');this.renderView()}catch(error){if(button?.isConnected){button.disabled=false;button.textContent='✓ CONFERMA MATERIALE EXTRA'}throw error}
};

ui.reopenRequestPick=function(requestId,deliveryId){
  const request=this.store.db.requests.find(x=>x.id===requestId),delivery=request?.deliveries?.find(d=>d.id===deliveryId&&!d.cancelledAt),item=delivery?.items?.[0];if(!delivery||!item)throw new Error('Prelievo non trovato.');
  if(!confirm(`Correggere il prelievo di ${integer(item.cartons)} cartoni e ${integer(item.pieces)} pezzi?\n\nLa conferma verrà annullata, la giacenza ripristinata e i valori torneranno modificabili.`))return;
  const key=bucketKey({...item,...item.source});this.domain.requests.reopenDelivery(requestId,deliveryId);
  const draft=this.ensureRequestPickDraft(requestId);draft.rows[rowDraftKey(item.lineId,key)]={cartons:integer(item.cartons),pieces:integer(item.pieces),updatedAt:nowIso()};this.saveRequestPickDraft(requestId);
  this.toast('Prelievo riaperto: correggi i valori e conferma di nuovo.');this.renderRequestPickSources();
};

/* ---------------------------------------------------------
   Avanzamento: rende evidente l’anomalia sul pallet
   --------------------------------------------------------- */
const oldRequestCard=ui.requestCard.bind(ui);
ui.requestCard=function(request,mode){let html=oldRequestCard(request,mode);const alerts=activeAlerts(request);if(alerts.length)html=html.replace('<div class="request-card-actions">',`<div class="v21-card-alert">⚠ ${alerts.length===1?'1 pallet da inventariare':`${alerts.length} pallet da inventariare`}</div><div class="request-card-actions">`);return html};
const oldRequestDetail=ui.requestDetail.bind(ui);
ui.requestDetail=function(id){const request=this.store.db.requests.find(x=>x.id===id),alerts=activeAlerts(request);let html=oldRequestDetail(id);if(alerts.length){const markup=`<section class="form-card"><div class="section-label">CONTROLLO INVENTARIO RICHIESTO</div>${alerts.map(a=>`<div class="v21-inventory-alert"><b>⚠ ${esc(a.article)}${a.size?` · ${esc(a.size)}`:''} · Bancale ${esc(a.pallet||'—')}</b><span>${esc(a.note)}</span></div>`).join('')}</section>`;html=html.replace(/(<div class="summary-three">[\s\S]*?<\/div><\/div>)/,`$1${markup}`)}return html};

const excel=globalThis.NOVA.excel;
if(excel){
  excel.requestSheet=function(){const h=['RICHIESTA','DATA','DESTINAZIONE','OPERATORE','RIFERIMENTO','STATO','ARTICOLO','TAGLIA','CARTONI RICHIESTI','CARTONI PRESI','CARTONI RESIDUI','PEZZI SCARICATI','MARKER','NOTE'];const rows=[];for(const request of this.store.db.requests)for(const line of request.lines||[]){const delivered=this.domain.requests.deliveredForLine(request,line.id),alerts=activeAlerts(request).filter(a=>a.lineId===line.id).map(a=>a.note),notes=[line.note,...alerts].filter(Boolean).join(' | ');rows.push([request.id,fmtDateTime(request.requestedAt),request.destination,request.operator,request.reference,request.status,line.article,line.size,line.cartonsRequested,delivered.cartons,Math.max(0,line.cartonsRequested-delivered.cartons),delivered.pieces,line.marker,notes])}return X().utils.aoa_to_sheet([h,...rows])};
  excel.issueSheet=function(){const h=['SCARICO','DATA','OPERATORE','DESTINAZIONE','RICHIESTA','ARTICOLO','TAGLIA','STATO','PEZZI','CARTONI','FILA/SCAFFALE','BANCALE','NOTE'];const rows=[];for(const issue of this.store.db.issues)for(const item of issue.items||[]){const cancellation=issue.cancelledAt?`ANNULLATO ${fmtDateTime(issue.cancelledAt)} · ${issue.cancelReason||''}`:'',notes=[issue.note,cancellation].filter(Boolean).join(' | ');rows.push([issue.id,fmtDateTime(issue.createdAt),issue.operator,issue.destination,issue.requestId,item.article,item.size,item.state,item.pieces,item.cartons,item.source?.location||'',item.source?.pallet||'',notes])}return X().utils.aoa_to_sheet([h,...rows])};
}

/* ---------------------------------------------------------
   Eventi: solo le nuove azioni V21
   --------------------------------------------------------- */
const oldAction=ui.action.bind(ui);
ui.action=function(action,element){
  if(action==='request-pick-confirm')return this.confirmRequestPickRow(element.dataset.id,element);
  if(action==='request-extra-confirm')return this.confirmRequestExtra(element.dataset.id,element);
  if(action==='request-pick-reopen')return this.reopenRequestPick(element.dataset.id,element.dataset.delivery);
  if(action==='request-pick-done')return this.router.go('request-detail',{id:element.dataset.id});
  return oldAction(action,element);
};
const oldInput=ui.input.bind(ui);
ui.input=function(element){
  if(element.matches?.('[data-pick-cartons],[data-pick-pieces]'))this.updateRequestPickRow(element);
  if(element.id==='requestPickNote'){const requestId=document.getElementById('requestPickSources')?.dataset.request;if(requestId){const draft=this.ensureRequestPickDraft(requestId);draft.note=element.value;this.saveRequestPickDraft(requestId)}}
  return oldInput(element);
};

globalThis.NOVA_V21=Object.freeze({build:V21_BUILD,baseCommit:V21_BASE_COMMIT,scope:'REQUEST_PICKING'});
console.info('[NOVA V21] patch attiva',globalThis.NOVA_V21);
})();
