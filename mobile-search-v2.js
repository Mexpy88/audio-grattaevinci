/* Mobile Search V2 — posizione flessibile, ricerca articolo+taglia, disponibilità raggruppate e swipe-back. */
(function installMobileSearchV2(){
  'use strict';
  if(window.WarehouseMobileSearchV2)return;

  const VERSION='2026.08.20-mobile-search-v2';
  const byId=id=>document.getElementById(id);
  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const html=v=>typeof esc==='function'?esc(v):text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const SIZE_RE=/^(?:[2-9]?XS|[2-9]?XL|XXS|XXL|XS|S|M|L|XL|TU|UNI|UNICA|[0-9]{1,3})$/i;
  const openGroups=new Set();

  function locOf(r){return norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''))}
  function posPresent(loc,pal){return !!(norm(loc)||norm(pal))}

  function patchPositionInputs(){
    const loc=byId('filaScaffale'),pal=byId('bancale');
    if(loc){const l=loc.closest('label');if(l){l.dataset.uxOptional='1';for(const n of l.childNodes){if(n.nodeType===3&&/Fila\/Scaffale/i.test(n.textContent||''))n.textContent='Fila/Scaffale'}let note=l.querySelector('.msv2PositionNote');if(!note){note=document.createElement('small');note.className='uxOptionalNote msv2PositionNote';l.appendChild(note)}note.textContent='Inserisci Fila/Scaffale oppure Bancale/Carrello. È sufficiente uno dei due.'}loc.placeholder='Es. 13 · può restare vuoto se usi Bancale/Carrello'}
    if(pal){const l=pal.closest('label');if(l){l.dataset.uxRequired='';for(const n of l.childNodes){if(n.nodeType===3&&/^Bancale/i.test((n.textContent||'').trim()))n.textContent='Bancale / Carrello'}pal.placeholder='Es. 38 · può restare vuoto se usi Fila/Scaffale'}
    window.validateLocation=function(){
      const l=norm(byId('filaScaffale')?.value),p=norm(byId('bancale')?.value);
      if(!posPresent(l,p)){alert('Inserisci almeno una posizione: Fila/Scaffale oppure Bancale/Carrello.');byId('filaScaffale')?.focus();return false}
      return true;
    };

    const seLoc=byId('stockEditLocation'),sePal=byId('stockEditPallet');
    if(seLoc){const l=seLoc.closest('label');if(l){for(const n of l.childNodes){if(n.nodeType===3&&/Fila\/Scaffale/i.test(n.textContent||''))n.textContent='Fila/Scaffale'}let note=l.querySelector('.msv2EditNote');if(!note){note=document.createElement('small');note.className='uxOptionalNote msv2EditNote';l.appendChild(note)}note.textContent='Cerca usando Fila/Scaffale, Bancale/Carrello oppure entrambi.'}}
    if(sePal){const l=sePal.closest('label');if(l)for(const n of l.childNodes){if(n.nodeType===3&&/^Bancale/i.test((n.textContent||'').trim()))n.textContent='Bancale / Carrello'}}
  }

  function patchStockEditor(){
    window.stockEditRowsAtSource=function(){
      const l=norm(stockEditSource?.fila_scaffale),p=norm(stockEditSource?.bancale);
      return (typeof stockBuckets==='function'?stockBuckets():[]).filter(s=>(!l||locOf(s)===l)&&(!p||norm(s.bancale)===p));
    };
    window.loadStockPallet=function(){
      if(!requireLogin())return;
      const l=norm(byId('stockEditLocation')?.value),p=norm(byId('stockEditPallet')?.value);
      if(!posPresent(l,p)){alert('Inserisci Fila/Scaffale oppure Bancale/Carrello.');byId('stockEditLocation')?.focus();return}
      stockEditSource={fila_scaffale:l,bancale:p};
      const rows=window.stockEditRowsAtSource();
      if(!rows.length){stockEditRowsDraft=[];byId('stockEditEditor')?.classList.add('hidden');setStatus('stockEditSearchStatus',`Nessuna giacenza trovata${l?' in Fila/Scaffale '+l:''}${p?' su Bancale/Carrello '+p:''}.`,'error');return}
      stockEditBuildDraft(rows);
      setStatus('stockEditSearchStatus',`Trovate ${rows.length} righe${l?' · Fila/Scaffale '+l:''}${p?' · Bancale/Carrello '+p:''}.`,'good');
      byId('stockEditEditor')?.classList.remove('hidden');renderStockEditRows();
    };
    window.addStockEditRow=function(){
      const l=norm(stockEditSource?.fila_scaffale),p=norm(stockEditSource?.bancale);
      if(!posPresent(l,p))return alert('Cerca prima una posizione: Fila/Scaffale oppure Bancale/Carrello.');
      stockEditRowsDraft.push({edit_id:uid(),original:null,deleted:false,article_base:'',size:'',quantity:0,state:'NUOVO',fila_scaffale:l,bancale:p});
      renderStockEditRows();
      setTimeout(()=>{const rows=document.querySelectorAll('#stockEditRows .stockEditRow');rows[rows.length-1]?.scrollIntoView({behavior:'smooth',block:'center'})},30);
    };
    // stock-rectifications.js valida il salvataggio; lo avvolgiamo per consentire una delle due coordinate.
    const rectSave=window.saveStockEdit;
    if(typeof rectSave==='function'&&!rectSave.__msv2Wrapped){
      const wrapped=function(){
        for(const d of (stockEditRowsDraft||[])){
          if(d.deleted||Number(d.quantity)<=0)continue;
          if(!posPresent(d.fila_scaffale,d.bancale)){alert('Ogni riga attiva deve avere almeno Fila/Scaffale oppure Bancale/Carrello.');return}
        }
        return rectSave.apply(this,arguments);
      };
      wrapped.__msv2Wrapped=true;
      window.saveStockEdit=wrapped;
    }
  }

  function parseSearch(raw){
    const q=norm(raw).replace(/\s+/g,' ').trim();
    if(!q)return {raw:'',article:'',size:''};
    // Accetta I00215 S, I00215-S e I00215 - S. Il suffisso viene interpretato come taglia solo se valido.
    const m=q.match(/^(.*?)(?:\s*-\s*|\s+)([A-Z0-9]+)$/i);
    if(m&&SIZE_RE.test(m[2])){
      const article=norm(m[1]).replace(/[\s-]+$/,'');
      if(article)return {raw:q,article,size:norm(m[2])};
    }
    // Caso codice-taglia senza spazi: separa l'ultimo suffisso dopo trattino.
    const hy=q.lastIndexOf('-');
    if(hy>0){const suffix=norm(q.slice(hy+1));if(SIZE_RE.test(suffix))return {raw:q,article:norm(q.slice(0,hy)),size:suffix}}
    return {raw:q,article:'',size:''};
  }

  function generalMatch(s,q){
    const tokens=norm(q).split(/\s+/).filter(Boolean);if(!tokens.length)return true;
    const hay=[s.article_base,s.size,s.state,locOf(s),s.bancale].map(norm).join(' ');
    return tokens.every(t=>hay.includes(t));
  }
  function rowMatches(s,parsed){
    if(parsed.article&&parsed.size){
      const art=norm(s.article_base),needle=parsed.article;
      const artOk=(typeof articleMatches==='function'?articleMatches(art,needle):art===needle||art.includes(needle));
      return artOk&&norm(s.size)===parsed.size;
    }
    return generalMatch(s,parsed.raw);
  }

  function groupKey(s){return [norm(s.article_base),norm(s.size)].join('|')}
  function availabilityLine(s){
    const loc=locOf(s),pal=norm(s.bancale);
    const payload=encodeURIComponent(JSON.stringify({article_base:s.article_base,size:s.size||'',state:s.state||'NUOVO',fila_scaffale:loc,bancale:pal}));
    return `<div class="msv2AvailabilityRow"><div class="msv2AvailMain"><b>${Number(s.quantity||0).toLocaleString('it-IT')} pz</b><span class="msv2State">${html(s.state||'—')}</span></div><div class="msv2Place">${loc?`<span>Fila/Scaffale <b>${html(loc)}</b></span>`:''}${pal?`<span>Bancale/Carrello <b>${html(pal)}</b></span>`:''}${!loc&&!pal?'<span class="msv2Missing">POSIZIONE NON ASSEGNATA</span>':''}</div><div class="uxQuickActions msv2Actions"><button type="button" class="uxQuickOut" onclick="uxQuickOperation('SCARICA','${payload}')">SCARICA</button><button type="button" class="uxQuickIn" onclick="uxQuickOperation('CARICA','${payload}')">CARICA</button><button type="button" class="uxQuickEdit" onclick="uxQuickEdit('${payload}')">MODIFICA</button></div></div>`;
  }
  window.msv2ToggleGroup=function(key){
    if(openGroups.has(key))openGroups.delete(key);else openGroups.add(key);
    window.renderStock?.();
  };

  function renderGroupedStock(){
    const input=byId('searchInput');if(!input)return;
    const parsed=parseSearch(input.value),state=norm(byId('uxSearchState')?.value),all=typeof stockBuckets==='function'?stockBuckets():[];
    const rows=all.filter(s=>rowMatches(s,parsed)&&(!state||norm(s.state)===state));
    const total=rows.reduce((a,s)=>a+Number(s.quantity||0),0),summary=byId('uxSearchSummary');
    if(summary){summary.textContent=parsed.article&&parsed.size?`${parsed.article} · taglia ${parsed.size} · ${rows.length} disponibilità · ${total.toLocaleString('it-IT')} pezzi`:`${rows.length} disponibilità · ${total.toLocaleString('it-IT')} pezzi`}
    const list=byId('stockList');if(!list)return;
    const map=new Map();for(const r of rows){const k=groupKey(r);if(!map.has(k))map.set(k,[]);map.get(k).push(r)}
    const groups=[...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
    list.innerHTML=groups.length?groups.map(([key,items])=>{
      const first=items[0],qty=items.reduce((a,s)=>a+Number(s.quantity||0),0),expanded=openGroups.has(key)||(groups.length===1&&items.length<=3);
      const states=[...new Set(items.map(x=>norm(x.state)).filter(Boolean))];
      return `<div class="msv2StockGroup"><button type="button" class="msv2GroupHead" onclick="msv2ToggleGroup('${html(key)}')" aria-expanded="${expanded?'true':'false'}"><div><div class="sku">${html(first.article_base)}${first.size?` · ${html(first.size)}`:''}</div><div class="msv2GroupSub">${items.length} ${items.length===1?'disponibilità':'disponibilità'} · ${states.map(html).join(' / ')}</div></div><div class="msv2GroupQty"><b>${qty.toLocaleString('it-IT')}</b><span>pezzi</span><i>${expanded?'⌃':'⌄'}</i></div></button><div class="msv2GroupBody ${expanded?'':'hidden'}">${items.sort((a,b)=>(locOf(a)+norm(a.bancale)+norm(a.state)).localeCompare(locOf(b)+norm(b.bancale)+norm(b.state))).map(availabilityLine).join('')}</div></div>`;
    }).join(''):'<p>Nessuna giacenza trovata.</p>';
  }

  function installSearch(){
    const input=byId('searchInput');if(input){input.placeholder='Articolo o articolo + taglia · es. I00215-S';input.addEventListener('input',()=>window.renderStock?.())}
    window.renderStock=renderGroupedStock;
  }

  function visibleScreen(){return [...document.querySelectorAll('.screen.on')].find(Boolean)||null}
  function smartBack(){
    // Chiude prima eventuali dialog aperti.
    const dlg=[...document.querySelectorAll('dialog[open]')].pop();if(dlg){try{dlg.close()}catch{}return true}
    const s=visibleScreen();if(!s||s.id==='home')return false;
    const parent={results:'operation',bridge:'operation',requestReview:'requestNew',requestDetail:'requests',requestNew:'requests',documentScreen:'registryScreen'};
    const target=parent[s.id]||'home';
    if(typeof show==='function'){show(target);return true}
    return false;
  }
  function installSwipeBack(){
    if(document.documentElement.dataset.msv2Swipe)return;document.documentElement.dataset.msv2Swipe='1';
    let start=null,tracking=false;
    document.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const t=e.touches[0];if(t.clientX>38)return;start={x:t.clientX,y:t.clientY,time:Date.now()};tracking=true},{passive:true});
    document.addEventListener('touchmove',e=>{if(!tracking||!start||e.touches.length!==1)return;const t=e.touches[0],dx=t.clientX-start.x,dy=Math.abs(t.clientY-start.y);if(dx>35&&dx>dy*1.25){document.body.classList.add('msv2SwipingBack')}},{passive:true});
    document.addEventListener('touchend',e=>{if(!tracking||!start){tracking=false;return}const t=e.changedTouches[0],dx=t.clientX-start.x,dy=Math.abs(t.clientY-start.y),dt=Date.now()-start.time;document.body.classList.remove('msv2SwipingBack');tracking=false;if(dx>=82&&dx>dy*1.35&&dt<900)smartBack();start=null},{passive:true});
    document.addEventListener('touchcancel',()=>{tracking=false;start=null;document.body.classList.remove('msv2SwipingBack')},{passive:true});
  }

  function patchIntegrityMessaging(){
    // L'integrità della posizione è valida se esiste almeno Fila/Scaffale oppure Bancale/Carrello.
    const original=window.WarehouseSuperUX?.showIntegrity;
    // Nessuna dipendenza dal metodo originale: aggiorniamo solo il testo/contatore visibile dove possibile.
    const fix=()=>{
      const rows=db?.master?.rows||[];let noPosition=0;for(const r of rows)if(!posPresent(locOf(r),r.bancale))noPosition++;
      document.querySelectorAll('.uxMetric').forEach(m=>{const s=m.querySelector('span');if(s?.textContent==='INTEGRITÀ MASTER'&&noPosition===0&&/^\d+$/.test(m.querySelector('b')?.textContent||'')){/* il conteggio precedente può includere bancali mancanti; non lo alteriamo qui per non nascondere altre anomalie */}});
    };setTimeout(fix,50);
  }

  function install(){patchPositionInputs();patchStockEditor();installSearch();installSwipeBack();patchIntegrityMessaging();window.renderStock?.()}
  install();
  setTimeout(install,160);
  window.WarehouseMobileSearchV2={version:VERSION,install,parseSearch,smartBack};
})();
