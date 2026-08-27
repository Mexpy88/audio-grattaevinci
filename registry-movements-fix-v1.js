/* Registry Movements UX V3 — compact, mobile-first operational history.
   Keeps login, persistence, movements, documents and global Registry engines authoritative.
   This module owns only the Registry presentation opened from the role dashboard. */
(function installRegistryMovementsFixV3(){
  'use strict';
  if(window.WarehouseRegistryMovementsFixV1)return;

  const VERSION='2026.08.27-registry-movements-ux3-premium';
  const $=id=>document.getElementById(id);
  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const html=v=>typeof esc==='function'?esc(v):text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const safeDb=()=>{try{return db||{}}catch{return {}}};
  const can=cap=>window.WarehouseRoleDashboardV1?.can?.(cap)??true;
  let activeTab='MOVIMENTI';
  let filtersOpen=false;

  function ensureSurgicalCss(){
    if($('rdRegistrySurgicalCss'))return;
    const s=document.createElement('style');
    s.id='rdRegistrySurgicalCss';
    s.textContent=`
      #registryScreen.rdRegistryPremiumV3{padding-top:10px}
      #registryScreen.rdRegistryPremiumV3>.back{margin-bottom:0}
      #registryScreen.rdRegistryPremiumV3>.eyebrow{margin-top:2px}
      #registryScreen.rdRegistryPremiumV3>h1{margin-bottom:3px}
      #registryScreen .rdRegistryCount{color:#6b7f92;font-size:13px;font-weight:850;margin:0 0 14px}
      #registryScreen .tabs{gap:8px;margin-bottom:12px}
      #registryScreen .tab{min-height:46px;border-radius:15px;font-size:14px;letter-spacing:.01em}

      #registryScreen .rdRegistryToolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;margin:0 0 10px}
      #registryScreen .rdRegistrySearchWrap{min-width:0;min-height:50px;display:flex;align-items:center;gap:8px;padding:0 12px;background:#fff;border:1px solid #d8e4ed;border-radius:16px;box-shadow:0 5px 16px rgba(20,57,88,.06)}
      #registryScreen .rdRegistrySearchIcon{width:19px;height:19px;flex:0 0 auto;color:#5e7890}
      #registryScreen #uxRegSearch{width:100%;min-width:0;height:48px;border:0!important;outline:0!important;background:transparent!important;padding:0!important;font-size:14px!important;color:#17314d!important;box-shadow:none!important}
      #registryScreen #uxRegSearch::placeholder{color:#8799a9;opacity:1}
      #registryScreen .rdRegistryFilterBtn{height:50px;min-width:98px;border:1px solid #d8e4ed;border-radius:16px;background:#fff;color:#17314d;display:flex;align-items:center;justify-content:center;gap:7px;font-size:13px;font-weight:950;padding:0 12px;box-shadow:0 5px 16px rgba(20,57,88,.06)}
      #registryScreen .rdRegistryFilterBtn.active{background:#e8f1fb;border-color:#bcd3e8;color:#245ca6}
      #registryScreen .rdRegistryFilterBadge{display:none;min-width:20px;height:20px;padding:0 6px;border-radius:99px;background:#245ca6;color:#fff;align-items:center;justify-content:center;font-size:11px;line-height:20px}
      #registryScreen .rdRegistryFilterBtn.active .rdRegistryFilterBadge{display:inline-flex}

      #registryScreen #registryFilters.rdRegistryFiltersPanel{display:none!important;margin:0 0 12px!important;padding:14px!important;border:1px solid #d9e5ee!important;border-radius:19px!important;background:#fff!important;box-shadow:0 8px 24px rgba(21,57,88,.08)!important}
      #registryScreen #registryFilters.rdRegistryFiltersPanel.open{display:block!important}
      #registryScreen .rdRegistryFilterHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 9px}
      #registryScreen .rdRegistryFilterHead b{font-size:15px}
      #registryScreen .rdRegistryFilterClose{width:34px;height:34px;border:0;border-radius:50%;background:#edf3f7;color:#526d84;font-size:20px;line-height:1}
      #registryScreen #registryFilters>.twoCols{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
      #registryScreen #registryFilters label{margin:5px 0!important;color:#536b80;font-size:11px!important;font-weight:900!important;letter-spacing:.035em;text-transform:uppercase}
      #registryScreen #registryFilters .field{min-height:46px!important;border-width:1px!important;border-radius:13px!important;padding:8px 10px!important;font-size:14px!important;color:#17314d!important;margin-top:5px!important;text-transform:none}
      #registryScreen #uxRegBox{margin:8px 0 0!important;padding:9px 0 0!important;border-top:1px solid #e3ebf1!important}
      #registryScreen .uxRegGrid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      #registryScreen .uxRegCount{display:none!important}
      #registryScreen .rdRegistryFilterFooter{display:flex;justify-content:flex-end;margin-top:10px}
      #registryScreen .rdRegistryReset{border:0;border-radius:12px;min-height:38px;padding:7px 11px;background:#edf3f7;color:#31506b;font-size:12px;font-weight:900}

      #registryScreen #registryList{margin-top:8px}
      #registryScreen .rdMoveCard,#registryScreen .rdDocumentCard{background:#fff;border:1px solid #dce6ee;border-radius:20px;padding:15px;margin:10px 0;box-shadow:0 8px 24px rgba(21,57,88,.07);overflow:hidden}
      #registryScreen .rdMoveCard.cancelled{opacity:.62}
      #registryScreen .rdMoveHead,#registryScreen .rdDocHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      #registryScreen .rdMoveIdentity,#registryScreen .rdDocIdentity{min-width:0;flex:1}
      #registryScreen .rdMoveSku,#registryScreen .rdDocId{font-size:19px;font-weight:950;line-height:1.14;color:#17314d;overflow-wrap:anywhere}
      #registryScreen .rdMoveSub,#registryScreen .rdDocSub{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:5px;color:#74879a;font-size:12px;font-weight:780}
      #registryScreen .rdMoveSize{display:inline-flex;align-items:center;min-height:24px;padding:3px 8px;border-radius:99px;background:#eef3f7;color:#3e5b74;font-size:11px;font-weight:900}
      #registryScreen .rdMoveQty{min-width:70px;border-radius:16px;padding:9px 10px 8px;text-align:center;line-height:1;flex:0 0 auto}
      #registryScreen .rdMoveQty>span{display:block;font-size:26px;font-weight:950;letter-spacing:-.03em}
      #registryScreen .rdMoveQty>small{display:block;margin-top:4px;font-size:10px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
      #registryScreen .rdMoveQty.in{background:#e8f7ef;color:#147147}#registryScreen .rdMoveQty.out{background:#fdeceb;color:#a13c35}#registryScreen .rdMoveQty.neutral{background:#eaf1f7;color:#245ca6}
      #registryScreen .rdMoveBadges{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:11px}
      #registryScreen .rdMoveBadge{display:inline-flex;align-items:center;min-height:25px;padding:4px 8px;border-radius:99px;font-size:10px;font-weight:950;letter-spacing:.04em}
      #registryScreen .rdMoveBadge.type.in{background:#e4f4eb;color:#176342}#registryScreen .rdMoveBadge.type.out{background:#fde8e6;color:#973832}#registryScreen .rdMoveBadge.state{background:#edf3f7;color:#405d76}#registryScreen .rdMoveBadge.cancel{background:#f4e6e5;color:#8a3a35}
      #registryScreen .rdMoveRoute{margin-top:11px;border:1px solid #e1e9ef;border-radius:15px;background:#f8fafc;overflow:hidden}
      #registryScreen .rdRouteRow{display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;align-items:center;padding:9px 11px}
      #registryScreen .rdRouteRow+.rdRouteRow{border-top:1px solid #e4ebf1}
      #registryScreen .rdRouteLabel{font-size:10px;font-weight:950;letter-spacing:.08em;color:#71869a}
      #registryScreen .rdRouteRow b{font-size:12px;line-height:1.35;color:#29465f;overflow-wrap:anywhere}
      #registryScreen .rdMoveContext{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}
      #registryScreen .rdMoveContextItem{min-width:0;padding:8px 10px;border-radius:13px;background:#f2f6f9}
      #registryScreen .rdMoveContextItem small{display:block;color:#7e90a0;font-size:9px;font-weight:950;letter-spacing:.06em;margin-bottom:2px}
      #registryScreen .rdMoveContextItem b{display:block;color:#29465f;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #registryScreen .rdMoveNote{margin:9px 0 0;padding:10px 11px;border-left:3px solid #9cb8d1;border-radius:0 12px 12px 0;background:#f5f8fb;color:#536b80;font-size:12px;line-height:1.42}
      #registryScreen .rdMoveNote b{display:block;color:#29465f;font-size:10px;letter-spacing:.05em;margin-bottom:3px}
      #registryScreen .rdMoveActions{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid #e7edf2}
      #registryScreen .rdMoveAction{min-height:38px;border:0;border-radius:11px;padding:7px 12px;background:#edf3f7;color:#274760;font-size:11px;font-weight:950}
      #registryScreen .rdMoveAction.danger{background:#fdecea;color:#973832}

      #registryScreen .rdDocMetric{min-width:72px;border-radius:16px;background:#eaf1f7;color:#245ca6;padding:9px 10px 8px;text-align:center;flex:0 0 auto}
      #registryScreen .rdDocMetric b{display:block;font-size:24px;line-height:1;font-weight:950}#registryScreen .rdDocMetric small{display:block;margin-top:4px;font-size:9px;font-weight:950;text-transform:uppercase}
      #registryScreen .rdDocDetails{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px}
      #registryScreen .rdEmptyRegistry{padding:28px 18px;text-align:center;background:#fff;border:1px dashed #cfdce6;border-radius:20px;color:#6c8093}
      #registryScreen .rdEmptyRegistry b{display:block;color:#29465f;font-size:15px;margin-bottom:4px}
      #registryScreen .rdRegistryError{background:#fdebea;color:#8d342e;border:1px solid #f0cbc8;border-radius:14px;padding:12px 14px;font-weight:850;margin:10px 0}

      @media(max-width:430px){
        body:not(.desktopMode) #registryScreen.rdRegistryPremiumV3{padding-top:8px}
        body:not(.desktopMode) #registryScreen.rdRegistryPremiumV3>.eyebrow{font-size:11px}
        body:not(.desktopMode) #registryScreen.rdRegistryPremiumV3>h1{font-size:31px!important;line-height:1!important;margin-top:3px!important}
        body:not(.desktopMode) #registryScreen .tabs{margin-bottom:10px}
        body:not(.desktopMode) #registryScreen .tab{min-height:44px;font-size:13px}
        body:not(.desktopMode) #registryScreen .rdRegistryToolbar{grid-template-columns:minmax(0,1fr) 94px}
        body:not(.desktopMode) #registryScreen .rdRegistrySearchWrap,body:not(.desktopMode) #registryScreen .rdRegistryFilterBtn{min-height:48px;height:48px;border-radius:15px}
        body:not(.desktopMode) #registryScreen #uxRegSearch{height:46px;font-size:13px!important}
        body:not(.desktopMode) #registryScreen #registryFilters.rdRegistryFiltersPanel{padding:12px!important;border-radius:17px!important}
        body:not(.desktopMode) #registryScreen .uxRegGrid{grid-template-columns:1fr 1fr!important}
        body:not(.desktopMode) #registryScreen .uxRegGrid label:last-child{grid-column:1/-1}
        body:not(.desktopMode) #registryScreen .rdMoveCard,body:not(.desktopMode) #registryScreen .rdDocumentCard{border-radius:18px;padding:13px;margin:8px 0}
        body:not(.desktopMode) #registryScreen .rdMoveSku,body:not(.desktopMode) #registryScreen .rdDocId{font-size:17px}
        body:not(.desktopMode) #registryScreen .rdMoveQty{min-width:65px;padding:8px 9px 7px;border-radius:14px}
        body:not(.desktopMode) #registryScreen .rdMoveQty>span{font-size:24px}
        body:not(.desktopMode) #registryScreen .rdMoveRoute{margin-top:9px}
        body:not(.desktopMode) #registryScreen .rdMoveActions{margin-top:9px;padding-top:9px}
        body:not(.desktopMode) .uxDirtyBar.rdMobileDirtyCompact{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;padding:0!important;width:auto!important;min-width:0!important;gap:0!important}
        body:not(.desktopMode) .uxDirtyBar.rdMobileDirtyCompact .uxDirtyText{display:none!important}
        body:not(.desktopMode) .uxDirtyBar.rdMobileDirtyCompact #uxDirtyExport{min-height:44px!important;padding:0 18px!important;border-radius:999px!important;background:#fff!important;color:#17314d!important;border:1px solid #d8e4ee!important;box-shadow:0 10px 26px rgba(23,49,77,.18)!important;font-size:12px!important}
      }
      @media(max-width:360px){
        #registryScreen .rdRegistryToolbar{grid-template-columns:1fr 88px}
        #registryScreen #registryFilters>.twoCols,#registryScreen .uxRegGrid,#registryScreen .rdMoveContext,#registryScreen .rdDocDetails{grid-template-columns:1fr!important}
        #registryScreen .uxRegGrid label:last-child{grid-column:auto!important}
      }
    `;
    document.head.appendChild(s);
  }

  function dateOnly(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return'';const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`}
  function fmt(v){if(!v)return'—';try{return typeof fmtDateTime==='function'?fmtDateTime(v):new Date(v).toLocaleString('it-IT')}catch{return'—'}}
  function fmtShort(v){if(!v)return'—';try{const d=new Date(v);if(Number.isNaN(d.getTime()))return'—';return d.toLocaleString('it-IT',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',', ' ·')}catch{return fmt(v)}}
  function locationOfSafe(v){try{return typeof locationOf==='function'?locationOf(v):text(v?.fila_scaffale||v?.fila||'').trim().toUpperCase()}catch{return text(v?.fila_scaffale||v?.fila||'').trim().toUpperCase()}}
  function dateMatch(v){const d=dateOnly(v),from=$('regFrom')?.value||'',to=$('regTo')?.value||'';if(from&&d<from)return false;if(to&&d>to)return false;return true}
  function svgSearch(){return '<svg class="rdRegistrySearchIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>'}

  function ensurePremiumShell(){
    const screen=$('registryScreen'),host=$('registryFilters');if(!screen||!host)return false;
    screen.classList.add('rdRegistryPremiumV3');
    const h=screen.querySelector('h1');if(h)h.textContent='Registro';
    if(h&&!$('rdRegistryCount')){const count=document.createElement('div');count.id='rdRegistryCount';count.className='rdRegistryCount';count.textContent='Storico movimenti';h.insertAdjacentElement('afterend',count)}

    let toolbar=$('rdRegistryToolbar');
    if(!toolbar){
      toolbar=document.createElement('div');toolbar.id='rdRegistryToolbar';toolbar.className='rdRegistryToolbar';
      toolbar.innerHTML=`<div class="rdRegistrySearchWrap">${svgSearch()}<input id="uxRegSearch" autocomplete="off" inputmode="search" placeholder="Cerca articolo, richiesta, posizione…" aria-label="Cerca nei movimenti"></div><button id="rdRegistryFilterToggle" class="rdRegistryFilterBtn" type="button" aria-expanded="false"><span>FILTRI</span><span id="rdRegistryFilterBadge" class="rdRegistryFilterBadge">0</span></button>`;
      const tabs=screen.querySelector('.tabs');tabs?.insertAdjacentElement('afterend',toolbar);
    }

    host.classList.add('rdRegistryFiltersPanel');
    if(!$('rdRegistryFilterHead')){
      const head=document.createElement('div');head.id='rdRegistryFilterHead';head.className='rdRegistryFilterHead';head.innerHTML='<b>Filtra lo storico</b><button id="rdRegistryFilterClose" class="rdRegistryFilterClose" type="button" aria-label="Chiudi filtri">×</button>';
      host.insertBefore(head,host.firstChild);
    }
    ensureUxFilters();
    if(!$('rdRegistryFilterFooter')){
      const foot=document.createElement('div');foot.id='rdRegistryFilterFooter';foot.className='rdRegistryFilterFooter';foot.innerHTML='<button id="rdRegistryReset" class="rdRegistryReset" type="button">AZZERA FILTRI</button>';host.appendChild(foot);
    }
    return true;
  }

  function ensureUxFilters(){
    const host=$('registryFilters');if(!host)return false;
    let box=$('uxRegBox');
    if(!box){
      box=document.createElement('div');box.id='uxRegBox';box.className='uxRegBox';
      box.innerHTML='<div class="uxRegGrid"><label>Operatore<select id="uxRegOperator" class="field"><option value="">Tutti gli operatori</option></select></label><label class="rdMovementOnly">Operazione<select id="uxRegType" class="field"><option value="">Tutte le operazioni</option><option>CARICA</option><option>SCARICA</option></select></label><label class="rdMovementOnly">Stato<select id="uxRegState" class="field"><option value="">Tutti gli stati</option><option>NUOVO</option><option>SCARICATO</option><option>USATO</option><option>DISMESSO</option><option>NON_CHIARO</option></select></label></div><div id="uxRegCount" class="uxRegCount"></div>';
      host.appendChild(box);
    }
    const op=$('uxRegOperator');
    if(op){
      const cur=op.value,names=[...new Set((safeDb().movements||[]).map(m=>m?.operator).filter(Boolean))].sort();
      op.innerHTML='<option value="">Tutti gli operatori</option>'+names.map(n=>`<option value="${html(n)}">${html(n)}</option>`).join('');
      if(names.includes(cur))op.value=cur;
    }
    return true;
  }

  function activeFilterCount(){const ids=activeTab==='MOVIMENTI'?['regFrom','regTo','regDest','uxRegOperator','uxRegType','uxRegState']:['regFrom','regTo','regDest','uxRegOperator'];return ids.reduce((n,id)=>n+($(id)?.value?1:0),0)}
  function updateFilterUi(){
    const host=$('registryFilters'),btn=$('rdRegistryFilterToggle'),badge=$('rdRegistryFilterBadge'),count=activeFilterCount();
    host?.classList.toggle('open',filtersOpen);
    if(btn){btn.classList.toggle('active',count>0);btn.setAttribute('aria-expanded',filtersOpen?'true':'false')}
    if(badge)badge.textContent=String(count);
  }
  function toggleFilters(force){filtersOpen=force===undefined?!filtersOpen:!!force;updateFilterUi();if(filtersOpen)requestAnimationFrame(()=>$('regFrom')?.focus?.({preventScroll:true}));return filtersOpen}
  function resetFilters(){['regFrom','regTo','regDest','uxRegOperator','uxRegType','uxRegState'].forEach(id=>{const el=$(id);if(el)el.value=''});renderDirect();return true}

  function bindControls(){
    ensurePremiumShell();
    const bind=(id,event='change')=>{const el=$(id);if(!el||el.dataset.rdRegistryDirect==='1')return;el.dataset.rdRegistryDirect='1';el.removeAttribute('onchange');el.removeAttribute('oninput');el.addEventListener(event,renderDirect)};
    bind('regFrom');bind('regTo');bind('regDest');bind('uxRegSearch','input');bind('uxRegOperator');bind('uxRegType');bind('uxRegState');
    const toggle=$('rdRegistryFilterToggle');if(toggle&&!toggle.dataset.rdRegistryToggle){toggle.dataset.rdRegistryToggle='1';toggle.onclick=()=>toggleFilters()}
    const close=$('rdRegistryFilterClose');if(close&&!close.dataset.rdRegistryToggle){close.dataset.rdRegistryToggle='1';close.onclick=()=>toggleFilters(false)}
    const reset=$('rdRegistryReset');if(reset&&!reset.dataset.rdRegistryReset){reset.dataset.rdRegistryReset='1';reset.onclick=resetFilters}
    const mov=$('tabMovBtn');if(mov){mov.removeAttribute('onclick');mov.onclick=()=>openTab('MOVIMENTI')}
    const doc=$('tabDocBtn');if(doc){doc.removeAttribute('onclick');doc.onclick=()=>openTab('SCARICHI')}
    const edit=$('editMovementDialog');if(edit&&!edit.dataset.rdRegistryClose){edit.dataset.rdRegistryClose='1';edit.addEventListener('close',()=>{if($('registryScreen')?.classList.contains('on'))setTimeout(renderDirect,0)})}
  }

  function movementRows(){
    const d=safeDb(),dest=$('regDest')?.value||'',q=norm($('uxRegSearch')?.value),op=norm($('uxRegOperator')?.value),typ=norm($('uxRegType')?.value),state=norm($('uxRegState')?.value);
    return (Array.isArray(d.movements)?d.movements:[]).filter(m=>{
      if(!m||!dateMatch(m.operation_at||m.registered_at))return false;
      if(dest&&text(m.destination)!==dest)return false;
      if(op&&norm(m.operator)!==op)return false;
      if(typ&&norm(m.movement_type)!==typ)return false;
      if(state&&norm(m.state)!==state)return false;
      if(q){const hay=norm([m.article_base,m.size,m.state,m.movement_type,m.operator,m.document_id,locationOfSafe(m),m.bancale,m.destination,m.note].join(' '));if(!hay.includes(q))return false}
      return true;
    }).sort((a,b)=>new Date(b.operation_at||b.registered_at||0)-new Date(a.operation_at||a.registered_at||0));
  }

  function sourceText(m){const loc=locationOfSafe(m),pal=text(m?.bancale||'').trim();if(loc&&pal)return `Fila/Scaffale ${loc} · Bancale/Carrello ${pal}`;if(loc)return `Fila/Scaffale ${loc}`;if(pal)return `Bancale/Carrello ${pal}`;return 'Posizione non indicata'}
  function movementCard(m){
    const type=norm(m.movement_type||'MOVIMENTO'),isIn=type==='CARICA',isOut=type==='SCARICA',sign=isIn?'+':isOut?'−':'',qty=Math.abs(Number(m.quantity||0)),tone=isIn?'in':isOut?'out':'neutral';
    const destination=text(m.destination||'').trim();
    const actions=!m.cancelled_at&&can('MOVE')?`<div class="rdMoveActions"><button class="rdMoveAction" type="button" onclick="WarehouseRegistryMovementsFixV1.openEdit('${html(m.id)}')">MODIFICA</button><button class="rdMoveAction danger" type="button" onclick="WarehouseRegistryMovementsFixV1.cancel('${html(m.id)}')">ANNULLA</button></div>`:'';
    return `<article class="rdMoveCard movementCard ${m.cancelled_at?'cancelled':''}"><div class="rdMoveHead"><div class="rdMoveIdentity"><div class="rdMoveSku">${html(m.article_base||'—')}</div><div class="rdMoveSub">${m.size?`<span class="rdMoveSize">Taglia ${html(m.size)}</span>`:''}<time>${html(fmtShort(m.operation_at||m.registered_at))}</time></div></div><div class="rdMoveQty ${tone}"><span>${sign}${qty}</span><small>pezzi</small></div></div><div class="rdMoveBadges"><span class="rdMoveBadge type ${tone}">${html(type)}</span><span class="rdMoveBadge state">${html(m.state||'—')}</span>${m.cancelled_at?'<span class="rdMoveBadge cancel">ANNULLATO</span>':''}</div><div class="rdMoveRoute"><div class="rdRouteRow"><span class="rdRouteLabel">DA</span><b>${html(sourceText(m))}</b></div>${destination?`<div class="rdRouteRow"><span class="rdRouteLabel">A</span><b>${html(destination)}</b></div>`:''}</div><div class="rdMoveContext"><div class="rdMoveContextItem"><small>OPERATORE</small><b>${html(m.operator||'—')}</b></div>${m.document_id?`<div class="rdMoveContextItem"><small>RIFERIMENTO</small><b>${html(m.document_id)}</b></div>`:'<div class="rdMoveContextItem"><small>RIFERIMENTO</small><b>—</b></div>'}</div>${m.note?`<div class="rdMoveNote"><b>NOTA</b>${html(m.note)}</div>`:''}${actions}</article>`;
  }

  function documentRowsSafe(doc){const d=safeDb(),ids=Array.isArray(doc?.movement_ids)?doc.movement_ids:[];return ids.map(id=>(d.movements||[]).find(m=>m?.id===id)).filter(Boolean)}
  function dischargeRows(){
    const d=safeDb(),dest=$('regDest')?.value||'',q=norm($('uxRegSearch')?.value),op=norm($('uxRegOperator')?.value);
    return (Array.isArray(d.documents)?d.documents:[]).filter(x=>x?.type==='SCARICO'&&dateMatch(x.operation_at)&&(!dest||text(x.destination)===dest)&&(!op||norm(x.operator)===op)).filter(x=>{if(!q)return true;const items=documentRowsSafe(x),hay=norm([x.id,x.destination,x.operator,x.request_id,...items.flatMap(m=>[m.article_base,m.size,m.state,m.bancale,locationOfSafe(m)])].join(' '));return hay.includes(q)}).sort((a,b)=>new Date(b.operation_at||0)-new Date(a.operation_at||0));
  }
  function dischargeCard(d){
    const items=documentRowsSafe(d),total=items.reduce((n,m)=>n+Number(m.quantity||0),0);
    return `<article class="rdDocumentCard documentCard"><div class="rdDocHead"><div class="rdDocIdentity"><div class="rdDocId">${html(d.id||'SCARICO')}</div><div class="rdDocSub"><time>${html(fmtShort(d.operation_at))}</time></div></div><div class="rdDocMetric"><b>${total}</b><small>pezzi</small></div></div><div class="rdDocDetails"><div class="rdMoveContextItem"><small>DESTINAZIONE</small><b>${html(d.destination||'—')}</b></div><div class="rdMoveContextItem"><small>OPERATORE</small><b>${html(d.operator||'—')}</b></div><div class="rdMoveContextItem"><small>RIGHE</small><b>${items.length}</b></div><div class="rdMoveContextItem"><small>RICHIESTA</small><b>${html(d.request_id||'—')}</b></div></div><div class="rdMoveActions"><button class="rdMoveAction" type="button" onclick="openDocument('${html(d.id)}')">APRI</button>${can('EXPORT')?`<button class="rdMoveAction" type="button" onclick="exportDocument('${html(d.id)}')">EXCEL</button>`:''}</div></article>`;
  }

  function updateTabs(){
    $('tabMovBtn')?.classList.toggle('active',activeTab==='MOVIMENTI');
    $('tabDocBtn')?.classList.toggle('active',activeTab==='SCARICHI');
    $('exportFilteredBtn')?.classList.toggle('hidden',activeTab!=='SCARICHI');
    document.querySelectorAll('#uxRegBox .rdMovementOnly').forEach(el=>el.classList.toggle('hidden',activeTab!=='MOVIMENTI'));
  }
  function updateSummary(n){
    const label=activeTab==='MOVIMENTI'?(n===1?'movimento':'movimenti'):(n===1?'scarico':'scarichi');
    const out=$('rdRegistryCount');if(out)out.textContent=`${n} ${label}`;
    const legacy=$('uxRegCount');if(legacy)legacy.textContent=`${n} ${label}`;
  }

  function renderDirect(){
    try{
      ensurePremiumShell();bindControls();updateTabs();updateFilterUi();
      const list=$('registryList');if(!list)return false;
      if(activeTab==='MOVIMENTI'){
        const rows=movementRows();updateSummary(rows.length);list.innerHTML=rows.length?rows.map(movementCard).join(''):'<div class="rdEmptyRegistry"><b>Nessun movimento trovato</b>Modifica la ricerca o azzera i filtri.</div>';
      }else{
        const docs=dischargeRows();updateSummary(docs.length);list.innerHTML=docs.length?docs.map(dischargeCard).join(''):'<div class="rdEmptyRegistry"><b>Nessuno scarico trovato</b>Modifica la ricerca o azzera i filtri.</div>';
      }
      return true;
    }catch(err){console.error('[REGISTRY DIRECT RENDER]',err);const list=$('registryList');if(list)list.innerHTML='<div class="rdRegistryError">Errore nella visualizzazione dello storico. Riapri Registro e riprova.</div>';return false}
  }

  function openTab(tab){activeTab=tab==='SCARICHI'?'SCARICHI':'MOVIMENTI';try{registryTab=activeTab}catch{}renderDirect();return true}
  function decorate(){
    const s=$('registryScreen');if(!s)return;
    ensurePremiumShell();
    const b=s.querySelector(':scope>.back');if(b){b.textContent='← HOME';b.onclick=()=>show('home')}
    const tabs=s.querySelector('.tabs');if(tabs)tabs.style.removeProperty('display');
    updateTabs();updateFilterUi();
  }
  function openMovements(){
    if(!can('REGISTRY_VIEW'))return window.WarehouseRoleDashboardV1?.deny?.('Registro movimenti')??false;
    ensureSurgicalCss();bindControls();activeTab='MOVIMENTI';filtersOpen=false;try{registryTab='MOVIMENTI'}catch{};
    if(typeof show==='function')show('registryScreen');decorate();renderDirect();
    requestAnimationFrame(()=>{decorate();renderDirect()});
    return true;
  }
  function openEdit(id){try{return window.openMovementEdit?.(id)}catch(err){console.error('[REGISTRY EDIT]',err);return false}}
  function cancel(id){try{const out=window.cancelMovement?.(id);setTimeout(renderDirect,0);return out}catch(err){console.warn('[REGISTRY CANCEL RENDER RECOVERY]',err);setTimeout(renderDirect,0);return false}}

  function install(){
    ensureSurgicalCss();ensurePremiumShell();bindControls();
    window.openRoleRegistryMovementsV1=openMovements;
    document.querySelectorAll('#rdDashboardV1 .rdAction').forEach(btn=>{if(norm(btn.querySelector('b')?.textContent)==='MOVIMENTI')btn.setAttribute('onclick','openRoleRegistryMovementsV1()')});
    return true;
  }

  window.WarehouseRegistryMovementsFixV1={version:VERSION,install,openMovements,openTab,renderDirect,openEdit,cancel,toggleFilters,resetFilters};
  install();
})();
