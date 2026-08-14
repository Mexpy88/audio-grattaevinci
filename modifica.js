/* Estensione MODIFICA PALLET. Il codice esistente resta invariato. */
let stockEditRowsDraft=[];
let stockEditSource={fila_scaffale:'',bancale:''};

(function installStockEditor(){
  const grid=document.querySelector('#home .homeGrid');
  if(grid && !document.getElementById('stockEditHomeBtn')){
    const btn=document.createElement('button');
    btn.id='stockEditHomeBtn';
    btn.className='homeBtn modifica full';
    btn.setAttribute('onclick','openStockEdit()');
    btn.innerHTML='<span class="icon">✎</span><b>MODIFICA</b><small>Rettifica pallet e giacenze</small>';
    const requestsBtn=grid.querySelector('.homeBtn.richieste');
    grid.insertBefore(btn,requestsBtn||null);
  }

  const main=document.querySelector('main');
  if(main && !document.getElementById('stockEditScreen')){
    const section=document.createElement('section');
    section.id='stockEditScreen';
    section.className='screen';
    section.innerHTML=`
      <button class="back" onclick="show('home')">← HOME</button>
      <div class="eyebrow">RETTIFICA GIACENZE</div><h1>Modifica pallet</h1>
      <div class="card">
        <label>Fila/Scaffale<input id="stockEditLocation" class="field" placeholder="Es. A/64"></label>
        <label>Bancale<input id="stockEditPallet" class="field" placeholder="Es. 135"></label>
        <button class="btn primary" onclick="loadStockPallet()">CERCA PALLET</button>
        <div id="stockEditSearchStatus" class="status hidden"></div>
      </div>
      <div id="stockEditEditor" class="hidden">
        <div id="stockEditSummary" class="status good"></div>
        <div class="status warn stockEditNotice">Le modifiche aggiornano la giacenza reale e vengono registrate nello storico come rettifiche. Gli scarichi di reparto già creati non vengono modificati.</div>
        <div id="stockEditRows"></div>
        <button class="btn soft" onclick="addStockEditRow()">＋ AGGIUNGI ARTICOLO</button>
        <button class="btn success" onclick="saveStockEdit()">SALVA MODIFICHE</button>
      </div>`;
    main.appendChild(section);
  }
})();

