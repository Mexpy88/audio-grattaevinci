/* Safe location + grouped search enhancements.
   Adds: Fila/Scaffale OR Bancale/Carrello, exact article+size search,
   grouped availability dropdowns. No swipe, no router hooks. */
(function installWarehouseLocationSearch(){
  'use strict';
  if(window.WarehouseLocationSearch)return;

  const VERSION='2026.08.20-location-search-safe1';
  const VALID_STATES=['NUOVO','SCARICATO','USATO'];
  let rectUndoBatch=null,rectUndoTimer=null;

  const byId=id=>document.getElementById(id);
  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const html=v=>typeof esc==='function'?esc(v):text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const articleOf=r=>typeof normalizeArticle==='function'?normalizeArticle(r?.article_base||''):norm(r?.article_base||'');
  const nowIso=()=>new Date().toISOString();

  function positionValid(location,pallet){return !!(norm(location)||norm(pallet))}

  function normalizeQuery(q){
    return norm(q).replace(/\s*-\s*/g,'-').replace(/\s+/g,' ').trim();
  }

  function exactArticleSize(q,rows){
    const query=normalizeQuery(q);if(!query)return null;
    const seen=new Set();
    for(const r of rows||[]){
      const article=articleOf(r),size=norm(r?.size);if(!article||!size)continue;
      const key=article+'|'+size;if(seen.has(key))continue;seen.add(key);
      if(query===`${article}-${size}`||query===`${article} ${size}`)return {article,size};
    }
    return null;
  }

  function rowMatches(row,q,allRows){
    const query=normalizeQuery(q);if(!query)return true;
    const exact=exactArticleSize(query,allRows||[row]);
    if(exact)return articleOf(row)===exact.article&&norm(row?.size)===exact.size;
    const tokens=query.replace(/-/g,' ').split(/\s+/).filter(Boolean);
    const hay=[articleOf(row),norm(row?.size),norm(row?.state),locOf(row),norm(row?.bancale)].join(' ').replace(/-/g,' ');
    return tokens.every(t=>hay.includes(t));
  }

  function groupRows(rows){
    const map=new Map();
    for(const r of rows||[]){
      const article=articleOf(r),size=norm(r?.size),key=article+'|'+size;
      if(!map.has(key))map.set(key,{article,size,total:0,rows:[]});
      const g=map.get(key);g.total+=Number(r?.quantity||0);g.rows.push(r);
    }
    return [...map.values()].sort((a,b)=>(a.article+a.size).localeCompare(b.article+b.size));
  }

  function injectStyles(){
    if(byId('lsaStyles'))return;
    const s=document.createElement('style');s.id='lsaStyles';s.textContent=`
      .lsaGroup{background:#fff;border:1px solid #dae5ee;border-radius:21px;margin:10px 0;box-shadow:0 7px 21px #15395810;overflow:hidden}
      .lsaGroup>summary{list-style:none;cursor:pointer;padding:15px;user-select:none}
      .lsaGroup>summary::-webkit-details-marker{display:none}
      .lsaGroupSummary{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .lsaGroupHint{margin-top:7px;color:#65788c;font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px}
      .lsaGroupHint:before{content:'⌄';font-size:18px;color:#2c60aa;transition:transform .16s ease}
      .lsaGroup[open] .lsaGroupHint:before{transform:rotate(180deg)}
      .lsaAvailList{padding:0 12px 12px;border-top:1px solid #e5edf3}
      .lsaAvail{background:#f7fafc;border:1px solid #dce6ee;border-radius:16px;padding:12px;margin-top:10px}
      .lsaAvailHead{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .lsaAvailQty{font-size:20px;font-weight:950;color:#2c60aa}
      .lsaAvailState{font-size:12px;font-weight:950;border-radius:999px;background:#e9f0f5;padding:5px 8px}
      .lsaPositionHelp{display:block;color:#65788c;font-size:12px;font-weight:750;margin-top:5px}
      .lsaEmptySearch{background:#fff;border:1px solid #dce6ef;border-radius:20px;padding:16px;color:#65788c}
      @media(max-width:430px){.lsaAvail .uxQuickActions{grid-template-columns:repeat(3,1fr)}}
    `;document.head.appendChild(s);
  }

  function updatePositionLabels(){
    const pairs=[
      [byId('filaScaffale'),'Fila/Scaffale','Es. 13 · lascia vuoto se usi Bancale/Carrello'],
      [byId('bancale'),'Bancale / Carrello','Es. 38 · lascia vuoto se usi Fila/Scaffale'],
      [byId('stockEditLocation'),'Fila/Scaffale','Puoi cercare anche solo per Fila/Scaffale'],
      [byId('stockEditPallet'),'Bancale / Carrello','Puoi cercare anche solo per Bancale/Carrello']
    ];
    for(const [input,labelText,placeholder] of pairs){
      if(!input)continue;input.placeholder=placeholder;
      const label=input.closest('label');if(!label)continue;
      for(const n of label.childNodes){if(n.nodeType===3&&n.textContent.trim())n.textContent=labelText+' '}
      let note=label.querySelector('.lsaPositionHelp');if(!note){note=document.createElement('small');note.className='lsaPositionHelp';label.appendChild(note)}
      note.textContent='Compila almeno uno tra Fila/Scaffale e Bancale/Carrello.';
    }
  }

  function installFlexiblePosition(){
    updatePositionLabels();
    window.validateLocation=function(){
      const loc=norm(byId('filaScaffale')?.value),pal=norm(byId('bancale')?.value);
      if(!positionValid(loc,pal)){
        alert('Inserisci almeno una posizione: Fila/Scaffale oppure Bancale/Carrello.');
        byId('filaScaffale')?.focus();return false;
      }
      return true;
    };

    if(typeof window.loadStockPallet==='function'){
      window.stockEditRowsAtSource=function(){
        const loc=norm(stockEditSource?.fila_scaffale),pal=norm(stockEditSource?.bancale);
        if(!positionValid(loc,pal))return [];
        return (typeof stockBuckets==='function'?stockBuckets():[]).filter(s=>(!loc||locOf(s)===loc)&&(!pal||norm(s?.bancale)===pal));
      };
      window.loadStockPallet=function(){
        if(!requireLogin())return;
        const loc=norm(byId('stockEditLocation')?.value),pal=norm(byId('stockEditPallet')?.value);
        if(!positionValid(loc,pal)){
          alert('Inserisci almeno Fila/Scaffale oppure Bancale/Carrello.');byId('stockEditLocation')?.focus();return;
        }
        stockEditSource={fila_scaffale:loc,bancale:pal};
        const rows=window.stockEditRowsAtSource();
        if(!rows.length){stockEditRowsDraft=[];byId('stockEditEditor')?.classList.add('hidden');setStatus('stockEditSearchStatus',`Nessuna giacenza trovata${loc?' in Fila/Scaffale '+loc:''}${pal?' · Bancale/Carrello '+pal:''}.`,'error');return}
        stockEditBuildDraft(rows);setStatus('stockEditSearchStatus',`Trovate ${rows.length} righe${loc?' · Fila/Scaffale '+loc:''}${pal?' · Bancale/Carrello '+pal:''}.`,'good');byId('stockEditEditor')?.classList.remove('hidden');renderStockEditRows();
      };
      window.addStockEditRow=function(){
        const loc=norm(stockEditSource?.fila_scaffale),pal=norm(stockEditSource?.bancale);
        if(!positionValid(loc,pal))return alert('Cerca prima una Fila/Scaffale o un Bancale/Carrello da modificare.');
        stockEditRowsDraft.push({edit_id:uid(),original:null,deleted:false,article_base:'',size:'',quantity:0,state:'NUOVO',fila_scaffale:loc,bancale:pal});
        renderStockEditRows();setTimeout(()=>{const rows=document.querySelectorAll('#stockEditRows .stockEditRow');rows[rows.length-1]?.scrollIntoView({behavior:'smooth',block:'center'})},30);
      };
      window.renderStockEditRows=function(){
        const active=stockEditRowsDraft.filter(r=>!r.deleted).length,loc=norm(stockEditSource?.fila_scaffale),pal=norm(stockEditSource?.bancale);
        const summary=[loc?`Fila/Scaffale ${loc}`:'',pal?`Bancale/Carrello ${pal}`:'',`${active} righe attive`].filter(Boolean).join(' · ');
        if(byId('stockEditSummary'))byId('stockEditSummary').textContent=summary;
        if(byId('stockEditRows'))byId('stockEditRows').innerHTML=stockEditRowsDraft.map(stockEditRowHtml).join('');
      };
    }
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
  function validateBeforeRows(changes){
    const available=new Map((typeof stockBuckets==='function'?stockBuckets():[]).map(x=>[rowKey(x),Number(x.quantity||0)])),needed=new Map();
    for(const c of changes){if(!c.before)continue;const k=rowKey(c.before);needed.set(k,(needed.get(k)||0)+Number(c.before.quantity||0))}
    for(const [k,q] of needed){if((available.get(k)||0)+1e-9<q)return {ok:false,available:available.get(k)||0,needed:q}}
    return {ok:true};
  }
  function ensureRectifications(){if(!Array.isArray(db.rectifications))db.rectifications=[];return db.rectifications}

  function showRectUndo(batchId,count){
    rectUndoBatch=batchId;clearTimeout(rectUndoTimer);byId('uxSnackbar')?.remove();
    const s=document.createElement('div');s.id='uxSnackbar';s.className='uxSnackbar';s.innerHTML=`<span>${count} rettifiche salvate · Nessun CARICA/SCARICA creato.</span><button type="button">ANNULLA</button>`;document.body.appendChild(s);
    s.querySelector('button').onclick=()=>undoRectBatch(batchId);
    rectUndoTimer=setTimeout(()=>{s.classList.add('fade');setTimeout(()=>s.remove(),260);if(rectUndoBatch===batchId)rectUndoBatch=null},15000);
  }
  function undoRectBatch(batchId){
    if(!batchId||rectUndoBatch!==batchId)return;const at=nowIso(),items=ensureRectifications().filter(r=>r.batch_id===batchId&&!r.cancelled_at);if(!items.length)return;
    for(const r of items){const before=clone(r);r.cancelled_at=at;r.updated_at=at;if(typeof audit==='function')audit('CANCEL','RECTIFICATION',r.id,before,clone(r))}
    saveDb();rectUndoBatch=null;byId('uxSnackbar')?.remove();window.renderStock?.();window.renderRegistry?.();window.LocalMaster?.renderPanel?.();if(typeof warehouseToast==='function')warehouseToast('Rettifica annullata.','success');
  }

  function installRectificationSave(){
    if(typeof window.saveStockEdit!=='function')return;
    window.saveStockEdit=function(){
      if(!requireLogin())return;if(!stockEditRowsDraft.length)return alert('Cerca prima una posizione da modificare.');
      const changes=[];
      for(const draft of stockEditRowsDraft){
        const before=draft.original?normalizeStockRow(draft.original):null;
        const after=(!draft.deleted&&Number(draft.quantity)>0)?normalizeStockRow(draft):null;
        if(after){
          if(!after.article_base)return alert('Completa il codice articolo in tutte le righe attive.');
          if(!positionValid(after.fila_scaffale,after.bancale))return alert('Ogni riga attiva deve avere almeno Fila/Scaffale oppure Bancale/Carrello.');
        }
        if(sameRow(before,after)||(!before&&!after))continue;changes.push({before,after});
      }
      if(!changes.length)return alert('Nessuna modifica da salvare.');
      const check=validateBeforeRows(changes);if(!check.ok)return alert(`La giacenza è cambiata. Disponibili ${check.available}, attesi ${check.needed}. Cerca di nuovo la posizione e riprova.`);
      const lines=changes.map(c=>describeRect(c.before,c.after)).join('\n');
      if(!confirm(`Confermi ${changes.length} rettifiche?\n\n${lines}\n\nNon verrà creato alcun CARICA o SCARICA.`))return;
      const batchId=uid(),at=nowIso(),store=ensureRectifications();
      for(const c of changes){
        const rec={id:uid(),batch_id:batchId,type:'RETTIFICA',operator:operatorName(),registered_at:at,operation_at:at,updated_at:at,cancelled_at:null,before:c.before?clone(c.before):null,after:c.after?clone(c.after):null,note:describeRect(c.before,c.after)};
        store.unshift(rec);if(typeof audit==='function')audit('CREATE','RECTIFICATION',rec.id,null,clone(rec));
      }
      saveDb();
      const remaining=window.stockEditRowsAtSource?window.stockEditRowsAtSource():[];
      if(remaining.length){stockEditBuildDraft(remaining);renderStockEditRows();setStatus('stockEditSearchStatus',`Rettifiche salvate. Restano ${remaining.length} righe nella posizione di origine.`,'good')}
      else{stockEditRowsDraft=[];if(byId('stockEditRows'))byId('stockEditRows').innerHTML='';byId('stockEditEditor')?.classList.add('hidden');setStatus('stockEditSearchStatus','Rettifica salvata. La posizione di origine non contiene più giacenze.','good')}
      window.renderStock?.();window.renderRegistry?.();window.LocalMaster?.renderPanel?.();showRectUndo(batchId,changes.length);if(typeof warehouseToast==='function')warehouseToast('Rettifica salvata senza movimenti fittizi.','success');
    };
  }

  function renderGroupedStock(){
    injectStyles();
    const input=byId('searchInput'),list=byId('stockList');if(!input||!list)return;
    const q=input.value||'',state=norm(byId('uxSearchState')?.value),all=typeof stockBuckets==='function'?stockBuckets():[];
    if(!normalizeQuery(q)&&!state){
      const summary=byId('uxSearchSummary');if(summary)summary.textContent='Inserisci un articolo, una taglia, una fila o un bancale/carrello.';
      list.innerHTML='<div class="lsaEmptySearch">Scrivi un codice articolo. Puoi aggiungere anche la taglia, per esempio <b>I00215-S</b>, <b>I00215 S</b> oppure <b>I00215 - S</b>.</div>';return;
    }
    const filtered=all.filter(r=>rowMatches(r,q,all)&&(!state||norm(r?.state)===state));
    const total=filtered.reduce((a,r)=>a+Number(r?.quantity||0),0),groups=groupRows(filtered),summary=byId('uxSearchSummary');
    if(summary)summary.textContent=`${groups.length} articolo/taglia · ${filtered.length} disponibilità · ${total.toLocaleString('it-IT')} pezzi`;
    if(!groups.length){list.innerHTML='<p>Nessuna giacenza trovata.</p>';return}
    list.innerHTML=groups.slice(0,120).map(g=>{
      const avail=g.rows.slice().sort((a,b)=>(locOf(a)+norm(a?.bancale)+norm(a?.state)).localeCompare(locOf(b)+norm(b?.bancale)+norm(b?.state)));
      return `<details class="lsaGroup"><summary><div class="lsaGroupSummary"><div><div class="sku">${html(g.article)}${g.size?` · ${html(g.size)}`:''}</div><div class="lsaGroupHint">${avail.length} disponibilità · mostra tutte le posizioni</div></div><div class="bigQty">${Number(g.total||0).toLocaleString('it-IT')}</div></div></summary><div class="lsaAvailList">${avail.map(r=>availabilityHtml(r)).join('')}</div></details>`;
    }).join('');
    if(groups.length>120)list.insertAdjacentHTML('beforeend',`<div class="status warn">Mostro i primi 120 gruppi su ${groups.length}. Restringi la ricerca.</div>`);
  }

  function availabilityHtml(r){
    const loc=locOf(r),pal=norm(r?.bancale),payload=encodeURIComponent(JSON.stringify({article_base:articleOf(r),size:norm(r?.size),state:norm(r?.state||'NUOVO'),fila_scaffale:loc,bancale:pal}));
    return `<div class="lsaAvail"><div class="lsaAvailHead"><div class="lsaAvailQty">${Number(r?.quantity||0).toLocaleString('it-IT')} pz</div><div class="lsaAvailState">${html(norm(r?.state)||'—')}</div></div><div class="meta">${loc?`<span>Fila/Scaffale ${html(loc)}</span>`:''}${pal?`<span>Bancale/Carrello ${html(pal)}</span>`:''}${!loc&&!pal?'<span>POSIZIONE NON ASSEGNATA</span>':''}</div><div class="uxQuickActions"><button type="button" class="uxQuickOut" onclick="uxQuickOperation('SCARICA','${payload}')">SCARICA</button><button type="button" class="uxQuickIn" onclick="uxQuickOperation('CARICA','${payload}')">CARICA</button><button type="button" class="uxQuickEdit" onclick="uxQuickEdit('${payload}')">MODIFICA</button></div></div>`;
  }

  function correctedIntegrity(){
    const rows=db?.master?.rows||[];let missingArticle=0,missingPosition=0,invalidState=0,invalidQty=0;
    for(const r of rows){if(!articleOf(r))missingArticle++;if(!positionValid(locOf(r),r?.bancale))missingPosition++;if(!VALID_STATES.includes(norm(r?.state)))invalidState++;if(!Number.isFinite(Number(r?.quantity))||Number(r.quantity)<0)invalidQty++}
    const blocking=missingArticle+missingPosition+invalidState+invalidQty;return {rows:rows.length,missingArticle,missingPosition,invalidState,invalidQty,blocking,ok:blocking===0};
  }
  function patchDashboardIntegrity(){
    const dash=byId('uxMasterDashboard');if(!dash)return;const r=correctedIntegrity();
    for(const metric of dash.querySelectorAll('.uxMetric')){const span=metric.querySelector('span');if(span?.textContent.trim()!=='INTEGRITÀ MASTER')continue;const b=metric.querySelector('b');const val=r.ok?'OK':String(r.blocking);if(b&&b.textContent!==val)b.textContent=val;metric.classList.toggle('good',r.ok);metric.classList.toggle('error',!r.ok)}
    const btn=byId('uxIntegrityBtn');if(btn&&!btn.dataset.lsaBound){btn.dataset.lsaBound='1';btn.onclick=()=>{const x=correctedIntegrity();alert(`CONTROLLO MASTER\n\nRighe: ${x.rows}\nArticoli mancanti: ${x.missingArticle}\nSenza posizione (né Fila/Scaffale né Bancale/Carrello): ${x.missingPosition}\nStato non valido: ${x.invalidState}\nQuantità non valida: ${x.invalidQty}\n\n${x.ok?'Master utilizzabile.':'Sono presenti anomalie da verificare.'}`)}}
  }
  function installDashboardPatch(){
    patchDashboardIntegrity();const dash=byId('uxMasterDashboard');if(!dash||dash.dataset.lsaObserved)return;dash.dataset.lsaObserved='1';const mo=new MutationObserver(()=>patchDashboardIntegrity());mo.observe(dash,{childList:true,subtree:true});
  }

  function install(){
    injectStyles();installFlexiblePosition();installRectificationSave();window.renderStock=renderGroupedStock;installDashboardPatch();
    const input=byId('searchInput');if(input&&!input.dataset.lsaInput){input.dataset.lsaInput='1';input.addEventListener('input',()=>window.renderStock())}
    const state=byId('uxSearchState');if(state&&!state.dataset.lsaState){state.dataset.lsaState='1';state.addEventListener('change',()=>window.renderStock())}
    setTimeout(()=>{updatePositionLabels();installDashboardPatch()},120);
  }

  window.WarehouseLocationSearch={version:VERSION,positionValid,normalizeQuery,exactArticleSize,rowMatches,groupRows,render:renderGroupedStock,install};
  install();
})();
