/* REMOTO flexible position model.
   Fila/Scaffale and Bancale/Carrello are peers: at least one must be present.
   One field filters by that field; two fields use their intersection.
   SCARICA resolves each row to a concrete stock source and refuses ambiguity. */
(function installWarehouseFlexPositionV2(){
  'use strict';
  if(window.WarehouseFlexPositionV2)return;

  const VERSION='2026.08.24-flex-position2';
  const VALID_STATES=['NUOVO','SCARICATO','USATO'];
  let modifyReview=[];
  let modifyContext={location:'',pallet:''};

  const $id=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const norm=v=>String(v??'').trim().toUpperCase();
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const html=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const artOf=r=>typeof normalizeArticle==='function'?normalizeArticle(r?.article_base||''):norm(r?.article_base||'');
  const rowKey=r=>[artOf(r),norm(r?.size),norm(r?.state||'NON_CHIARO'),locOf(r),norm(r?.bancale)].join('|');
  const hasPosition=(loc,pallet)=>!!(norm(loc)||norm(pallet));
  const positionText=(loc,pallet)=>{
    const l=norm(loc),p=norm(pallet);
    if(l&&p)return `Fila/Scaffale ${l} · Bancale/Carrello ${p}`;
    if(l)return `Fila/Scaffale ${l}`;
    if(p)return `Bancale/Carrello ${p}`;
    return 'Posizione non indicata';
  };
  const positionMatches=(r,loc,pallet)=>{
    const l=norm(loc),p=norm(pallet);
    if(!hasPosition(l,p))return false;
    return (!l||locOf(r)===l)&&(!p||norm(r?.bancale)===p);
  };
  function positionRows(loc,pallet){return stockBuckets().filter(r=>positionMatches(r,loc,pallet))}

  function notify(message,type='good'){
    document?.querySelectorAll?.('.voiceStatus')?.forEach?.(el=>{el.textContent=message;el.className=`voiceStatus ${type}`});
    try{if(typeof warehouseToast==='function'&&!/dett|microfono|tastiera/i.test(message))warehouseToast(message,type==='error'?'error':type==='warn'?'warn':'success')}catch{}
  }

  function relabel(inputId,text,placeholder){
    const input=$id(inputId);if(!input)return;
    input.placeholder=placeholder||'';
    const label=input.closest('label');if(!label)return;
    [...label.childNodes].forEach(n=>{if(n!==input)n.remove()});
    label.insertBefore(document.createTextNode(text),input);
  }
  function decorateUi(){
    relabel('filaScaffale','Fila/Scaffale','Es. 63');
    relabel('bancale','Bancale/Carrello','Es. 134');
    relabel('stockEditLocation','Fila/Scaffale','Es. 63');
    relabel('stockEditPallet','Bancale/Carrello','Es. 134');
    const btn=$id('stockEditScreen')?.querySelector('button.btn.primary');if(btn)btn.textContent='CERCA POSIZIONE';
  }

  function validateOperationPosition(){
    const loc=norm($id('filaScaffale')?.value),pallet=norm($id('bancale')?.value);
    if(!hasPosition(loc,pallet)){alert('Inserisci Fila/Scaffale oppure Bancale/Carrello.');return false}
    return true;
  }
  window.validateLocation=validateOperationPosition;

  window.stockEditRowsAtSource=function(){
    return positionRows(stockEditSource?.fila_scaffale||'',stockEditSource?.bancale||'');
  };
  window.loadStockPallet=function(){
    if(!requireLogin())return;
    const loc=norm($id('stockEditLocation')?.value),pallet=norm($id('stockEditPallet')?.value);
    if(!hasPosition(loc,pallet)){alert('Inserisci Fila/Scaffale oppure Bancale/Carrello.');return}
    stockEditSource={fila_scaffale:loc,bancale:pallet};
    const rows=window.stockEditRowsAtSource();
    if(!rows.length){
      stockEditRowsDraft=[];$id('stockEditEditor')?.classList.add('hidden');
      setStatus('stockEditSearchStatus',`Nessuna giacenza trovata · ${positionText(loc,pallet)}.`,'error');return;
    }
    stockEditBuildDraft(rows);
    setStatus('stockEditSearchStatus',`Posizione trovata · ${rows.length} righe · ${positionText(loc,pallet)}.`,'good');
    $id('stockEditEditor')?.classList.remove('hidden');window.renderStockEditRows();
  };
  window.addStockEditRow=function(){
    const loc=norm(stockEditSource?.fila_scaffale),pallet=norm(stockEditSource?.bancale);
    if(!hasPosition(loc,pallet))return alert('Cerca prima una posizione da modificare.');
    stockEditRowsDraft.push({edit_id:uid(),original:null,deleted:false,article_base:'',size:'',quantity:0,state:'NUOVO',fila_scaffale:loc,bancale:pallet});
    window.renderStockEditRows();
    setTimeout(()=>{const rows=document.querySelectorAll('#stockEditRows .stockEditRow');rows[rows.length-1]?.scrollIntoView({behavior:'smooth',block:'center'})},30);
  };
  window.renderStockEditRows=function(){
    const active=stockEditRowsDraft.filter(r=>!r.deleted).length;
    if($id('stockEditSummary'))$id('stockEditSummary').textContent=`${positionText(stockEditSource?.fila_scaffale||'',stockEditSource?.bancale||'')} · ${active} righe attive`;
    if($id('stockEditRows'))$id('stockEditRows').innerHTML=stockEditRowsDraft.map(stockEditRowHtml).join('');
  };

  function normalizeStockRow(r){
    const loc=locOf(r),pallet=norm(r?.bancale),state=VALID_STATES.includes(norm(r?.state))?norm(r.state):norm(r?.state||'NON_CHIARO');
    return {article_base:artOf(r),size:norm(r?.size),quantity:Math.max(0,Number(r?.quantity)||0),state,fila_scaffale:loc,fila:loc,scaffale:'',bancale:pallet};
  }
  function sameRow(a,b){if(!a||!b)return a===b;return rowKey(a)===rowKey(b)&&Math.abs(Number(a.quantity||0)-Number(b.quantity||0))<1e-9}
  function describe(before,after){
    if(!before&&after)return `RETTIFICA AGGIUNTA · ${after.quantity} pezzi · ${positionText(after.fila_scaffale,after.bancale)}`;
    if(before&&!after)return `RETTIFICA RIMOZIONE · ${before.quantity} pezzi · ${positionText(before.fila_scaffale,before.bancale)}`;
    const p=[];
    if(artOf(before)!==artOf(after))p.push(`Articolo ${artOf(before)}→${artOf(after)}`);
    if(norm(before.size)!==norm(after.size))p.push(`Taglia ${norm(before.size)||'—'}→${norm(after.size)||'—'}`);
    if(norm(before.state)!==norm(after.state))p.push(`Stato ${norm(before.state)}→${norm(after.state)}`);
    if(locOf(before)!==locOf(after))p.push(`Fila/Scaffale ${locOf(before)||'—'}→${locOf(after)||'—'}`);
    if(norm(before.bancale)!==norm(after.bancale))p.push(`Bancale/Carrello ${norm(before.bancale)||'—'}→${norm(after.bancale)||'—'}`);
    if(Number(before.quantity||0)!==Number(after.quantity||0))p.push(`Quantità ${Number(before.quantity||0)}→${Number(after.quantity||0)}`);
    return 'RETTIFICA · '+(p.join(' · ')||'dati confermati');
  }
  function rectStore(){if(!Array.isArray(db.rectifications))db.rectifications=[];return db.rectifications}
  window.saveStockEdit=function(){
    if(!requireLogin())return;if(!stockEditRowsDraft.length)return alert('Cerca prima una posizione da modificare.');
    const changes=[];
    for(const draft of stockEditRowsDraft){
      const before=draft.original?normalizeStockRow(draft.original):null;
      const after=(!draft.deleted&&Number(draft.quantity)>0)?normalizeStockRow(draft):null;
      if(after){
        if(!after.article_base)return alert('Completa il codice articolo in tutte le righe attive.');
        if(!hasPosition(after.fila_scaffale,after.bancale))return alert('Ogni riga attiva deve avere Fila/Scaffale oppure Bancale/Carrello.');
      }
      if(sameRow(before,after)||(!before&&!after))continue;changes.push({before,after});
    }
    if(!changes.length)return alert('Nessuna modifica da salvare.');
    const available=new Map(stockBuckets().map(x=>[rowKey(x),Number(x.quantity||0)])),needed=new Map();
    for(const c of changes){if(!c.before)continue;const k=rowKey(c.before);needed.set(k,(needed.get(k)||0)+Number(c.before.quantity||0))}
    for(const [k,q] of needed){if((available.get(k)||0)+1e-9<q)return alert(`La giacenza è cambiata. Disponibili ${available.get(k)||0}, attesi ${q}. Cerca di nuovo la posizione e riprova.`)}
    const lines=changes.map(c=>describe(c.before,c.after)).join('\n');
    if(!confirm(`Confermi ${changes.length} rettifiche?\n\n${lines}\n\nNon verrà creato alcun CARICA o SCARICA.`))return;
    const batchId=uid(),at=new Date().toISOString();
    for(const c of changes){const rec={id:uid(),batch_id:batchId,type:'RETTIFICA',operator:operatorName(),registered_at:at,operation_at:at,updated_at:at,cancelled_at:null,before:c.before?clone(c.before):null,after:c.after?clone(c.after):null,note:describe(c.before,c.after)};rectStore().unshift(rec);if(typeof audit==='function')audit('CREATE','RECTIFICATION',rec.id,null,clone(rec))}
    saveDb();const remaining=window.stockEditRowsAtSource();
    if(remaining.length){stockEditBuildDraft(remaining);window.renderStockEditRows();setStatus('stockEditSearchStatus',`Rettifiche salvate · restano ${remaining.length} righe · ${positionText(stockEditSource.fila_scaffale,stockEditSource.bancale)}.`,'good')}
    else{stockEditRowsDraft=[];if($id('stockEditRows'))$id('stockEditRows').innerHTML='';$id('stockEditEditor')?.classList.add('hidden');setStatus('stockEditSearchStatus',`Rettifica salvata · nessuna giacenza residua · ${positionText(stockEditSource.fila_scaffale,stockEditSource.bancale)}.`,'good')}
    try{window.renderStock?.();window.renderRegistry?.();window.LocalMaster?.renderPanel?.();warehouseToast?.('Rettifica salvata senza creare movimenti fittizi.','success')}catch{}
  };

  function collectOperationRows(){
    const rows=[];
    for(const p of (importedPhotos||[]))for(const g of (p.groups||[])){
      if(!normalizeArticle(g.article_base))return {error:'Completa tutti i codici articolo.'};
      for(const v of (g.variants||[])){if(Number(v.quantity)<=0)continue;rows.push({article_base:normalizeArticle(g.article_base),size:norm(v.size),quantity:Number(v.quantity),state:v.state,note:v.note||''})}
    }
    return {rows};
  }
  function resolveDischargeSource(req,loc,pallet){
    let candidates=positionRows(loc,pallet).filter(s=>artOf(s)===artOf(req)&&norm(s.size)===norm(req.size)&&norm(s.state)===norm(req.state));
    if(!candidates.length)return {error:`${req.article_base} ${req.size||''} ${req.state||''}: giacenza non trovata nella posizione indicata.`};
    const concrete=new Map();for(const c of candidates)concrete.set(`${locOf(c)}|${norm(c.bancale)}`,c);candidates=[...concrete.values()];
    if(candidates.length>1)return {error:`${req.article_base} ${req.size||''}: presente in più posizioni compatibili. Specifica anche l’altro campo posizione.`};
    const src=candidates[0];if(Number(req.quantity)>Number(src.quantity||0))return {error:`${req.article_base} ${req.size||''}: disponibili ${Number(src.quantity||0)}, richiesti ${Number(req.quantity)}.`};
    return {row:{...req,fila_scaffale:locOf(src),fila:locOf(src),scaffale:'',bancale:norm(src.bancale)}};
  }
  window.confirmOperation=function(){
    if(!requireLogin())return;if(!validateOperationPosition())return;
    const got=collectOperationRows();if(got.error)return alert(got.error);const rows=got.rows||[];if(!rows.length)return alert('Non ci sono quantità da registrare.');
    const loc=norm($id('filaScaffale')?.value),pallet=norm($id('bancale')?.value);
    const operationAt=$id('operationAt')?.value?new Date($id('operationAt').value).toISOString():new Date().toISOString();
    const common={operator:operatorName(),destination:operation==='SCARICA'?$id('destination')?.value:null,operation_at:operationAt,registered_at:new Date().toISOString(),arrival_at:operation==='CARICA'?($id('arrivedNow')?.checked?operationAt:($id('arrivalAt')?.value?new Date($id('arrivalAt').value).toISOString():operationAt)):null};
    let fullRows=[];
    if(operation==='SCARICA'){
      for(const r of rows){const resolved=resolveDischargeSource(r,loc,pallet);if(resolved.error)return alert(resolved.error);fullRows.push({...resolved.row,...common,movement_type:'SCARICA'})}
    }else fullRows=rows.map(r=>({...r,...common,fila_scaffale:loc,fila:loc,scaffale:'',bancale:pallet,movement_type:'CARICA'}));
    let docId=null;if(operation==='SCARICA')docId=nextDocId();const ids=[];
    fullRows.forEach(r=>{const m={id:uid(),document_id:docId,source_request_id:null,cancelled_at:null,updated_at:r.registered_at,...r};db.movements.unshift(m);ids.push(m.id);audit('CREATE','MOVEMENT',m.id,null,m)});
    if(docId){const doc={id:docId,type:'SCARICO',destination:common.destination,operator:common.operator,operation_at:common.operation_at,created_at:common.registered_at,movement_ids:ids,request_id:null,note:''};db.documents.unshift(doc);audit('CREATE','DOCUMENT',doc.id,null,doc)}
    saveDb();alert(operation==='CARICA'?`${rows.length} righe caricate in giacenza.`:`Scarico ${docId} registrato.`);photos=[];importedPhotos=[];renderPhotos();show('home');
  };

  function voiceResolveRows(parsed,mode,loc,pallet){
    const scope=positionRows(loc,pallet),out=[],used=new Map();
    for(const src of parsed){const r={...src,state:src.spokenState||'',error:''};
      if(!r.article)r.error='Codice articolo non riconosciuto.';
      if(!(Number(r.quantity)>0))r.error=r.error||'Quantità non riconosciuta o non valida.';
      if(mode==='CARICA'){r.state=r.state||'NUOVO';out.push(r);continue}
      let c=scope.filter(x=>artOf(x)===artOf(r));
      if(r.size)c=c.filter(x=>norm(x.size)===norm(r.size));else{const sizes=[...new Set(c.map(x=>norm(x.size)).filter(Boolean))];if(sizes.length===1){r.size=sizes[0];c=c.filter(x=>norm(x.size)===r.size)}else if(sizes.length>1)r.error=r.error||'Sono presenti più taglie: indica la taglia.'}
      if(r.state)c=c.filter(x=>norm(x.state)===norm(r.state));else{const states=[...new Set(c.map(x=>norm(x.state)).filter(Boolean))];if(states.length===1){r.state=states[0];c=c.filter(x=>norm(x.state)===r.state)}else if(states.length>1)r.error=r.error||'Sono presenti più stati: indica lo stato.'}
      if(!c.length&&!r.error)r.error='Articolo/taglia/stato non presente nella posizione indicata.';
      const pos=[...new Set(c.map(x=>`${locOf(x)}|${norm(x.bancale)}`))];if(pos.length>1&&!r.error)r.error='La riga è presente in più posizioni compatibili: specifica anche l’altro campo posizione.';
      if(c.length&&pos.length===1&&Number(r.quantity)>0){const x=c[0],k=[artOf(x),norm(x.size),norm(x.state),locOf(x),norm(x.bancale)].join('|'),already=used.get(k)||0,available=Number(x.quantity||0);if(already+Number(r.quantity)>available)r.error=r.error||`Quantità insufficiente: disponibili ${Math.max(0,available-already)} pezzi.`;else used.set(k,already+Number(r.quantity))}
      out.push(r);
    }
    return out;
  }
  function ensureOperationSummary(mode,loc,pallet,rows){
    const base=$id('resultSummary');if(!base)return;let box=$id('voiceReviewSummary');if(!box){box=document.createElement('div');box.id='voiceReviewSummary';box.className='voiceReviewSummary';base.parentNode.insertBefore(box,base)}
    const errors=rows.filter(r=>r.error).length;box.innerHTML=`<b>🎙 ${html(mode)} · ${rows.length} righe</b><div>${html(positionText(loc,pallet))}</div>${errors?`<div class="voiceReviewError">⚠ ${errors} righe richiedono correzione.</div>`:'<div>✓ Dettatura elaborata. Controlla prima di confermare.</div>'}`;const back=document.querySelector('#results .back');if(back)back.setAttribute('onclick',"show('operation')");
  }
  function executeVoiceOperation(raw,mode,voice){
    const loc=norm($id('filaScaffale')?.value),pallet=norm($id('bancale')?.value);if(!hasPosition(loc,pallet)){notify('Inserisci Fila/Scaffale oppure Bancale/Carrello.','error');return false}
    const parsed=voice.parseItems(raw,mode);if(!parsed.length){notify('Non ho riconosciuto nessun codice articolo.','error');return false}
    const rows=voiceResolveRows(parsed,mode,loc,pallet);
    try{importedPhotos=[{photo_index:1,general_note:'Dettatura',groups:rows.map(r=>({article_base:r.article||'',description:'',confidence:r.error?.1:1,variants:[{size:r.size||'',quantity:Number(r.quantity)||0,state:VALID_STATES.includes(r.state)?r.state:'NON_CHIARO',confidence:r.error?.1:1,note:r.error?`DA CORREGGERE: ${r.error}`:''}]}))}];renderResults();show('results');ensureOperationSummary(mode,loc,pallet,rows)}catch(e){notify('Non sono riuscito a preparare la lista: '+(e?.message||e),'error');return false}
    const errors=rows.filter(r=>r.error).length;notify(errors?`Lista creata: correggi ${errors} righe evidenziate.`:`${rows.length} righe pronte da controllare.`,errors?'warn':'good');return true;
  }

  function reviewAvailable(){return positionRows(modifyContext.location,modifyContext.pallet)}
  function renderModifyReview(voice){
    let box=$id('voiceFlexPositionReview');const card=$id('stockEditScreen')?.querySelector('.card');if(!card)return;if(!box){box=document.createElement('div');box.id='voiceFlexPositionReview';box.className='voiceModifyReview';card.insertAdjacentElement('afterend',box)}
    modifyReview=voice.validateModifyReviewRows(modifyReview,reviewAvailable());const errors=modifyReview.filter(r=>r.error).length;
    box.innerHTML=`<div class="voiceReviewHead"><div><b>🎙 Revisione rettifica</b><small>${html(positionText(modifyContext.location,modifyContext.pallet))}</small></div><span class="${errors?'voiceBadgeError':'voiceBadgeOk'}">${errors?errors+' ERRORI':'VALIDA'}</span></div>${modifyReview.map((r,i)=>`<div class="voiceEditRow ${r.error?'hasError':''}" data-row="${i}"><div class="voiceEditTop"><select data-field="action"><option ${r.action==='MODIFICA'?'selected':''}>MODIFICA</option><option ${r.action==='ELIMINA'?'selected':''}>ELIMINA</option><option ${r.action==='AGGIUNGI'?'selected':''}>AGGIUNGI</option></select><button type="button" data-remove="${i}">×</button></div><div class="voiceEditGrid"><label>Articolo<input data-field="article" value="${html(r.article)}"></label><label>Taglia<input data-field="size" value="${html(r.size)}"></label><label>${r.action==='ELIMINA'?'Qtà da eliminare':r.action==='AGGIUNGI'?'Qtà da aggiungere':'Qtà finale'}<input data-field="quantity" type="number" min="0" value="${r.quantity===null||r.quantity===undefined?'':html(r.quantity)}"></label><label>Stato origine<select data-field="sourceState"><option value="">AUTO</option>${VALID_STATES.map(s=>`<option ${s===r.sourceState?'selected':''}>${s}</option>`).join('')}</select></label><label>Nuovo stato<select data-field="targetState"><option value="">INVARIATO</option>${VALID_STATES.map(s=>`<option ${s===r.targetState?'selected':''}>${s}</option>`).join('')}</select></label></div><div class="voiceRowCheck ${r.error?'bad':'good'}">${r.error?'⚠ '+html(r.error):r.action==='AGGIUNGI'?'✓ Nuova giacenza pronta':`✓ Trovato: ${html(r.source?.article_base||r.article)} ${html(r.source?.size||r.size)} · ${html(r.source?.state||r.sourceState)} · ${Number(r.source?.quantity||0)} pezzi · ${html(positionText(locOf(r.source||{}),norm(r.source?.bancale)))}`}</div></div>`).join('')}<div class="voiceReviewActions"><button type="button" id="voiceFlexSpeakMore" class="btn soft" data-no-tap-sound="1">🎙 DETTA ANCORA</button><button type="button" id="voiceFlexApply" class="btn success" ${errors||!modifyReview.length?'disabled':''}>APPLICA ALLA RETTIFICA</button></div>`;
    box.querySelectorAll('[data-row]').forEach(el=>{const i=Number(el.dataset.row);el.querySelectorAll('[data-field]').forEach(f=>f.addEventListener('change',()=>{modifyReview[i][f.dataset.field]=f.dataset.field==='quantity'?(f.value===''?null:Number(f.value)):norm(f.value);renderModifyReview(voice)}))});
    box.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{modifyReview.splice(Number(b.dataset.remove),1);renderModifyReview(voice)}));
    $id('voiceFlexSpeakMore')?.addEventListener('click',()=>window.WarehouseVoiceTopClient?.openCapture?.('MODIFICA'));
    $id('voiceFlexApply')?.addEventListener('click',()=>applyModifyReview(voice));
  }
  function executeVoiceModify(raw,voice){
    const loc=norm($id('stockEditLocation')?.value),pallet=norm($id('stockEditPallet')?.value);if(!hasPosition(loc,pallet)){notify('Inserisci Fila/Scaffale oppure Bancale/Carrello.','error');return false}
    const available=positionRows(loc,pallet);if(!available.length){notify(`Nessuna giacenza trovata · ${positionText(loc,pallet)}.`,'error');return false}
    const parsed=voice.parseModifyRows(raw);if(!parsed.length){notify('Non ho riconosciuto nessun articolo da rettificare.','error');return false}
    if(modifyContext.location!==loc||modifyContext.pallet!==pallet)modifyReview=[];modifyContext={location:loc,pallet};modifyReview.push(...parsed);window.loadStockPallet();renderModifyReview(voice);const checked=voice.validateModifyReviewRows(modifyReview,available),errors=checked.filter(r=>r.error).length;notify(errors?`Dettatura acquisita: ${errors} righe da correggere.`:`${parsed.length} rettifiche aggiunte.`,errors?'warn':'good');return true;
  }
  function applyModifyReview(voice){
    const checked=voice.validateModifyReviewRows(modifyReview,reviewAvailable()),errors=checked.filter(r=>r.error);modifyReview=checked;if(errors.length){notify('Correggi tutte le righe in errore prima di applicare la rettifica.','error');renderModifyReview(voice);return false}
    window.loadStockPallet();
    for(const r of checked){
      if(r.action==='AGGIUNGI'){
        let d=stockEditRowsDraft.find(x=>!x.deleted&&artOf(x)===artOf(r)&&norm(x.size)===norm(r.size)&&norm(x.state)===norm(r.targetState||'NUOVO')&&positionMatches(x,modifyContext.location,modifyContext.pallet));
        if(d)d.quantity=Number(d.quantity||0)+Number(r.quantity||0);else stockEditRowsDraft.push({edit_id:uid(),original:null,deleted:false,article_base:artOf(r),size:norm(r.size),quantity:Number(r.quantity||0),state:norm(r.targetState||'NUOVO'),fila_scaffale:modifyContext.location,bancale:modifyContext.pallet});continue;
      }
      const src=r.source,d=stockEditRowsDraft.find(x=>!x.deleted&&artOf(x)===artOf(src)&&norm(x.size)===norm(src.size)&&norm(x.state)===norm(src.state)&&locOf(x)===locOf(src)&&norm(x.bancale)===norm(src.bancale));if(!d){notify(`Riga ${r.article} ${r.size} non più disponibile nell'editor.`,'error');return false}
      if(r.action==='ELIMINA'){if(r.quantity===null||r.quantity===undefined||r.quantity==='')d.deleted=true;else d.quantity=Math.max(0,Number(src.quantity||0)-Number(r.quantity||0))}
      else{if(r.quantity!==null&&r.quantity!==undefined)d.quantity=Math.max(0,Number(r.quantity)||0);if(r.targetState)d.state=norm(r.targetState)}
    }
    window.renderStockEditRows();setStatus('stockEditSearchStatus','Rettifica dettata applicata all’editor. Controlla le righe e poi premi SALVA MODIFICHE.','good');$id('stockEditEditor')?.scrollIntoView?.({behavior:'smooth',block:'start'});notify('Rettifica applicata all’editor.','good');return true;
  }

  function patchVoice(){
    const voice=window.WarehouseVoiceCommands;if(!voice||voice.__flexPositionV2)return false;
    const base=voice.executeTranscript.bind(voice);
    voice.executeTranscript=function(raw,hint){const mode=norm(hint||'AUTO');if(mode==='CARICA'||mode==='SCARICA')return executeVoiceOperation(raw,mode,voice);if(mode==='MODIFICA')return executeVoiceModify(raw,voice);return base(raw,hint)};
    voice.__flexPositionV2=true;return true;
  }
  function install(){decorateUi();patchVoice();try{window.WarehouseValidationSounds?.installWrappers?.()}catch{}return true}

  window.WarehouseFlexPositionV2={version:VERSION,hasPosition,positionText,positionMatches,positionRows,validateOperationPosition,resolveDischargeSource,patchVoice,install};
  install();
})();