function stockEditNormText(v){return String(v??'').trim().toUpperCase()}
function stockEditClone(v){return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v))}
function stockEditFind(id){return stockEditRowsDraft.find(r=>r.edit_id===id)}
function stockEditNormalize(r){
  const loc=stockEditNormText(r.fila_scaffale),state=STATES.includes(String(r.state||'').toUpperCase())?String(r.state).toUpperCase():'NON_CHIARO';
  return {
    article_base:normalizeArticle(r.article_base),
    size:stockEditNormText(r.size),
    quantity:Math.max(0,Number(r.quantity)||0),
    state,
    fila_scaffale:loc,
    fila:loc,
    scaffale:'',
    bancale:stockEditNormText(r.bancale)
  };
}
function stockEditRowsAtSource(){
  return stockBuckets().filter(s=>stockEditNormText(locationOf(s))===stockEditSource.fila_scaffale&&stockEditNormText(s.bancale)===stockEditSource.bancale);
}
function stockEditBuildDraft(rows){
  stockEditRowsDraft=rows.map(s=>({
    edit_id:uid(),original:stockEditClone(s),deleted:false,
    article_base:s.article_base,size:s.size||'',quantity:Number(s.quantity)||0,state:s.state||'NON_CHIARO',
    fila_scaffale:locationOf(s),bancale:s.bancale||''
  }));
}
function openStockEdit(){
  if(!requireLogin())return;
  stockEditRowsDraft=[];stockEditSource={fila_scaffale:'',bancale:''};
  $('stockEditLocation').value='';$('stockEditPallet').value='';
  $('stockEditSearchStatus').classList.add('hidden');$('stockEditEditor').classList.add('hidden');$('stockEditRows').innerHTML='';
  show('stockEditScreen');
}
function loadStockPallet(){
  if(!requireLogin())return;
  const loc=stockEditNormText($('stockEditLocation').value),pallet=stockEditNormText($('stockEditPallet').value);
  if(!loc||!pallet){alert('Inserisci Fila/Scaffale e Bancale.');return}
  stockEditSource={fila_scaffale:loc,bancale:pallet};
  const rows=stockEditRowsAtSource();
  if(!rows.length){
    stockEditRowsDraft=[];$('stockEditEditor').classList.add('hidden');
    setStatus('stockEditSearchStatus',`Nessuna giacenza trovata in Fila/Scaffale ${loc}, Bancale ${pallet}.`,'error');return;
  }
  stockEditBuildDraft(rows);
  setStatus('stockEditSearchStatus',`Pallet trovato: ${rows.length} righe di giacenza.`,'good');
  $('stockEditEditor').classList.remove('hidden');renderStockEditRows();
}
function editStockDraft(id,key,value){
  const r=stockEditFind(id);if(!r)return;
  if(key==='quantity')r[key]=Math.max(0,Number(value)||0);
  else if(key==='article_base')r[key]=normalizeArticle(value);
  else if(key==='size'||key==='fila_scaffale'||key==='bancale')r[key]=stockEditNormText(value);
  else r[key]=value;
}
function toggleStockEditDelete(id){const r=stockEditFind(id);if(!r)return;r.deleted=!r.deleted;renderStockEditRows()}
function addStockEditRow(){
  if(!stockEditSource.fila_scaffale||!stockEditSource.bancale)return alert('Cerca prima il pallet da modificare.');
  stockEditRowsDraft.push({edit_id:uid(),original:null,deleted:false,article_base:'',size:'',quantity:0,state:'NUOVO',fila_scaffale:stockEditSource.fila_scaffale,bancale:stockEditSource.bancale});
  renderStockEditRows();
  setTimeout(()=>{const rows=document.querySelectorAll('#stockEditRows .stockEditRow');rows[rows.length-1]?.scrollIntoView({behavior:'smooth',block:'center'})},30);
}
function stockEditRowHtml(r,i){
  const disabled=r.deleted?'disabled':'';
  const origin=r.original?`Prima: ${esc(r.original.article_base)}${r.original.size?` · ${esc(r.original.size)}`:''} · Qtà ${Number(r.original.quantity)||0} · ${esc(r.original.state)} · ${esc(locationOf(r.original)||'—')} / ${esc(r.original.bancale||'—')}`:'Nuova riga';
  return `<div class="stockEditRow ${r.deleted?'deleted':''}">
    <div class="stockEditHead"><b>Riga ${i+1}</b><button class="mini ${r.deleted?'':'danger'}" onclick="toggleStockEditDelete('${r.edit_id}')">${r.deleted?'RIPRISTINA':'ELIMINA'}</button></div>
    <div class="stockEditOrigin">${origin}</div>
    <label>Articolo<input class="field" ${disabled} value="${esc(r.article_base)}" oninput="editStockDraft('${r.edit_id}','article_base',this.value)"></label>
    <div class="twoCols">
      <label>Taglia<input class="field" ${disabled} value="${esc(r.size)}" oninput="editStockDraft('${r.edit_id}','size',this.value)"></label>
      <label>Quantità<input class="field" ${disabled} type="number" min="0" value="${Number(r.quantity)||0}" oninput="editStockDraft('${r.edit_id}','quantity',this.value)"></label>
    </div>
    <label>Stato<select class="field" ${disabled} onchange="editStockDraft('${r.edit_id}','state',this.value)">${STATES.map(s=>`<option ${s===r.state?'selected':''}>${s}</option>`).join('')}</select></label>
    <div class="twoCols">
      <label>Fila/Scaffale<input class="field" ${disabled} value="${esc(r.fila_scaffale)}" oninput="editStockDraft('${r.edit_id}','fila_scaffale',this.value)"></label>
      <label>Bancale<input class="field" ${disabled} value="${esc(r.bancale)}" oninput="editStockDraft('${r.edit_id}','bancale',this.value)"></label>
    </div>
  </div>`;
}
function renderStockEditRows(){
  const active=stockEditRowsDraft.filter(r=>!r.deleted).length;
  $('stockEditSummary').textContent=`Fila/Scaffale ${stockEditSource.fila_scaffale} · Bancale ${stockEditSource.bancale} · ${active} righe attive`;
  $('stockEditRows').innerHTML=stockEditRowsDraft.map(stockEditRowHtml).join('');
}
function stockEditMovement(type,row,quantity,now){
  const loc=stockEditNormText(locationOf(row));
  return {
    id:uid(),document_id:null,source_request_id:null,movement_type:type,
    article_base:normalizeArticle(row.article_base),size:stockEditNormText(row.size),quantity:Number(quantity),state:row.state||'NON_CHIARO',
    fila_scaffale:loc,fila:loc,scaffale:'',bancale:stockEditNormText(row.bancale),destination:null,operator:operatorName(),
    operation_at:now,registered_at:now,arrival_at:type==='CARICA'?now:null,updated_at:now,cancelled_at:null,
    note:`RETTIFICA GIACENZA · origine ${stockEditSource.fila_scaffale}/${stockEditSource.bancale}`
  };
}
function saveStockEdit(){
  if(!requireLogin())return;
  if(!stockEditRowsDraft.length)return alert('Cerca prima un pallet da modificare.');
  const specs=[];
  for(const draft of stockEditRowsDraft){
    const old=draft.original?stockEditNormalize(draft.original):null;
    const next=stockEditNormalize(draft);
    if(!draft.deleted&&next.quantity>0){
      if(!next.article_base)return alert('Completa il codice articolo in tutte le righe attive.');
      if(!next.fila_scaffale||!next.bancale)return alert('Completa Fila/Scaffale e Bancale in tutte le righe attive.');
    }
    if(!old){
      if(!draft.deleted&&next.quantity>0)specs.push({type:'CARICA',row:next,quantity:next.quantity});
      continue;
    }
    if(draft.deleted||next.quantity<=0){specs.push({type:'SCARICA',row:old,quantity:old.quantity});continue}
    if(bucketKey(old)===bucketKey(next)){
      const delta=next.quantity-old.quantity;
      if(delta>0)specs.push({type:'CARICA',row:next,quantity:delta});
      else if(delta<0)specs.push({type:'SCARICA',row:old,quantity:-delta});
    }else{
      specs.push({type:'SCARICA',row:old,quantity:old.quantity});
      specs.push({type:'CARICA',row:next,quantity:next.quantity});
    }
  }
  if(!specs.length)return alert('Nessuna modifica da salvare.');
  const discharges=specs.filter(s=>s.type==='SCARICA').map(s=>({...s.row,quantity:s.quantity}));
  const check=validateDischargeRows(discharges);
  if(!check.ok)return alert(`La giacenza è cambiata e la rettifica non può essere applicata. Disponibili ${check.available}, necessari ${check.needed}. Cerca di nuovo il pallet e riprova.`);
  if(!confirm(`Confermi le modifiche al pallet? Verranno registrate ${specs.length} rettifiche nello storico.`))return;
  const before=stockEditRowsDraft.filter(r=>r.original).map(r=>stockEditClone(r.original));
  const now=new Date().toISOString();
  for(const s of specs){const m=stockEditMovement(s.type,s.row,s.quantity,now);db.movements.unshift(m);audit('CREATE','MOVEMENT',m.id,null,m)}
  const after=stockEditRowsDraft.filter(r=>!r.deleted&&Number(r.quantity)>0).map(r=>stockEditNormalize(r));
  audit('STOCK_EDIT','PALLET',`${stockEditSource.fila_scaffale}|${stockEditSource.bancale}`,before,after);saveDb();
  const remaining=stockEditRowsAtSource();
  if(remaining.length){
    stockEditBuildDraft(remaining);renderStockEditRows();
    setStatus('stockEditSearchStatus',`Modifiche salvate. Il pallet contiene ora ${remaining.length} righe di giacenza.`,'good');
  }else{
    stockEditRowsDraft=[];$('stockEditRows').innerHTML='';$('stockEditEditor').classList.add('hidden');
    setStatus('stockEditSearchStatus','Modifiche salvate. Il pallet di origine non contiene più giacenze.','good');
  }
  if(typeof renderStock==='function'&&$('searchInput'))renderStock();
  alert('Modifiche alla giacenza salvate correttamente.');
}
