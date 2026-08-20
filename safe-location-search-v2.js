/* Safe Location/Search V2 — built on the confirmed stable bc5c469 base.
   Scope only: Fila/Scaffale OR Bancale/Carrello, exact article+size search,
   grouped expandable availability. No swipe, no router hooks, no DOM observers. */
(function installSafeLocationSearchV2(){
  'use strict';
  if(window.WarehouseSafeLocationSearchV2)return;

  const VERSION='2026.08.20-safe2';
  const VALID_STATES=['NUOVO','SCARICATO','USATO'];
  let undoBatch=null,undoTimer=null;

  const $id=id=>document.getElementById(id);
  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const html=v=>typeof esc==='function'?esc(v):text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const articleOf=r=>typeof normalizeArticle==='function'?normalizeArticle(r?.article_base||''):norm(r?.article_base||'');
  const nowIso=()=>new Date().toISOString();

  function positionValid(location,pallet){return !!(norm(location)||norm(pallet))}

  function canonicalQuery(q){
    return norm(q).replace(/\s*-\s*/g,'-').replace(/\s+/g,'-').replace(/-+/g,'-');
  }

  function buildSearchContext(rows,q){
    const query=norm(q),canonical=canonicalQuery(q),exactMap=new Map();
    for(const r of rows||[]){
      const article=articleOf(r),size=norm(r?.size);
      if(article&&size)exactMap.set(`${article}-${size}`,{article,size});
    }
    const exact=exactMap.get(canonical)||null;
    const tokens=exact?[]:query.replace(/\s*-\s*/g,' ').replace(/-/g,' ').split(/\s+/).filter(Boolean);
    return {query,canonical,exact,tokens};
  }

  function rowMatchesWithContext(row,ctx){
    if(!ctx?.query)return true;
    if(ctx.exact)return articleOf(row)===ctx.exact.article&&norm(row?.size)===ctx.exact.size;
    const hay=[articleOf(row),norm(row?.size),norm(row?.state),locOf(row),norm(row?.bancale)].join(' ').replace(/-/g,' ');
    return ctx.tokens.every(t=>hay.includes(t));
  }

  function rowMatches(row,q,allRows){return rowMatchesWithContext(row,buildSearchContext(allRows||[row],q))}

  function groupRows(rows){
    const map=new Map();
    for(const r of rows||[]){
      const article=articleOf(r),size=norm(r?.size),key=`${article}|${size}`;
      if(!map.has(key))map.set(key,{article,size,total:0,rows:[]});
      const g=map.get(key);g.total+=Number(r?.quantity||0);g.rows.push(r);
    }
    return [...map.values()].sort((a,b)=>(a.article+a.size).localeCompare(b.article+b.size));
  }

  function injectStyles(){
    if($id('safeSearchV2Styles'))return;
    const style=document.createElement('style');style.id='safeSearchV2Styles';style.textContent=`
      .ssv2Group{background:#fff;border:1px solid #dae5ee;border-radius:21px;margin:10px 0;box-shadow:0 7px 21px #15395810;overflow:hidden}
      .ssv2Group>summary{list-style:none;cursor:pointer;padding:15px;user-select:none}
      .ssv2Group>summary::-webkit-details-marker{display:none}
      .ssv2Summary{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .ssv2Hint{margin-top:7px;color:#65788c;font-size:12px;font-weight:850;display:flex;align-items:center;gap:6px}
      .ssv2Hint:before{content:'⌄';font-size:18px;color:#2c60aa}
      .ssv2Group[open] .ssv2Hint:before{content:'⌃'}
      .ssv2List{padding:0 12px 12px;border-top:1px solid #e5edf3}
      .ssv2Avail{background:#f7fafc;border:1px solid #dce6ee;border-radius:16px;padding:12px;margin-top:10px}
      .ssv2AvailHead{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .ssv2Qty{font-size:20px;font-weight:950;color:#2c60aa}
      .ssv2State{font-size:12px;font-weight:950;border-radius:999px;background:#e9f0f5;padding:5px 8px}
      .ssv2Empty{background:#fff;border:1px solid #dce6ef;border-radius:20px;padding:16px;color:#65788c}
      .ssv2PosHint{display:block;color:#65788c;font-size:12px;font-weight:750;margin-top:5px}
    `;document.head.appendChild(style);
  }

  function setPositionLabels(){
    const defs=[
      ['filaScaffale','Fila/Scaffale','Es. 13'],['bancale','Bancale / Carrello','Es. 38'],
      ['stockEditLocation','Fila/Scaffale','Es. 13'],['stockEditPallet','Bancale / Carrello','Es. 38']
    ];
    for(const [id,title,ph] of defs){
      const input=$id(id);if(!input)continue;input.placeholder=ph;
      const label=input.closest?.('label');if(!label)continue;
      const first=[...label.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(first)first.textContent=title;
      if(!label.querySelector('.ssv2PosHint')){const n=document.createElement('small');n.className='ssv2PosHint';n.textContent='Compila almeno uno tra Fila/Scaffale e Bancale/Carrello.';label.appendChild(n)}
    }
  }

  function installFlexiblePosition(){
    setPositionLabels();
    window.validateLocation=function(){
      const loc=norm($id('filaScaffale')?.value),pal=norm($id('bancale')?.value);
      if(!positionValid(loc,pal)){
        alert('Inserisci almeno una posizione: Fila/Scaffale oppure Bancale/Carrello.');
        $id('filaScaffale')?.focus();return false;
      }
      return true;
    };

    window.stockEditRowsAtSource=function(){
      const loc=norm(stockEditSource?.fila_scaffale),pal=norm(stockEditSource?.bancale);
      if(!positionValid(loc,pal))return [];
      return (typeof stockBuckets==='function'?stockBuckets():[]).filter(s=>(!loc||locOf(s)===loc)&&(!pal||norm(s?.bancale)===pal));
    };

    window.loadStockPallet=function(){
      if(!requireLogin())return;
      const loc=norm($id('stockEditLocation')?.value),pal=norm($id('stockEditPallet')?.value);
      if(!positionValid(loc,pal)){
        alert('Inserisci almeno Fila/Scaffale oppure Bancale/Carrello.');$id('stockEditLocation')?.focus();return;
      }
      stockEditSource={fila_scaffale:loc,bancale:pal};
      const rows=window.stockEditRowsAtSource();
      if(!rows.length){stockEditRowsDraft=[];$id('stockEditEditor')?.classList.add('hidden');setStatus('stockEditSearchStatus','Nessuna giacenza trovata nella posizione indicata.','error');return}
      stockEditBuildDraft(rows);setStatus('stockEditSearchStatus',`Trovate ${rows.length} righe${loc?' · Fila/Scaffale '+loc:''}${pal?' · Bancale/Carrello '+pal:''}.`,'good');$id('stockEditEditor')?.classList.remove('hidden');renderStockEditRows();
    };

    window.addStockEditRow=function(){
      const loc=norm(stockEditSource?.fila_scaffale),pal=norm(stockEditSource?.bancale);
      if(!positionValid(loc,pal))return alert('Cerca prima una Fila/Scaffale o un Bancale/Carrello da modificare.');
      stockEditRowsDraft.push({edit_id:uid(),original:null,deleted:false,article_base:'',size:'',quantity:0,state:'NUOVO',fila_scaffale:loc,bancale:pal});
      renderStockEditRows();
    };

    window.renderStockEditRows=function(){
      const active=stockEditRowsDraft.filter(r=>!r.deleted).length,loc=norm(stockEditSource?.fila_scaffale),pal=norm(stockEditSource?.bancale);
      if($id('stockEditSummary'))$id('stockEditSummary').textContent=[loc?`Fila/Scaffale ${loc}`:'',pal?`Bancale/Carrello ${pal}`:'',`${active} righe attive`].filter(Boolean).join(' · ');
      if($id('stockEditRows'))$id('stockEditRows').innerHTML=stockEditRowsDraft.map(stockEditRowHtml).join('');
    };
  }

  function normalizeStockRow(r){
    const state=VALID_STATES.includes(norm(r?.state))?norm(r.state):norm(r?.state||'NON_CHIARO');
    return {article_base:articleOf(r),size:norm(r?.size),quantity:Math.max(0,Number(r?.quantity)||0),state,fila_scaffale:locOf(r),fila:locOf(r),scaffale:'',bancale:norm(r?.bancale)};
  }
  function rowKey(r){return [articleOf(r),norm(r?.size),norm(r?.state||'NON_CHIARO'),locOf(r),norm(r?.bancale)].join('|')}
  function sameRow(a,b){if(!a||!b)return a===b;return rowKey(a)===rowKey(b)&&Math.abs(Number(a.quantity||0)-Number(b.quantity||0))<1e-9}
  function describeRect(before,after){
    const p=[];if(!before&&after)return `RETTIFICA AGGIUNTA · ${after.quantity} pezzi`;if(before&&!after)return `RETTIFICA RIMOZIONE · ${before.quantity} pezzi`;if(!before||!after)return 'RETTIFICA';
    if(articleOf(before)!==articleOf(after))p.push(`Articolo: ${articleOf(before)||'—'} → ${articleOf(after)||'—'}`);
    if(norm(before.size)!==norm(after.size))p.push(`Taglia: ${norm(before.size)||'—'} → ${norm(after.size)||'—'}`);
    if(norm(before.state)!==norm(after.state))p.push(`Stato: ${norm(before.state)||'—'} → ${norm(after.state)||'—'}`);
    if(locOf(before)!==locOf(after))p.push(`Fila/Scaffale: ${locOf(before)||'—'} → ${locOf(after)||'—'}`);
    if(norm(before.bancale)!==norm(after.bancale))p.push(`Bancale/Carrello: ${norm(before.bancale)||'—'} → ${norm(after.bancale)||'—'}`);
    if(Number(before.quantity||0)!==Number(after.quantity||0))p.push(`Quantità: ${Number(before.quantity||0)} → ${Number(after.quantity||0)}`);
    return 'RETTIFICA · '+(p.join(' · ')||'dati confermati');
  }
  function ensureRectifications(){if(!Array.isArray(db.rectifications))db.rectifications=[];return db.rectifications}
  function validateBeforeRows(changes){
    const available=new Map((typeof stockBuckets==='function'?stockBuckets():[]).map(x=>[rowKey(x),Number(x.quantity||0)])),needed=new Map();
    for(const c of changes){if(!c.before)continue;const k=rowKey(c.before);needed.set(k,(needed.get(k)||0)+Number(c.before.quantity||0))}
    for(const [k,q] of needed){if((available.get(k)||0)+1e-9<q)return {ok:false,available:available.get(k)||0,needed:q}}
    return {ok:true};
  }
  function showRectUndo(batchId,count){
    undoBatch=batchId;clearTimeout(undoTimer);$id('uxSnackbar')?.remove();
    const s=document.createElement('div');s.id='uxSnackbar';s.className='uxSnackbar';s.innerHTML=`<span>${count} rettifiche salvate · Nessun CARICA/SCARICA creato.</span><button type="button">ANNULLA</button>`;document.body.appendChild(s);
    s.querySelector('button').onclick=()=>undoRectBatch(batchId);
    undoTimer=setTimeout(()=>{s.remove();if(undoBatch===batchId)undoBatch=null},15000);
  }
  function undoRectBatch(batchId){
    if(!batchId||undoBatch!==batchId)return;const at=nowIso(),items=ensureRectifications().filter(r=>r.batch_id===batchId&&!r.cancelled_at);if(!items.length)return;
    for(const r of items){const before=clone(r);r.cancelled_at=at;r.updated_at=at;if(typeof audit==='function')audit('CANCEL','RECTIFICATION',r.id,before,clone(r))}
    saveDb();undoBatch=null;$id('uxSnackbar')?.remove();window.renderStock?.();window.renderRegistry?.();window.LocalMaster?.renderPanel?.();if(typeof warehouseToast==='function')warehouseToast('Rettifica annullata.','success');
  }

  function installRectificationSave(){
    window.saveStockEdit=function(){
      if(!requireLogin())return;if(!stockEditRowsDraft.length)return alert('Cerca prima una posizione da modificare.');
      const changes=[];
      for(const draft of stockEditRowsDraft){
        const before=draft.original?normalizeStockRow(draft.original):null;
        const after=(!draft.deleted&&Number(draft.quantity)>0)?normalizeStockRow(draft):null;
        if(after){if(!after.article_base)return alert('Completa il codice articolo in tutte le righe attive.');if(!positionValid(after.fila_scaffale,after.bancale))return alert('Ogni riga attiva deve avere almeno Fila/Scaffale oppure Bancale/Carrello.')}
        if(sameRow(before,after)||(!before&&!after))continue;changes.push({before,after});
      }
      if(!changes.length)return alert('Nessuna modifica da salvare.');
      const check=validateBeforeRows(changes);if(!check.ok)return alert(`La giacenza è cambiata. Disponibili ${check.available}, attesi ${check.needed}. Cerca di nuovo la posizione e riprova.`);
      const lines=changes.map(c=>describeRect(c.before,c.after)).join('\n');
      if(!confirm(`Confermi ${changes.length} rettifiche?\n\n${lines}\n\nNon verrà creato alcun CARICA o SCARICA.`))return;
      const batchId=uid(),at=nowIso(),store=ensureRectifications();
      for(const c of changes){const rec={id:uid(),batch_id:batchId,type:'RETTIFICA',operator:operatorName(),registered_at:at,operation_at:at,updated_at:at,cancelled_at:null,before:c.before?clone(c.before):null,after:c.after?clone(c.after):null,note:describeRect(c.before,c.after)};store.unshift(rec);if(typeof audit==='function')audit('CREATE','RECTIFICATION',rec.id,null,clone(rec))}
      saveDb();const remaining=window.stockEditRowsAtSource();
      if(remaining.length){stockEditBuildDraft(remaining);renderStockEditRows();setStatus('stockEditSearchStatus',`Rettifiche salvate. Restano ${remaining.length} righe nella posizione di origine.`,'good')}
      else{stockEditRowsDraft=[];if($id('stockEditRows'))$id('stockEditRows').innerHTML='';$id('stockEditEditor')?.classList.add('hidden');setStatus('stockEditSearchStatus','Rettifica salvata. La posizione di origine non contiene più giacenze.','good')}
      window.renderStock?.();window.renderRegistry?.();window.LocalMaster?.renderPanel?.();showRectUndo(batchId,changes.length);if(typeof warehouseToast==='function')warehouseToast('Rettifica salvata senza movimenti fittizi.','success');
    };
  }

  function availabilityHtml(r){
    const loc=locOf(r),pal=norm(r?.bancale),payload=encodeURIComponent(JSON.stringify({article_base:articleOf(r),size:norm(r?.size),state:norm(r?.state||'NUOVO'),fila_scaffale:loc,bancale:pal}));
    return `<div class="ssv2Avail"><div class="ssv2AvailHead"><div class="ssv2Qty">${Number(r?.quantity||0).toLocaleString('it-IT')} pz</div><div class="ssv2State">${html(norm(r?.state)||'—')}</div></div><div class="meta">${loc?`<span>Fila/Scaffale ${html(loc)}</span>`:''}${pal?`<span>Bancale/Carrello ${html(pal)}</span>`:''}${!loc&&!pal?'<span>POSIZIONE NON ASSEGNATA</span>':''}</div><div class="uxQuickActions"><button type="button" class="uxQuickOut" onclick="uxQuickOperation('SCARICA','${payload}')">SCARICA</button><button type="button" class="uxQuickIn" onclick="uxQuickOperation('CARICA','${payload}')">CARICA</button><button type="button" class="uxQuickEdit" onclick="uxQuickEdit('${payload}')">MODIFICA</button></div></div>`;
  }

  function renderGroupedStock(){
    const input=$id('searchInput'),list=$id('stockList');if(!input||!list)return;
    const q=input.value||'',state=norm($id('uxSearchState')?.value);
    if(!norm(q)&&!state){const summary=$id('uxSearchSummary');if(summary)summary.textContent='Scrivi un articolo, una taglia, una fila o un bancale/carrello.';list.innerHTML='<div class="ssv2Empty">Esempio: <b>I00215-S</b>, <b>I00215 S</b> oppure <b>I00215 - S</b>.</div>';return}
    const all=typeof stockBuckets==='function'?stockBuckets():[],ctx=buildSearchContext(all,q);
    const filtered=[];for(const r of all){if(rowMatchesWithContext(r,ctx)&&(!state||norm(r?.state)===state))filtered.push(r)}
    const groups=groupRows(filtered),total=filtered.reduce((a,r)=>a+Number(r?.quantity||0),0),summary=$id('uxSearchSummary');if(summary)summary.textContent=`${groups.length} articolo/taglia · ${filtered.length} disponibilità · ${total.toLocaleString('it-IT')} pezzi`;
    if(!groups.length){list.innerHTML='<p>Nessuna giacenza trovata.</p>';return}
    list.innerHTML=groups.slice(0,120).map(g=>{const avail=g.rows.slice().sort((a,b)=>(locOf(a)+norm(a?.bancale)+norm(a?.state)).localeCompare(locOf(b)+norm(b?.bancale)+norm(b?.state)));return `<details class="ssv2Group"><summary><div class="ssv2Summary"><div><div class="sku">${html(g.article)}${g.size?` · ${html(g.size)}`:''}</div><div class="ssv2Hint">${avail.length} disponibilità · mostra posizioni</div></div><div class="bigQty">${Number(g.total||0).toLocaleString('it-IT')}</div></div></summary><div class="ssv2List">${avail.map(availabilityHtml).join('')}</div></details>`}).join('');
    if(groups.length>120)list.insertAdjacentHTML('beforeend',`<div class="status warn">Mostro i primi 120 gruppi su ${groups.length}. Restringi la ricerca.</div>`);
  }

  function install(){
    injectStyles();installFlexiblePosition();installRectificationSave();
    window.renderStock=renderGroupedStock;
    setPositionLabels();
    // Deliberately no input listener: base.html already calls renderStock() from oninput.
    // Deliberately no MutationObserver, no touch handlers, no navigation/router overrides.
  }

  window.WarehouseSafeLocationSearchV2={version:VERSION,positionValid,canonicalQuery,buildSearchContext,rowMatches,rowMatchesWithContext,groupRows,render:renderGroupedStock,install};
  install();
})();