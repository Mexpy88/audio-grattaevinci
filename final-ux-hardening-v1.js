/* Final UX Hardening V1
   - robust Registry MOVIMENTI renderer independent from historical wrappers
   - pending export integrated into Master, never as a permanent bottom bar
   - explicit CARICA MASTER EXCEL CTA when no Master exists
   - operational notices hidden before authentication
*/
(function installWarehouseFinalUxHardeningV1(){
  'use strict';
  if(window.WarehouseFinalUxHardeningV1)return;
  const VERSION='2026.08.27-final-ux-hardening1.1';
  const META_KEY='so_local_master_meta_v3';
  const $=id=>document.getElementById(id);
  const txt=v=>String(v??'');
  const norm=v=>txt(v).trim().toUpperCase();
  const h=v=>typeof esc==='function'?esc(v):txt(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const actor=()=>{try{return currentUser||''}catch{return ''}};
  const safeDb=()=>{try{return db||{}}catch{return {}}};
  const can=cap=>window.WarehouseRoleDashboardV1?.can?.(cap)??true;
  let observer=null,scheduled=false,baseRoleRender=null,registryInstalled=false;

  function ensureCss(){if($('finalUxHardeningV1Css'))return;const l=document.createElement('link');l.id='finalUxHardeningV1Css';l.rel='stylesheet';l.href='final-ux-hardening-v1.css?v=20260827-final1';document.head.appendChild(l)}
  function readMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch{return {}}}
  function ms(v){const n=new Date(v||0).getTime();return Number.isFinite(n)?n:0}
  function dirtyBaseline(){const d=safeDb(),m=readMeta();return Math.max(ms(d.master?.imported_at),ms(m.importedAt),ms(m.lastExportAt))}
  function dirtyCount(){const base=dirtyBaseline();if(!base)return 0;return (safeDb().audits||[]).filter(a=>a?.action!=='MASTER_IMPORT'&&ms(a?.at)>base).length}
  function fmt(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
  function loc(r){try{return typeof locationOf==='function'?locationOf(r):txt(r?.fila_scaffale||r?.fila||'').trim().toUpperCase()}catch{return txt(r?.fila_scaffale||r?.fila||'').trim().toUpperCase()}}
  function dateOnly(v){if(!v)return'';const d=new Date(v);if(Number.isNaN(d.getTime()))return'';const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`}
  function dateMatch(v){const d=dateOnly(v),from=$('regFrom')?.value||'',to=$('regTo')?.value||'';if(from&&d<from)return false;if(to&&d>to)return false;return true}

  function suppressLegacyExportBar(){const b=$('uxDirtyBar');if(b){b.classList.add('hidden');b.style.setProperty('display','none','important')}}
  function suppressPreloginOperationalNotices(){
    if(actor())return;
    suppressLegacyExportBar();
    document.querySelectorAll('div,section').forEach(el=>{
      const t=norm(el.textContent||'');if(!t)return;
      if((t.includes('SESSIONE RIPRISTINATA:')||t.includes('MODIFICHE NON ANCORA ESPORTATE'))&&(el.id==='uxSnackbar'||/toast|snack|notice/i.test(el.className||'')))el.style.setProperty('display','none','important');
    });
  }

  function ensureExportDialog(){
    let d=$('rdExportDialogFinal');if(d)return d;
    d=document.createElement('dialog');d.id='rdExportDialogFinal';d.innerHTML='<div class="rdExportFinalHead"><h2>Esporta Master</h2><button type="button" aria-label="Chiudi">×</button></div><div id="rdExportDialogFinalBody" class="rdExportFinalBody"></div>';
    document.body.appendChild(d);d.querySelector('.rdExportFinalHead button').onclick=()=>d.close();return d;
  }
  function openExportDialog(){
    if(!actor())return;
    const count=dirtyCount(),m=readMeta(),d=ensureExportDialog(),body=$('rdExportDialogFinalBody');
    body.innerHTML=`<div class="rdExportFinalCount">${count}</div><p><b>${count===1?'modifica da esportare':'modifiche da esportare'}</b><br>Ultimo export: ${h(fmt(m.lastExportAt))}</p><p>Le modifiche sono già salvate nel browser. L'export genera il Master Excel aggiornato.</p><div class="rdExportFinalActions"><button class="rdExportCancel" type="button">ANNULLA</button><button class="rdExportGo" type="button">ESPORTA MASTER</button></div>`;
    body.querySelector('.rdExportCancel').onclick=()=>d.close();body.querySelector('.rdExportGo').onclick=async()=>{d.close();try{await window.LocalMaster?.exportUpdatedMaster?.()}finally{setTimeout(decorateMaster,250);setTimeout(decorateMaster,900)}};d.showModal();
  }

  function decorateMaster(){
    suppressLegacyExportBar();
    const root=$('rdDashboardV1'),card=root?.querySelector('.rdMaster');if(!card)return false;
    card.querySelector('.rdMasterFile')?.style.setProperty('display','none','important');
    let actions=card.querySelector('.rdMasterActionsFinal');const details=card.querySelector('.rdMasterDetails');
    if(!actions&&details){actions=document.createElement('div');actions.className='rdMasterActionsFinal';details.parentNode.insertBefore(actions,details);actions.appendChild(details)}
    if(!actions)return false;
    const loaded=!!safeDb().master?.rows?.length,count=dirtyCount(),ready=card.querySelector('.rdReady');
    actions.querySelector('.rdPendingExportBtn')?.remove();
    if(!loaded){
      if(ready)ready.textContent='DA CARICARE';
      if(details){details.textContent='CARICA MASTER EXCEL';details.classList.add('rdMasterLoad');details.onclick=()=>{if(!can('MASTER'))return window.WarehouseRoleDashboardV1?.deny?.('Caricamento Master');if(typeof triggerMasterImportV1==='function')triggerMasterImportV1();else $('masterInput')?.click()}}
      return true;
    }
    if(ready)ready.textContent='PRONTO';
    if(details){details.textContent='DETTAGLI';details.classList.remove('rdMasterLoad');details.onclick=()=>window.openMasterDetailsV1?.()}
    if(count>0&&can('MASTER')){const b=document.createElement('button');b.type='button';b.className='rdPendingExportBtn';b.textContent=`↑ ESPORTA · ${count}`;b.title=`${count} modifiche da esportare`;b.onclick=openExportDialog;actions.insertBefore(b,details||null)}
    return true;
  }

  function ensureRegistryFilters(){
    const host=$('registryFilters');if(!host)return false;
    let box=$('uxRegBox');if(!box){box=document.createElement('div');box.id='uxRegBox';box.className='uxRegBox';box.innerHTML='<div class="uxRegGrid"><input id="uxRegSearch" class="field" placeholder="Cerca articolo, documento, bancale…"><select id="uxRegOperator" class="field"><option value="">TUTTI GLI OPERATORI</option></select><select id="uxRegType" class="field"><option value="">TUTTE LE OPERAZIONI</option></select><select id="uxRegState" class="field"><option value="">TUTTI GLI STATI</option><option>NUOVO</option><option>SCARICATO</option><option>USATO</option><option>DISMESSO</option></select></div><div id="uxRegCount" class="uxRegCount"></div>';host.appendChild(box)}
    const type=$('uxRegType');if(type){const current=type.value,signature='CARICA|SCARICA|SPOSTA|RETTIFICA|VERIFICA FISICA';if(type.dataset.finalTypes!==signature){type.innerHTML='<option value="">TUTTE LE OPERAZIONI</option><option>CARICA</option><option>SCARICA</option><option>SPOSTA</option><option>RETTIFICA</option><option value="VERIFICA FISICA">VERIFICA FISICA</option>';type.dataset.finalTypes=signature;if([...type.options].some(o=>o.value===current))type.value=current}}
    const ops=$('uxRegOperator');if(ops){const cur=ops.value,d=safeDb(),names=new Set();(d.movements||[]).forEach(x=>x.operator&&names.add(x.operator));(d.rectifications||[]).forEach(x=>x.operator&&names.add(x.operator));(d.stock_transfers||[]).forEach(x=>x.operator&&names.add(x.operator));(d.stock_verifications||[]).forEach(x=>x.operator&&names.add(x.operator));const signature=[...names].sort().join('|');if(ops.dataset.finalOps!==signature){ops.innerHTML='<option value="">TUTTI GLI OPERATORI</option>'+[...names].sort().map(o=>`<option value="${h(o)}">${h(o)}</option>`).join('');ops.dataset.finalOps=signature;if([...ops.options].some(o=>o.value===cur))ops.value=cur}}
    ['uxRegSearch','uxRegOperator','uxRegType','uxRegState','regFrom','regTo','regDest'].forEach(id=>{const el=$(id);if(!el||el.dataset.finalRegistryBound==='1')return;el.dataset.finalRegistryBound='1';el.addEventListener(el.tagName==='INPUT'&&el.type!=='date'?'input':'change',renderSafeRegistry)});
    return true;
  }

  function entryTypeClass(type){const t=norm(type);if(t==='CARICA')return'typeCarica';if(t==='SCARICA')return'typeScarica';if(t==='SPOSTA')return'typeSposta';if(t.includes('VERIFICA'))return'typeVerifica';return'typeRettifica'}
  function movementCard(m){const type=norm(m.movement_type||'MOVIMENTO'),sign=type==='CARICA'?'+':type==='SCARICA'?'−':'';const actions=!m.cancelled_at&&can('MOVE')?`<div class="registryFinalActions"><button type="button" onclick="openMovementEdit('${h(m.id)}')">MODIFICA</button><button type="button" class="danger" onclick="cancelMovement('${h(m.id)}')">ANNULLA</button></div>`:'';return `<article class="registryFinalEvent ${m.cancelled_at?'cancelled':''}"><div class="registryFinalTop"><div><div class="registryFinalTitle">${h(m.article_base||'—')}${m.size?` · ${h(m.size)}`:''}</div><div class="registryFinalTime">${h(fmt(m.operation_at||m.registered_at))}</div></div><div class="registryFinalQty">${sign}${Number(m.quantity||0)}</div></div><div class="registryFinalMeta"><span class="${entryTypeClass(type)}">${h(type)}</span><span>${h(m.state||'—')}</span><span>${h(m.operator||'—')}</span>${m.destination?`<span>${h(m.destination)}</span>`:''}${m.document_id?`<span>${h(m.document_id)}</span>`:''}${m.cancelled_at?'<span>ANNULLATO</span>':''}</div><div class="registryFinalRoute">Fila/Scaffale ${h(loc(m)||'NON ASSEGNATO')} · Bancale/Carrello ${h(m.bancale||'—')}</div>${m.note?`<div class="registryFinalRoute">${h(m.note)}</div>`:''}${actions}</article>`}
  function rectCard(r){const before=r.before||null,after=r.after||null,x=after||before||{},bq=before&&after&&Number(before.quantity)!==Number(after.quantity)?`${Number(before.quantity||0)} → ${Number(after.quantity||0)}`:after?`=${Number(after.quantity||0)}`:`→ 0`;return `<article class="registryFinalEvent ${r.cancelled_at?'cancelled':''}"><div class="registryFinalTop"><div><div class="registryFinalTitle">${h(x.article_base||'—')}${x.size?` · ${h(x.size)}`:''}</div><div class="registryFinalTime">${h(fmt(r.operation_at||r.registered_at||r.at))}</div></div><div class="registryFinalQty">${bq}</div></div><div class="registryFinalMeta"><span class="typeRettifica">RETTIFICA</span><span>${h(x.state||'—')}</span><span>${h(r.operator||'—')}</span>${r.cancelled_at?'<span>ANNULLATA</span>':''}</div><div class="registryFinalRoute">${h(r.note||'Correzione giacenza')}</div></article>`}
  function transferCard(t){const from=t.from_filter||{},to=t.to||{},qty=Number(t.total_pieces||0);return `<article class="registryFinalEvent"><div class="registryFinalTop"><div><div class="registryFinalTitle">${h(t.id||'SPOSTAMENTO')}</div><div class="registryFinalTime">${h(fmt(t.created_at))}</div></div><div class="registryFinalQty">${qty}</div></div><div class="registryFinalMeta"><span class="typeSposta">SPOSTA</span><span>${h(t.operator||'—')}</span><span>${(t.lines||[]).length} righe</span></div><div class="registryFinalRoute">Da: Fila/Scaffale ${h(from.fila_scaffale||'—')} · Bancale ${h(from.bancale||'—')}<br>A: Fila/Scaffale ${h(to.fila_scaffale||'—')} · Bancale ${h(to.bancale||'—')}</div></article>`}
  function verificationCard(v){const p=v.position||{},plus=Number(v.positive_difference||0),minus=Number(v.negative_difference||0);return `<article class="registryFinalEvent"><div class="registryFinalTop"><div><div class="registryFinalTitle">${h(v.id||'VERIFICA FISICA')}</div><div class="registryFinalTime">${h(fmt(v.created_at))}</div></div><div class="registryFinalQty">${Number(v.changed_lines||0)}</div></div><div class="registryFinalMeta"><span class="typeVerifica">VERIFICA FISICA</span><span>${h(v.operator||'—')}</span><span>${(v.lines||[]).length} controllate</span><span>+${plus} / -${minus}</span></div><div class="registryFinalRoute">Fila/Scaffale ${h(p.fila_scaffale||'—')} · Bancale/Carrello ${h(p.bancale||'—')}</div></article>`}

  function registryEntries(){
    const d=safeDb(),out=[];
    (d.movements||[]).forEach(v=>out.push({kind:'M',type:norm(v.movement_type),time:v.operation_at||v.registered_at||'',operator:v.operator||'',state:v.state||'',destination:v.destination||'',search:[v.article_base,v.size,v.state,v.movement_type,v.operator,v.document_id,loc(v),v.bancale,v.destination,v.note].join(' '),v}));
    (d.rectifications||[]).forEach(v=>{const sem=norm(v.semantic_type||v.type||'RETTIFICA');if(sem==='SPOSTA'||sem==='VERIFICA_FISICA')return;const x=v.after||v.before||{};out.push({kind:'R',type:'RETTIFICA',time:v.operation_at||v.registered_at||v.at||'',operator:v.operator||'',state:x.state||'',destination:'',search:[x.article_base,x.size,x.state,'RETTIFICA',v.operator,loc(x),x.bancale,v.note].join(' '),v})});
    (d.stock_transfers||[]).forEach(v=>out.push({kind:'T',type:'SPOSTA',time:v.created_at||'',operator:v.operator||'',state:(v.lines||[]).map(x=>x.state).join(' '),destination:'',search:[v.id,v.operator,'SPOSTA',JSON.stringify(v.lines||[]),JSON.stringify(v.from_filter||{}),JSON.stringify(v.to||{})].join(' '),v}));
    (d.stock_verifications||[]).forEach(v=>out.push({kind:'V',type:'VERIFICA FISICA',time:v.created_at||'',operator:v.operator||'',state:(v.lines||[]).map(x=>x.state).join(' '),destination:'',search:[v.id,v.operator,'VERIFICA FISICA',JSON.stringify(v.lines||[]),JSON.stringify(v.position||{})].join(' '),v}));
    return out;
  }

  function renderMovements(){
    ensureRegistryFilters();const list=$('registryList');if(!list)return;
    const dest=$('regDest')?.value||'',q=norm($('uxRegSearch')?.value),op=norm($('uxRegOperator')?.value),type=norm($('uxRegType')?.value),state=norm($('uxRegState')?.value);
    let rows=registryEntries().filter(e=>dateMatch(e.time)&&(!dest||norm(e.destination)===norm(dest))&&(!op||norm(e.operator)===op)&&(!type||norm(e.type)===type)&&(!state||norm(e.state).includes(state))&&(!q||norm(e.search).includes(q)));
    rows.sort((a,b)=>ms(b.time)-ms(a.time));const count=$('uxRegCount');if(count)count.textContent=`${rows.length} registrazioni visualizzate`;
    list.innerHTML=rows.length?rows.map(e=>e.kind==='M'?movementCard(e.v):e.kind==='R'?rectCard(e.v):e.kind==='T'?transferCard(e.v):verificationCard(e.v)).join(''):'<div class="registryFinalEmpty">Nessun movimento trovato con i filtri selezionati.</div>';
  }
  function documentRowsSafe(doc){const d=safeDb();return (doc.movement_ids||[]).map(id=>(d.movements||[]).find(m=>m.id===id)).filter(Boolean)}
  function renderDischarges(){
    ensureRegistryFilters();const list=$('registryList');if(!list)return;const d=safeDb(),dest=$('regDest')?.value||'',q=norm($('uxRegSearch')?.value),op=norm($('uxRegOperator')?.value);
    let docs=(d.documents||[]).filter(x=>x.type==='SCARICO'&&dateMatch(x.operation_at)&&(!dest||x.destination===dest)&&(!op||norm(x.operator)===op));if(q)docs=docs.filter(x=>norm([x.id,x.destination,x.operator,x.request_id,...documentRowsSafe(x).flatMap(m=>[m.article_base,m.size,m.state,m.bancale,loc(m)])].join(' ')).includes(q));docs.sort((a,b)=>ms(b.operation_at)-ms(a.operation_at));
    const count=$('uxRegCount');if(count)count.textContent=`${docs.length} scarichi visualizzati`;list.innerHTML=docs.length?docs.map(x=>{const items=documentRowsSafe(x),total=items.reduce((n,m)=>n+Number(m.quantity||0),0);return `<article class="registryFinalEvent"><div class="registryFinalTop"><div><div class="registryFinalTitle">${h(x.id||'SCARICO')}</div><div class="registryFinalTime">${h(fmt(x.operation_at))}</div></div><div class="registryFinalQty">${total}</div></div><div class="registryFinalMeta"><span class="typeScarica">SCARICO</span><span>${h(x.destination||'—')}</span><span>${h(x.operator||'—')}</span><span>${items.length} righe</span>${x.request_id?`<span>${h(x.request_id)}</span>`:''}</div><div class="registryFinalActions"><button type="button" onclick="openDocument('${h(x.id)}')">APRI</button>${can('EXPORT')?`<button type="button" onclick="exportDocument('${h(x.id)}')">EXCEL</button>`:''}</div></article>`}).join(''):'<div class="registryFinalEmpty">Nessuno scarico trovato con i filtri selezionati.</div>';
  }
  function setTabs(tab){$('tabMovBtn')?.classList.toggle('active',tab==='MOVIMENTI');$('tabDocBtn')?.classList.toggle('active',tab==='SCARICHI');$('exportFilteredBtn')?.classList.toggle('hidden',tab!=='SCARICHI')}
  function renderSafeRegistry(){let tab='MOVIMENTI';try{tab=registryTab||'MOVIMENTI'}catch{}setTabs(tab);if(tab==='SCARICHI')renderDischarges();else renderMovements()}
  function setSafeRegistryTab(tab){try{registryTab=tab}catch{}setTabs(tab);renderSafeRegistry()}
  function openMovements(){if(!can('REGISTRY_VIEW'))return window.WarehouseRoleDashboardV1?.deny?.('Registro movimenti');setSafeRegistryTab('MOVIMENTI');try{renderMasterStatus?.()}catch{}show('registryScreen');const s=$('registryScreen'),back=s?.querySelector(':scope>.back');if(back){back.textContent='← HOME';back.onclick=()=>show('home')}return true}

  function installRegistry(){
    if(!registryInstalled){window.renderRegistry=renderSafeRegistry;window.setRegistryTab=setSafeRegistryTab;window.openRoleRegistryMovementsV1=openMovements;registryInstalled=true}
    document.querySelectorAll('#rdDashboardV1 .rdAction').forEach(btn=>{if(norm(btn.querySelector('b')?.textContent)==='MOVIMENTI')btn.setAttribute('onclick','openRoleRegistryMovementsV1()')});
  }

  function wrapRoleDashboard(){const api=window.WarehouseRoleDashboardV1,fn=api?.renderDashboard;if(!api||typeof fn!=='function'||fn.__finalHardening)return;if(!baseRoleRender)baseRoleRender=fn;const f=function(){const out=baseRoleRender.apply(this,arguments);requestAnimationFrame(()=>{decorateMaster();installRegistry();suppressPreloginOperationalNotices()});return out};f.__finalHardening=true;api.renderDashboard=f}
  function decorate(){ensureCss();suppressLegacyExportBar();suppressPreloginOperationalNotices();decorateMaster();installRegistry();wrapRoleDashboard()}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;try{decorate()}catch(e){console.warn('[FINAL UX]',e)}})}
  function install(){ensureCss();decorate();if(!observer){observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true})}document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});return true}

  window.WarehouseFinalUxHardeningV1={version:VERSION,install,decorate,dirtyCount,decorateMaster,renderSafeRegistry,openMovements,openExportDialog};install();
})();
