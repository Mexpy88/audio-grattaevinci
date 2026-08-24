/* REMOTO location model: Fila/Scaffale is required, Bancale/Carrello is optional.
   Empty pallet means stock placed directly on that shelf/location and matches only
   rows whose Bancale/Carrello is also empty. Includes voice handling for that case. */
(function installWarehouseOptionalPalletFix(){
  'use strict';
  if(window.WarehouseOptionalPalletFix)return;

  const VERSION='2026.08.24-optional-pallet1';
  const VALID_STATES=['NUOVO','SCARICATO','USATO'];
  let directReviewRows=[];
  let directReviewContext={location:'',pallet:''};

  const $id=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const norm=v=>String(v??'').trim().toUpperCase();
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const html=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const artOf=r=>typeof normalizeArticle==='function'?normalizeArticle(r?.article_base||''):norm(r?.article_base||'');
  const posText=(loc,pallet)=>pallet?`Fila/Scaffale ${loc} · Bancale/Carrello ${pallet}`:`Fila/Scaffale ${loc} · senza Bancale/Carrello`;
  const rowKey=r=>[artOf(r),norm(r?.size),norm(r?.state||'NON_CHIARO'),locOf(r),norm(r?.bancale)].join('|');

  function notify(message,type='good'){
    if(typeof document!=='undefined')document.querySelectorAll('.voiceStatus').forEach(el=>{el.textContent=message;el.className=`voiceStatus ${type}`});
    try{if(typeof warehouseToast==='function'&&!/ascolto|microfono/i.test(message))warehouseToast(message,type==='error'?'error':type==='warn'?'warn':'success')}catch{}
  }
  function decorateUi(){
    const b=$id('bancale');if(b){b.placeholder='Facoltativo';const l=b.closest('label');if(l&&!/facoltativo/i.test(l.textContent))l.insertAdjacentHTML('afterbegin','Bancale/Carrello <small style="font-weight:700;color:#65788c">(facoltativo)</small>');}
    const p=$id('stockEditPallet');if(p){p.placeholder='Facoltativo';const l=p.closest('label');if(l&&!/facoltativo/i.test(l.textContent))l.insertAdjacentHTML('afterbegin','Bancale/Carrello <small style="font-weight:700;color:#65788c">(facoltativo)</small>');}
    const searchBtn=$id('stockEditScreen')?.querySelector('button.btn.primary');if(searchBtn&&/CERCA PALLET/i.test(searchBtn.textContent))searchBtn.textContent='CERCA POSIZIONE';
  }

  function validateLocationOnly(){
    if(!$id('filaScaffale')?.value.trim()){alert('Inserisci Fila/Scaffale. Bancale/Carrello può rimanere vuoto.');return false}
    return true;
  }
  window.validateLocation=validateLocationOnly;

  window.stockEditRowsAtSource=function(){
    const loc=norm(stockEditSource?.fila_scaffale),pallet=norm(stockEditSource?.bancale);
    return stockBuckets().filter(s=>locOf(s)===loc&&norm(s.bancale)===pallet);
  };
  window.loadStockPallet=function(){
    if(!requireLogin())return;
    const loc=norm($id('stockEditLocation')?.value),pallet=norm($id('stockEditPallet')?.value);
    if(!loc){alert('Inserisci Fila/Scaffale. Bancale/Carrello può rimanere vuoto.');return}
    stockEditSource={fila_scaffale:loc,bancale:pallet};
    const rows=window.stockEditRowsAtSource();
    if(!rows.length){
      stockEditRowsDraft=[];$id('stockEditEditor')?.classList.add('hidden');
      setStatus('stockEditSearchStatus',`Nessuna giacenza trovata in ${posText(loc,pallet)}.`,'error');return;
    }
    stockEditBuildDraft(rows);
    setStatus('stockEditSearchStatus',`Posizione trovata: ${rows.length} righe di giacenza · ${posText(loc,pallet)}.`,'good');
    $id('stockEditEditor')?.classList.remove('hidden');window.renderStockEditRows();
  };
  window.addStockEditRow=function(){
    if(!stockEditSource?.fila_scaffale)return alert('Cerca prima la posizione da modificare.');
    stockEditRowsDraft.push({edit_id:uid(),original:null,deleted:false,article_base:'',size:'',quantity:0,state:'NUOVO',fila_scaffale:stockEditSource.fila_scaffale,bancale:stockEditSource.bancale||''});
    window.renderStockEditRows();
    setTimeout(()=>{const rows=document.querySelectorAll('#stockEditRows .stockEditRow');rows[rows.length-1]?.scrollIntoView({behavior:'smooth',block:'center'})},30);
  };
  window.renderStockEditRows=function(){
    const active=stockEditRowsDraft.filter(r=>!r.deleted).length;
    if($id('stockEditSummary'))$id('stockEditSummary').textContent=`${posText(stockEditSource?.fila_scaffale||'',stockEditSource?.bancale||'')} · ${active} righe attive`;
    if($id('stockEditRows'))$id('stockEditRows').innerHTML=stockEditRowsDraft.map(stockEditRowHtml).join('');
  };

  function normalizeStockRow(r){
    const loc=locOf(r),state=VALID_STATES.includes(norm(r?.state))?norm(r.state):norm(r?.state||'NON_CHIARO');
    return {article_base:artOf(r),size:norm(r?.size),quantity:Math.max(0,Number(r?.quantity)||0),state,fila_scaffale:loc,fila:loc,scaffale:'',bancale:norm(r?.bancale)};
  }
  function sameRow(a,b){if(!a||!b)return a===b;return rowKey(a)===rowKey(b)&&Math.abs(Number(a.quantity||0)-Number(b.quantity||0))<1e-9}
  function describe(before,after){
    if(!before&&after)return `RETTIFICA AGGIUNTA · ${after.quantity} pezzi · ${posText(after.fila_scaffale,after.bancale)}`;
    if(before&&!after)return `RETTIFICA RIMOZIONE · ${before.quantity} pezzi · ${posText(before.fila_scaffale,before.bancale)}`;
    const p=[];if(artOf(before)!==artOf(after))p.push(`Articolo ${artOf(before)}→${artOf(after)}`);if(norm(before.size)!==norm(after.size))p.push(`Taglia ${norm(before.size)||'—'}→${norm(after.size)||'—'}`);if(norm(before.state)!==norm(after.state))p.push(`Stato ${norm(before.state)}→${norm(after.state)}`);if(locOf(before)!==locOf(after))p.push(`Fila/Scaffale ${locOf(before)||'—'}→${locOf(after)||'—'}`);if(norm(before.bancale)!==norm(after.bancale))p.push(`Bancale/Carrello ${norm(before.bancale)||'—'}→${norm(after.bancale)||'—'}`);if(Number(before.quantity||0)!==Number(after.quantity||0))p.push(`Quantità ${Number(before.quantity||0)}→${Number(after.quantity||0)}`);return 'RETTIFICA · '+(p.join(' · ')||'dati confermati');
  }
  function rectStore(){if(!Array.isArray(db.rectifications))db.rectifications=[];return db.rectifications}
  window.saveStockEdit=function(){
    if(!requireLogin())return;if(!stockEditRowsDraft.length)return alert('Cerca prima una posizione da modificare.');
    const changes=[];
    for(const draft of stockEditRowsDraft){
      const before=draft.original?normalizeStockRow(draft.original):null;
      const after=(!draft.deleted&&Number(draft.quantity)>0)?normalizeStockRow(draft):null;
      if(after){if(!after.article_base)return alert('Completa il codice articolo in tutte le righe attive.');if(!after.fila_scaffale)return alert('Completa Fila/Scaffale in tutte le righe attive. Bancale/Carrello può rimanere vuoto.')}
      if(sameRow(before,after)||(!before&&!after))continue;changes.push({before,after});
    }
    if(!changes.length)return alert('Nessuna modifica da salvare.');
    const available=new Map(stockBuckets().map(x=>[rowKey(x),Number(x.quantity||0)])),needed=new Map();
    for(const c of changes){if(!c.before)continue;const k=rowKey(c.before);needed.set(k,(needed.get(k)||0)+Number(c.before.quantity||0))}
    for(const [k,q] of needed){if((available.get(k)||0)+1e-9<q)return alert(`La giacenza è cambiata. Disponibili ${available.get(k)||0}, attesi ${q}. Cerca di nuovo la posizione e riprova.`)}
    const lines=changes.map(c=>describe(c.before,c.after)).join('\n');if(!confirm(`Confermi ${changes.length} rettifiche?\n\n${lines}\n\nNon verrà creato alcun CARICA o SCARICA.`))return;
    const batchId=uid(),at=new Date().toISOString();
    for(const c of changes){const rec={id:uid(),batch_id:batchId,type:'RETTIFICA',operator:operatorName(),registered_at:at,operation_at:at,updated_at:at,cancelled_at:null,before:c.before?clone(c.before):null,after:c.after?clone(c.after):null,note:describe(c.before,c.after)};rectStore().unshift(rec);if(typeof audit==='function')audit('CREATE','RECTIFICATION',rec.id,null,clone(rec))}
    saveDb();const remaining=window.stockEditRowsAtSource();
    if(remaining.length){stockEditBuildDraft(remaining);window.renderStockEditRows();setStatus('stockEditSearchStatus',`Rettifiche salvate. Restano ${remaining.length} righe in ${posText(stockEditSource.fila_scaffale,stockEditSource.bancale)}.`,'good')}
    else{stockEditRowsDraft=[];if($id('stockEditRows'))$id('stockEditRows').innerHTML='';$id('stockEditEditor')?.classList.add('hidden');setStatus('stockEditSearchStatus',`Rettifica salvata. ${posText(stockEditSource.fila_scaffale,stockEditSource.bancale)} non contiene più giacenze.`,'good')}
    try{window.renderStock?.();window.renderRegistry?.();window.LocalMaster?.renderPanel?.();warehouseToast?.('Rettifica salvata senza creare movimenti fittizi.','success')}catch{}
  };

  function positionRows(location,pallet=''){const l=norm(location),p=norm(pallet);return stockBuckets().filter(r=>locOf(r)===l&&norm(r.bancale)===p)}
  function ensureVoiceSummary(mode,location,rows){
    const base=$id('resultSummary');if(!base)return;let box=$id('voiceReviewSummary');if(!box){box=document.createElement('div');box.id='voiceReviewSummary';box.className='voiceReviewSummary';base.parentNode.insertBefore(box,base)}
    const errors=rows.filter(r=>r.error).length;box.innerHTML=`<b>🎙 ${html(mode)} vocale · ${rows.length} righe</b><div>${html(posText(location,''))}</div>${errors?`<div class="voiceReviewError">⚠ ${errors} righe richiedono correzione manuale.</div>`:'<div>✓ Dati riconosciuti. Controllali prima di confermare.</div>'}`;const back=document.querySelector('#results .back');if(back)back.setAttribute('onclick',"show('operation')");
  }
  function executeShelfOperation(raw,mode,voice){
    const location=norm($id('filaScaffale')?.value);if(!location){notify('Prima inserisci Fila/Scaffale.','error');return false}
    const parsed=voice.parseItems(raw,mode);if(!parsed.length){notify('Non ho riconosciuto nessun codice articolo.','error');return false}
    const rows=voice.resolveOperationRows(parsed,mode,location,'');
    try{importedPhotos=[{photo_index:1,general_note:'Dettatura vocale',groups:rows.map(r=>({article_base:r.article||'',description:'',confidence:r.error?.1:1,variants:[{size:r.size||'',quantity:Number(r.quantity)||0,state:VALID_STATES.includes(r.state)?r.state:'NON_CHIARO',confidence:r.error?.1:1,note:r.error?`DA CORREGGERE: ${r.error}`:''}]}))}];renderResults();show('results');ensureVoiceSummary(mode,location,rows)}catch(e){notify('Non sono riuscito a preparare la lista: '+(e?.message||e),'error');return false}
    const errors=rows.filter(r=>r.error).length;notify(errors?`Lista creata: correggi ${errors} righe evidenziate e poi conferma.`:`${rows.length} righe pronte da controllare.`,errors?'warn':'good');return true;
  }

  function directReviewAvailable(){return positionRows(directReviewContext.location,'')}
  function renderDirectReview(voice){
    let box=$id('voiceDirectShelfReview');const card=$id('stockEditScreen')?.querySelector('.card');if(!card)return;if(!box){box=document.createElement('div');box.id='voiceDirectShelfReview';box.className='voiceModifyReview';card.insertAdjacentElement('afterend',box)}
    directReviewRows=voice.validateModifyReviewRows(directReviewRows,directReviewAvailable());const errors=directReviewRows.filter(r=>r.error).length;
    box.innerHTML=`<div class="voiceReviewHead"><div><b>🎙 Revisione rettifica vocale</b><small>${html(posText(directReviewContext.location,''))}</small></div><span class="${errors?'voiceBadgeError':'voiceBadgeOk'}">${errors?errors+' ERRORI':'VALIDA'}</span></div>${directReviewRows.map((r,i)=>`<div class="voiceEditRow ${r.error?'hasError':''}" data-row="${i}"><div class="voiceEditTop"><select data-field="action"><option ${r.action==='MODIFICA'?'selected':''}>MODIFICA</option><option ${r.action==='ELIMINA'?'selected':''}>ELIMINA</option><option ${r.action==='AGGIUNGI'?'selected':''}>AGGIUNGI</option></select><button type="button" data-remove="${i}">×</button></div><div class="voiceEditGrid"><label>Articolo<input data-field="article" value="${html(r.article)}"></label><label>Taglia<input data-field="size" value="${html(r.size)}"></label><label>${r.action==='ELIMINA'?'Qtà da eliminare':r.action==='AGGIUNGI'?'Qtà da aggiungere':'Qtà finale'}<input data-field="quantity" type="number" min="0" value="${r.quantity===null||r.quantity===undefined?'':html(r.quantity)}"></label><label>Stato origine<select data-field="sourceState"><option value="">AUTO</option>${VALID_STATES.map(s=>`<option ${s===r.sourceState?'selected':''}>${s}</option>`).join('')}</select></label><label>Nuovo stato<select data-field="targetState"><option value="">INVARIATO</option>${VALID_STATES.map(s=>`<option ${s===r.targetState?'selected':''}>${s}</option>`).join('')}</select></label></div><div class="voiceRowCheck ${r.error?'bad':'good'}">${r.error?'⚠ '+html(r.error):r.action==='AGGIUNGI'?'✓ Nuova giacenza pronta da aggiungere':`✓ Trovato: ${html(r.source?.article_base||r.article)} ${html(r.source?.size||r.size)} · ${html(r.source?.state||r.sourceState)} · ${Number(r.source?.quantity||0)} pezzi`}</div></div>`).join('')}<div class="voiceReviewActions"><button type="button" id="voiceDirectSpeakMore" data-no-tap-sound="1" class="btn soft">🎙 PARLA ANCORA</button><button type="button" id="voiceDirectApply" class="btn success" ${errors||!directReviewRows.length?'disabled':''}>APPLICA ALLA RETTIFICA</button></div><div class="voiceReviewFoot">Le righe in errore non vengono applicate. Dopo l’applicazione controlla l’editor e usa <b>SALVA MODIFICHE</b>.</div>`;
    box.querySelectorAll('[data-row]').forEach(rowEl=>{const i=Number(rowEl.dataset.row);rowEl.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('change',()=>{const k=el.dataset.field,v=k==='quantity'?(el.value===''?null:Number(el.value)):norm(el.value);directReviewRows[i][k]=v;renderDirectReview(voice)}))});box.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{directReviewRows.splice(Number(b.dataset.remove),1);renderDirectReview(voice)}));
    $id('voiceDirectSpeakMore')?.addEventListener('click',()=>{try{window.parent?.WarehouseSpeechBroker?.start?.('MODIFICA')}catch{}});$id('voiceDirectApply')?.addEventListener('click',()=>applyDirectReview(voice));
  }
  function executeShelfModify(raw,voice){
    const location=norm($id('stockEditLocation')?.value);if(!location){notify('Prima inserisci Fila/Scaffale.','error');return false}
    const available=positionRows(location,'');if(!available.length){notify(`Nessuna giacenza direttamente in Fila/Scaffale ${location} senza Bancale/Carrello.`,'error');return false}
    const parsed=voice.parseModifyRows(raw);if(!parsed.length){notify('Non ho riconosciuto nessun articolo da rettificare.','error');return false}
    if(directReviewContext.location!==location){directReviewRows=[]}directReviewContext={location,pallet:''};directReviewRows.push(...parsed);try{window.loadStockPallet()}catch{}renderDirectReview(voice);const checked=voice.validateModifyReviewRows(directReviewRows,available),errors=checked.filter(r=>r.error).length;notify(errors?`Dettatura acquisita: ${errors} righe da correggere.`:`${parsed.length} rettifiche aggiunte alla revisione.`,errors?'warn':'good');return true;
  }
  function applyDirectReview(voice){
    const checked=voice.validateModifyReviewRows(directReviewRows,directReviewAvailable()),errors=checked.filter(r=>r.error);directReviewRows=checked;if(errors.length){notify('Correggi tutte le righe in errore prima di applicare la rettifica.','error');renderDirectReview(voice);return false}
    window.loadStockPallet();
    for(const r of checked){
      if(r.action==='AGGIUNGI'){
        let d=stockEditRowsDraft.find(x=>!x.deleted&&artOf(x)===artOf(r)&&norm(x.size)===norm(r.size)&&norm(x.state)===norm(r.targetState||'NUOVO'));
        if(d)d.quantity=Number(d.quantity||0)+Number(r.quantity||0);else stockEditRowsDraft.push({edit_id:uid(),original:null,deleted:false,article_base:artOf(r),size:norm(r.size),quantity:Number(r.quantity||0),state:norm(r.targetState||'NUOVO'),fila_scaffale:directReviewContext.location,bancale:''});continue;
      }
      const src=r.source,d=stockEditRowsDraft.find(x=>!x.deleted&&artOf(x)===artOf(src)&&norm(x.size)===norm(src.size)&&norm(x.state)===norm(src.state));if(!d){notify(`Riga ${r.article} ${r.size} non più disponibile nell'editor.`,'error');return false}
      if(r.action==='ELIMINA'){if(r.quantity===null||r.quantity===undefined||r.quantity==='')d.deleted=true;else d.quantity=Math.max(0,Number(src.quantity||0)-Number(r.quantity||0))}
      else{if(r.quantity!==null&&r.quantity!==undefined)d.quantity=Math.max(0,Number(r.quantity)||0);if(r.targetState)d.state=norm(r.targetState)}
    }
    window.renderStockEditRows();setStatus('stockEditSearchStatus','Rettifica vocale applicata all’editor. Controlla ogni riga e poi premi SALVA MODIFICHE.','good');$id('stockEditEditor')?.scrollIntoView?.({behavior:'smooth',block:'start'});notify('Rettifica applicata all’editor. Controlla e poi premi SALVA MODIFICHE.','good');return true;
  }

  function patchVoice(){
    const voice=window.WarehouseVoiceCommands;if(!voice||voice.__optionalPalletPatched)return false;const baseExecute=voice.executeTranscript.bind(voice);
    voice.executeTranscript=function(raw,hint){
      const mode=String(hint||'AUTO').toUpperCase();
      if(mode==='CARICA'||mode==='SCARICA'){
        const loc=norm($id('filaScaffale')?.value),pallet=norm($id('bancale')?.value);if(!loc){notify('Prima inserisci Fila/Scaffale.','error');return false}if(!pallet)return executeShelfOperation(raw,mode,voice);
      }
      if(mode==='MODIFICA'){
        const loc=norm($id('stockEditLocation')?.value),pallet=norm($id('stockEditPallet')?.value);if(!loc){notify('Prima inserisci Fila/Scaffale.','error');return false}if(!pallet)return executeShelfModify(raw,voice);
      }
      return baseExecute(raw,hint);
    };
    voice.__optionalPalletPatched=true;return true;
  }
  function install(){decorateUi();patchVoice();return true}

  window.WarehouseOptionalPalletFix={version:VERSION,validateLocationOnly,positionRows,patchVoice,install};
  install();
})();
