/* Registry Movements Fix V2 — surgical registry renderer.
   Keeps login, dashboard, persistence and global registry APIs untouched.
   Only owns the Registry screen controls after opening MOVIMENTI from the role dashboard. */
(function installRegistryMovementsFixV2(){
  'use strict';
  if(window.WarehouseRegistryMovementsFixV1)return;
  const VERSION='2026.08.27-registry-movements-fix2-surgical';
  const $=id=>document.getElementById(id);
  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const html=v=>typeof esc==='function'?esc(v):text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const safeDb=()=>{try{return db||{}}catch{return {}}};
  const can=cap=>window.WarehouseRoleDashboardV1?.can?.(cap)??true;
  let activeTab='MOVIMENTI';

  function ensureSurgicalCss(){
    if($('rdRegistrySurgicalCss'))return;
    const s=document.createElement('style');s.id='rdRegistrySurgicalCss';s.textContent=`
      @media(max-width:430px){
        body:not(.desktopMode) .uxDirtyBar.rdMobileDirtyCompact{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;padding:0!important;width:auto!important;min-width:0!important;gap:0!important}
        body:not(.desktopMode) .uxDirtyBar.rdMobileDirtyCompact .uxDirtyText{display:none!important}
        body:not(.desktopMode) .uxDirtyBar.rdMobileDirtyCompact #uxDirtyExport{min-height:44px!important;padding:0 18px!important;border-radius:999px!important;background:#fff!important;color:#17314d!important;border:1px solid #d8e4ee!important;box-shadow:0 10px 26px rgba(23,49,77,.18)!important;font-size:12px!important}
      }
      #registryScreen .rdRegistryError{background:#fdebea;color:#8d342e;border:1px solid #f0cbc8;border-radius:14px;padding:12px 14px;font-weight:850;margin:10px 0}
    `;document.head.appendChild(s);
  }

  function dateOnly(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return'';const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`}
  function fmt(v){if(!v)return'—';try{return typeof fmtDateTime==='function'?fmtDateTime(v):new Date(v).toLocaleString('it-IT')}catch{return'—'}}
  function locationOfSafe(v){try{return typeof locationOf==='function'?locationOf(v):text(v?.fila_scaffale||v?.fila||'').trim().toUpperCase()}catch{return text(v?.fila_scaffale||v?.fila||'').trim().toUpperCase()}}
  function dateMatch(v){const d=dateOnly(v),from=$('regFrom')?.value||'',to=$('regTo')?.value||'';if(from&&d<from)return false;if(to&&d>to)return false;return true}

  function ensureUxFilters(){
    const host=$('registryFilters');if(!host)return false;
    let box=$('uxRegBox');
    if(!box){
      box=document.createElement('div');box.id='uxRegBox';box.className='uxRegBox';
      box.innerHTML='<div class="uxRegGrid"><input id="uxRegSearch" class="field" placeholder="Cerca articolo, documento, bancale…"><select id="uxRegOperator" class="field"><option value="">TUTTI GLI OPERATORI</option></select><select id="uxRegType" class="field"><option value="">TUTTE LE OPERAZIONI</option><option>CARICA</option><option>SCARICA</option></select><select id="uxRegState" class="field"><option value="">TUTTI GLI STATI</option><option>NUOVO</option><option>SCARICATO</option><option>USATO</option><option>DISMESSO</option><option>NON_CHIARO</option></select></div><div id="uxRegCount" class="uxRegCount"></div>';
      host.appendChild(box);
    }
    const op=$('uxRegOperator');if(op){const cur=op.value,names=[...new Set((safeDb().movements||[]).map(m=>m?.operator).filter(Boolean))].sort();op.innerHTML='<option value="">TUTTI GLI OPERATORI</option>'+names.map(n=>`<option value="${html(n)}">${html(n)}</option>`).join('');if(names.includes(cur))op.value=cur}
    return true;
  }

  function bindControls(){
    ensureUxFilters();
    const bind=(id,event='change')=>{const el=$(id);if(!el||el.dataset.rdRegistryDirect==='1')return;el.dataset.rdRegistryDirect='1';el.removeAttribute('onchange');el.removeAttribute('oninput');el.addEventListener(event,renderDirect)};
    bind('regFrom');bind('regTo');bind('regDest');bind('uxRegSearch','input');bind('uxRegOperator');bind('uxRegType');bind('uxRegState');
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

  function movementCard(m){
    const type=norm(m.movement_type||'MOVIMENTO'),sign=type==='CARICA'?'+':type==='SCARICA'?'−':'';
    const actions=!m.cancelled_at&&can('MOVE')?`<div class="actions"><button class="mini" type="button" onclick="WarehouseRegistryMovementsFixV1.openEdit('${html(m.id)}')">MODIFICA</button><button class="mini danger" type="button" onclick="WarehouseRegistryMovementsFixV1.cancel('${html(m.id)}')">ANNULLA</button></div>`:'';
    return `<div class="movementCard ${m.cancelled_at?'cancelled':''}"><div class="movementTop"><div><div class="sku">${html(m.article_base||'—')} ${m.size?`· ${html(m.size)}`:''}</div><div class="dateLine">${html(fmt(m.operation_at||m.registered_at))}</div></div><div class="bigQty">${sign}${Number(m.quantity||0)}</div></div><div class="meta"><span>${html(type)}</span><span>${html(m.state||'—')}</span><span>Fila/Scaffale ${html(locationOfSafe(m)||'—')}</span><span>Bancale/Carrello ${html(m.bancale||'—')}</span>${m.destination?`<span>${html(m.destination)}</span>`:''}<span>${html(m.operator||'—')}</span>${m.document_id?`<span>${html(m.document_id)}</span>`:''}${m.cancelled_at?'<span>ANNULLATO</span>':''}</div>${m.note?`<p>${html(m.note)}</p>`:''}${actions}</div>`;
  }

  function documentRowsSafe(doc){const d=safeDb(),ids=Array.isArray(doc?.movement_ids)?doc.movement_ids:[];return ids.map(id=>(d.movements||[]).find(m=>m?.id===id)).filter(Boolean)}
  function dischargeRows(){const d=safeDb(),dest=$('regDest')?.value||'',q=norm($('uxRegSearch')?.value),op=norm($('uxRegOperator')?.value);return (Array.isArray(d.documents)?d.documents:[]).filter(x=>x?.type==='SCARICO'&&dateMatch(x.operation_at)&&(!dest||text(x.destination)===dest)&&(!op||norm(x.operator)===op)).filter(x=>{if(!q)return true;const items=documentRowsSafe(x),hay=norm([x.id,x.destination,x.operator,x.request_id,...items.flatMap(m=>[m.article_base,m.size,m.state,m.bancale,locationOfSafe(m)])].join(' '));return hay.includes(q)}).sort((a,b)=>new Date(b.operation_at||0)-new Date(a.operation_at||0))}
  function dischargeCard(d){const items=documentRowsSafe(d),total=items.reduce((n,m)=>n+Number(m.quantity||0),0);return `<div class="documentCard"><div class="docTop"><div><div class="sku">${html(d.id||'SCARICO')}</div><div class="dateLine">${html(fmt(d.operation_at))}</div></div><div class="bigQty">${total}</div></div><div class="meta"><span>${html(d.destination||'—')}</span><span>${html(d.operator||'—')}</span><span>${items.length} righe</span>${d.request_id?`<span>${html(d.request_id)}</span>`:''}</div><div class="actions"><button class="mini" type="button" onclick="openDocument('${html(d.id)}')">APRI</button>${can('EXPORT')?`<button class="mini" type="button" onclick="exportDocument('${html(d.id)}')">EXCEL</button>`:''}</div></div>`}

  function updateTabs(){
    $('tabMovBtn')?.classList.toggle('active',activeTab==='MOVIMENTI');$('tabDocBtn')?.classList.toggle('active',activeTab==='SCARICHI');$('exportFilteredBtn')?.classList.toggle('hidden',activeTab!=='SCARICHI');
    const type=$('uxRegType'),state=$('uxRegState');if(type)type.disabled=activeTab!=='MOVIMENTI';if(state)state.disabled=activeTab!=='MOVIMENTI';
  }

  function renderDirect(){
    try{
      ensureUxFilters();bindControls();updateTabs();const list=$('registryList');if(!list)return false;
      if(activeTab==='MOVIMENTI'){
        const rows=movementRows();if($('uxRegCount'))$('uxRegCount').textContent=`${rows.length} movimenti visualizzati`;list.innerHTML=rows.length?rows.map(movementCard).join(''):'<p>Nessun movimento trovato.</p>';
      }else{
        const docs=dischargeRows();if($('uxRegCount'))$('uxRegCount').textContent=`${docs.length} scarichi visualizzati`;list.innerHTML=docs.length?docs.map(dischargeCard).join(''):'<p>Nessuno scarico trovato.</p>';
      }
      return true;
    }catch(err){console.error('[REGISTRY DIRECT RENDER]',err);const list=$('registryList');if(list)list.innerHTML='<div class="rdRegistryError">Errore nella visualizzazione dello storico. Riapri Registro e riprova.</div>';return false}
  }

  function openTab(tab){activeTab=tab==='SCARICHI'?'SCARICHI':'MOVIMENTI';try{registryTab=activeTab}catch{}renderDirect();return true}
  function decorate(){const s=$('registryScreen');if(!s)return;const b=s.querySelector(':scope>.back');if(b){b.textContent='← HOME';b.onclick=()=>show('home')}const tabs=s.querySelector('.tabs');if(tabs)tabs.style.removeProperty('display');updateTabs()}
  function openMovements(){if(!can('REGISTRY_VIEW'))return window.WarehouseRoleDashboardV1?.deny?.('Registro movimenti')??false;ensureSurgicalCss();bindControls();activeTab='MOVIMENTI';try{registryTab='MOVIMENTI'}catch{};if(typeof show==='function')show('registryScreen');decorate();renderDirect();requestAnimationFrame(()=>{decorate();renderDirect()});return true}
  function openEdit(id){try{return window.openMovementEdit?.(id)}catch(err){console.error('[REGISTRY EDIT]',err);return false}}
  function cancel(id){try{const out=window.cancelMovement?.(id);setTimeout(renderDirect,0);return out}catch(err){console.warn('[REGISTRY CANCEL RENDER RECOVERY]',err);setTimeout(renderDirect,0);return false}}

  function install(){ensureSurgicalCss();bindControls();window.openRoleRegistryMovementsV1=openMovements;document.querySelectorAll('#rdDashboardV1 .rdAction').forEach(btn=>{if(norm(btn.querySelector('b')?.textContent)==='MOVIMENTI')btn.setAttribute('onclick','openRoleRegistryMovementsV1()')});return true}

  window.WarehouseRegistryMovementsFixV1={version:VERSION,install,openMovements,openTab,renderDirect,openEdit,cancel};install();
})();
