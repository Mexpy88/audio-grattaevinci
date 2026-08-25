/* REMOTO manual MODIFICA renderer + carton-request stock refresh.
   Voice remains optional: manual stock rows are always rendered and editable.
   Carton request drafts are re-synced with current stock after rectifications,
   preserving still-valid operator input whenever the physical row still exists. */
(function installManualEditRequestRefreshFix(){
  'use strict';
  if(window.WarehouseManualEditRequestRefreshFix)return;

  const VERSION='2026.08.25-manual-refresh1';
  const STATES=['NUOVO','SCARICATO','USATO','NON_CHIARO'];
  const $id=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const article=v=>{try{return typeof normalizeArticle==='function'?normalizeArticle(v,true):norm(v)}catch{return norm(v)}};
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const escHtml=v=>typeof esc==='function'?esc(v):text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const hasPosition=(loc,pallet)=>!!(norm(loc)||norm(pallet));
  const positionMatches=(r,loc,pallet)=>{const l=norm(loc),p=norm(pallet);return hasPosition(l,p)&&(!l||locOf(r)===l)&&(!p||norm(r?.bancale)===p)};
  const positionText=(loc,pallet)=>{const l=norm(loc),p=norm(pallet);if(l&&p)return `Fila/Scaffale ${l} · Bancale/Carrello ${p}`;if(l)return `Fila/Scaffale ${l}`;if(p)return `Bancale/Carrello ${p}`;return 'Posizione non indicata'};
  const stockRows=()=>{try{return typeof stockBuckets==='function'?stockBuckets():[]}catch{return []}};
  const isCartonRequest=req=>!!req&&(req.quantity_unit==='CARTONI'||Number(req.request_schema||0)>=2);
  const lineKey=l=>article(l?.article_base)+'|'+norm(l?.size);
  const cartonsRequested=l=>Math.max(0,Math.floor(Number(l?.cartons??l?.quantity)||0));
  const cartonsOfItem=i=>Math.max(0,Math.floor(Number(i?.cartons??i?.quantity)||0));
  const allocationKey=(a,requestedKey='')=>[requestedKey||a?.requestedKey||'',article(a?.article_base),norm(a?.size),norm(a?.state),locOf(a),norm(a?.bancale)].join('|');

  function currentRowsAtPosition(loc,pallet){
    const flex=window.WarehouseFlexPositionV2;
    if(flex?.positionRows){try{return flex.positionRows(loc,pallet)}catch{}}
    return stockRows().filter(r=>positionMatches(r,loc,pallet));
  }

  function safeManualRowHtml(r,i){
    const disabled=r?.deleted?'disabled':'';
    const original=r?.original||null;
    const origin=original
      ?`Prima: ${escHtml(original.article_base)}${original.size?` · ${escHtml(original.size)}`:''} · Qtà ${Number(original.quantity)||0} · ${escHtml(original.state||'NON_CHIARO')} · ${escHtml(locOf(original)||'—')} / ${escHtml(original.bancale||'—')}`
      :'Nuova riga';
    const state=STATES.includes(norm(r?.state))?norm(r.state):'NON_CHIARO';
    return `<div class="stockEditRow ${r?.deleted?'deleted':''}" data-manual-edit-row="${i}">
      <div class="stockEditHead"><b>Riga ${i+1}</b><button type="button" class="mini ${r?.deleted?'':'danger'}" onclick="toggleStockEditDelete('${escHtml(r?.edit_id||'')}')">${r?.deleted?'RIPRISTINA':'ELIMINA'}</button></div>
      <div class="stockEditOrigin">${origin}</div>
      <label>Articolo<input class="field" ${disabled} value="${escHtml(r?.article_base||'')}" oninput="editStockDraft('${escHtml(r?.edit_id||'')}','article_base',this.value)"></label>
      <div class="twoCols">
        <label>Taglia<input class="field" ${disabled} value="${escHtml(r?.size||'')}" oninput="editStockDraft('${escHtml(r?.edit_id||'')}','size',this.value)"></label>
        <label>Quantità<input class="field" ${disabled} type="number" min="0" value="${Math.max(0,Number(r?.quantity)||0)}" oninput="editStockDraft('${escHtml(r?.edit_id||'')}','quantity',this.value)"></label>
      </div>
      <label>Stato<select class="field" ${disabled} onchange="editStockDraft('${escHtml(r?.edit_id||'')}','state',this.value)">${STATES.map(s=>`<option ${s===state?'selected':''}>${s}</option>`).join('')}</select></label>
      <div class="twoCols">
        <label>Fila/Scaffale<input class="field" ${disabled} value="${escHtml(r?.fila_scaffale||'')}" oninput="editStockDraft('${escHtml(r?.edit_id||'')}','fila_scaffale',this.value)"></label>
        <label>Bancale/Carrello<input class="field" ${disabled} value="${escHtml(r?.bancale||'')}" oninput="editStockDraft('${escHtml(r?.edit_id||'')}','bancale',this.value)"></label>
      </div>
    </div>`;
  }

  function renderManualRows(){
    const drafts=typeof stockEditRowsDraft!=='undefined'&&Array.isArray(stockEditRowsDraft)?stockEditRowsDraft:[];
    const summary=$id('stockEditSummary'),holder=$id('stockEditRows');
    const loc=typeof stockEditSource!=='undefined'?stockEditSource?.fila_scaffale||'':'';
    const pallet=typeof stockEditSource!=='undefined'?stockEditSource?.bancale||'':'';
    if(summary)summary.textContent=`${positionText(loc,pallet)} · ${drafts.filter(r=>!r.deleted).length} righe attive`;
    if(holder)holder.innerHTML=drafts.map(safeManualRowHtml).join('');
    try{window.WarehouseRectificationFlags?.decorateRows?.()}catch{}
    return drafts.length;
  }

  function clearStaleVoiceReview(){
    $id('voiceFlexPositionReview')?.remove();
    $id('voiceModifyReview')?.remove();
    document?.querySelectorAll?.('#stockEditScreen .voiceStatus')?.forEach(el=>{el.textContent='Puoi usare DETTA RETTIFICHE oppure modificare manualmente le righe qui sotto.';el.className='voiceStatus'});
  }

  function loadManualPosition(){
    if(typeof requireLogin==='function'&&!requireLogin())return false;
    const loc=norm($id('stockEditLocation')?.value),pallet=norm($id('stockEditPallet')?.value);
    if(!hasPosition(loc,pallet)){alert('Inserisci Fila/Scaffale oppure Bancale/Carrello.');return false}
    if(typeof stockEditSource!=='undefined')stockEditSource={fila_scaffale:loc,bancale:pallet};
    const rows=currentRowsAtPosition(loc,pallet);
    if(!rows.length){
      if(typeof stockEditRowsDraft!=='undefined')stockEditRowsDraft=[];
      $id('stockEditEditor')?.classList.add('hidden');
      if(typeof setStatus==='function')setStatus('stockEditSearchStatus',`Nessuna giacenza trovata · ${positionText(loc,pallet)}.`,'error');
      return false;
    }
    if(typeof stockEditBuildDraft==='function')stockEditBuildDraft(rows);
    if(typeof setStatus==='function')setStatus('stockEditSearchStatus',`Posizione trovata · ${rows.length} righe · ${positionText(loc,pallet)}.`,'good');
    $id('stockEditEditor')?.classList.remove('hidden');
    clearStaleVoiceReview();
    renderManualRows();
    return true;
  }

  function addManualRow(){
    const loc=typeof stockEditSource!=='undefined'?norm(stockEditSource?.fila_scaffale):'';
    const pallet=typeof stockEditSource!=='undefined'?norm(stockEditSource?.bancale):'';
    if(!hasPosition(loc,pallet))return alert('Cerca prima una posizione da modificare.');
    stockEditRowsDraft.push({edit_id:typeof uid==='function'?uid():String(Date.now()),original:null,deleted:false,article_base:'',size:'',quantity:0,state:'NUOVO',fila_scaffale:loc,bancale:pallet});
    renderManualRows();
    setTimeout(()=>{const rows=document.querySelectorAll('#stockEditRows .stockEditRow');rows[rows.length-1]?.scrollIntoView?.({behavior:'smooth',block:'center'})},30);
  }

  function deliveredCartons(req){
    const map=new Map();
    for(const d of (req?.deliveries||[]))for(const i of (d?.items||[])){
      if(i?.extra)continue;const k=lineKey(i);map.set(k,(map.get(k)||0)+cartonsOfItem(i));
    }
    return map;
  }

  function stocksForLine(line,rows){
    const a=article(line?.article_base),s=norm(line?.size);
    return (rows||stockRows()).filter(r=>article(r?.article_base)===a&&norm(r?.size)===s&&Number(r?.quantity)>0);
  }

  function syncCartonDraft(req,rows=stockRows()){
    if(!isCartonRequest(req))return req?.draft||null;
    if(!req.draft)req.draft={allocations:[],extraAllocations:[],note:''};
    const oldAlloc=Array.isArray(req.draft.allocations)?req.draft.allocations:[];
    const oldExtra=Array.isArray(req.draft.extraAllocations)?req.draft.extraAllocations:[];
    const oldByKey=new Map(oldAlloc.map(a=>[allocationKey(a,a.requestedKey),a]));
    const done=deliveredCartons(req),next=[];

    for(const line of (req.lines||[])){
      const requestedKey=lineKey(line),remaining=Math.max(0,cartonsRequested(line)-Number(done.get(requestedKey)||0));
      if(remaining<=0)continue;
      const stocks=stocksForLine(line,rows);
      if(!stocks.length){
        next.push({id:typeof uid==='function'?uid():`${requestedKey}-missing`,requestedKey,article_base:article(line.article_base),size:norm(line.size),state:'',fila_scaffale:'',fila:'',scaffale:'',bancale:'',available:0,remainingCartons:remaining,cartons:0,quantity:0,checked:false,note:'',extra:false,missing:true});
        continue;
      }
      for(const s of stocks){
        const probe={requestedKey,article_base:s.article_base,size:s.size,state:s.state,fila_scaffale:locOf(s),bancale:norm(s.bancale)};
        const old=oldByKey.get(allocationKey(probe,requestedKey));
        const available=Math.max(0,Math.floor(Number(s.quantity)||0));
        const quantity=Math.min(Math.max(0,Math.floor(Number(old?.quantity)||0)),available);
        const cartons=Math.max(0,Math.floor(Number(old?.cartons)||0));
        next.push({id:old?.id||(typeof uid==='function'?uid():`${requestedKey}-${next.length}`),requestedKey,article_base:s.article_base,size:s.size,state:s.state,fila_scaffale:locOf(s),fila:locOf(s),scaffale:'',bancale:norm(s.bancale),available,remainingCartons:remaining,cartons,quantity,checked:!!old?.checked&&quantity>0,note:old?.note||'',extra:false});
      }
    }

    const refreshedExtra=oldExtra.map(a=>{
      const match=(rows||[]).find(s=>article(s.article_base)===article(a.article_base)&&norm(s.size)===norm(a.size)&&norm(s.state)===norm(a.state)&&locOf(s)===locOf(a)&&norm(s.bancale)===norm(a.bancale));
      if(!match)return {...a,available:0,quantity:0,checked:false,missing:true};
      const available=Math.max(0,Math.floor(Number(match.quantity)||0)),quantity=Math.min(Math.max(0,Math.floor(Number(a.quantity)||0)),available);
      return {...a,available,quantity,checked:!!a.checked&&quantity>0,missing:false,fila_scaffale:locOf(match),fila:locOf(match),bancale:norm(match.bancale)};
    });

    req.draft={...req.draft,allocations:next,extraAllocations:refreshedExtra};
    return req.draft;
  }

  function activeRequest(){
    try{const id=typeof activeRequestId!=='undefined'?activeRequestId:null;return id?(db?.requests||[]).find(r=>r.id===id)||null:null}catch{return null}
  }

  function refreshActiveRequestAfterRectification(){
    const req=activeRequest();if(!req||!isCartonRequest(req))return false;
    syncCartonDraft(req,stockRows());
    try{if(typeof saveDb==='function')saveDb()}catch{}
    try{if($id('requestDetail')?.classList.contains('on')&&typeof window.renderRequestDetail==='function')window.renderRequestDetail(req)}catch{}
    return true;
  }

  function activeRectCount(){try{return (db?.rectifications||[]).filter(r=>!r.cancelled_at).length}catch{return 0}}

  function install(){
    if(typeof document==='undefined')return true;

    window.renderStockEditRows=renderManualRows;
    window.loadStockPallet=loadManualPosition;
    window.addStockEditRow=addManualRow;

    if(typeof window.ensureDraftAllocations==='function'&&!window.ensureDraftAllocations.__warehouseLiveStockRefresh){
      const baseEnsure=window.ensureDraftAllocations;
      const wrapped=function(req){if(isCartonRequest(req))return syncCartonDraft(req,stockRows());return baseEnsure.apply(this,arguments)};
      wrapped.__warehouseLiveStockRefresh=true;wrapped.__warehousePrevious=baseEnsure;window.ensureDraftAllocations=wrapped;
    }

    if(typeof window.openRequestDetail==='function'&&!window.openRequestDetail.__warehouseLiveStockRefresh){
      const baseOpen=window.openRequestDetail;
      const wrapped=function(id){try{const req=(db?.requests||[]).find(r=>r.id===id);if(isCartonRequest(req))syncCartonDraft(req,stockRows())}catch{}return baseOpen.apply(this,arguments)};
      wrapped.__warehouseLiveStockRefresh=true;wrapped.__warehousePrevious=baseOpen;window.openRequestDetail=wrapped;
    }

    if(typeof window.saveStockEdit==='function'&&!window.saveStockEdit.__warehouseRequestRefresh){
      const baseSave=window.saveStockEdit;
      const wrapped=function(){const before=activeRectCount(),out=baseSave.apply(this,arguments),after=activeRectCount();if(after>before)refreshActiveRequestAfterRectification();return out};
      wrapped.__warehouseRequestRefresh=true;wrapped.__warehousePrevious=baseSave;window.saveStockEdit=wrapped;
    }

    try{window.WarehouseRectificationFlags?.install?.()}catch{}
    return true;
  }

  window.WarehouseManualEditRequestRefreshFix={version:VERSION,positionText,positionMatches,currentRowsAtPosition,safeManualRowHtml,renderManualRows,syncCartonDraft,refreshActiveRequestAfterRectification,install};
  if(typeof document!=='undefined')install();
})();
