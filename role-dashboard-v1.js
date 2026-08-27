/* Role-aware Dashboard V1
   - Login landing before Home
   - Role/PIN capability model
   - Responsive dashboard for desktop + smartphone
   - Requests progress/completion, Registry audit/export, Activity summary
   - Keeps existing warehouse data engines authoritative
*/
(function installWarehouseRoleDashboardV1(){
  'use strict';
  if(window.WarehouseRoleDashboardV1)return;

  const VERSION='2026.08.27-role-dashboard1';
  const $=id=>document.getElementById(id);
  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const html=v=>typeof esc==='function'?esc(v):text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=v=>{if(!v)return false;const d=new Date(v),n=new Date();return !Number.isNaN(d.getTime())&&d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate()};
  const fmt=v=>{try{return typeof fmtDateTime==='function'?fmtDateTime(v):new Date(v).toLocaleString('it-IT')}catch{return '—'}};
  const safeDb=()=>typeof db!=='undefined'&&db?db:{};

  /* Existing PINs are SHA-256('warehouse-so|PIN'). Add Lina and Luca without exposing clear PINs in the app UI. */
  try{
    USER_HASHES['affce9023143d551660fdacd5a3c8c827c31fd3e521331e38bc8a375ef4cedc2']='Lina';
    USER_HASHES['549df9b2f2268e5c381ff04aa5019cf4f5eb6c8768821c23a7b42cb5c31fa2ff']='Luca';
  }catch(e){console.warn('Estensione utenti non disponibile',e)}

  const ALL=['STOCK_VIEW','MOVE','RECTIFY','COUNT','REQUEST_VIEW','REQUEST_CREATE','REQUEST_PROCESS','REGISTRY_VIEW','AUDIT_VIEW','EXPORT','MASTER'];
  const PROFILES={
    Mattia:{role:'ADMIN',label:'Amministratore',caps:new Set(ALL)},
    Massimo:{role:'OPERATORE_FULL',label:'Operatore',caps:new Set(ALL)},
    Alessandra:{role:'SUPERVISORE',label:'Sola lettura',caps:new Set(['STOCK_VIEW','REQUEST_VIEW','REGISTRY_VIEW','AUDIT_VIEW'])},
    Lina:{role:'RICHIEDENTE',label:'Richiedente',caps:new Set(['STOCK_VIEW','REQUEST_VIEW','REQUEST_CREATE'])},
    Luca:{role:'SUPERVISORE',label:'Sola lettura',caps:new Set(['STOCK_VIEW','REQUEST_VIEW','REGISTRY_VIEW','AUDIT_VIEW'])}
  };

  let installed=false,baseSyncAuth=null,baseSubmitLogin=null,baseLogout=null,baseOpenRegistry=null,baseRenderStock=null,baseRenderRegistry=null,baseOpenRequestDetail=null,baseRenderRequestDetail=null,refreshTimer=null;

  function user(){try{return currentUser||''}catch{return ''}}
  function profile(){return PROFILES[user()]||{role:'GUEST',label:'Ospite',caps:new Set()}}
  function can(cap){return profile().caps.has(cap)}
  function isReadonly(){const r=profile().role;return r==='SUPERVISORE'}
  function isLina(){return user()==='Lina'}
  function logged(){return !!user()}

  function deny(label='Operazione'){
    const msg=`${label}: operazione non autorizzata per ${user()||'questo utente'}.`;
    try{if(typeof warehouseToast==='function')warehouseToast(msg,'error');else alert(msg)}catch{alert(msg)}
    return false;
  }
  function guard(cap,label,fn){return function(){if(!can(cap))return deny(label);return fn.apply(this,arguments)}}

  function ensureCss(){
    if(document.getElementById('roleDashboardV1Css'))return;
    const l=document.createElement('link');l.id='roleDashboardV1Css';l.rel='stylesheet';l.href='role-dashboard-v1.css?v=20260827-role-dashboard1';document.head.appendChild(l);
  }

  function ensureLanding(){
    if($('accessLandingV1'))return true;
    const main=document.querySelector('main');if(!main)return false;
    const s=document.createElement('section');s.id='accessLandingV1';s.className='screen';
    s.innerHTML=`<div class="rdAccessShell"><img class="rdAccessLogo" src="logo-transparent.png?v=20260826-1" alt="Servizi Ospedalieri"><div class="rdAccessCard"><div class="rdAccessTitle">Gestione Magazzino</div><div class="rdAccessSub">Accesso operatori</div><button class="rdAccessBtn" type="button" onclick="openLogin()">ACCEDI</button></div></div>`;
    main.insertBefore(s,main.firstChild);return true;
  }

  function ensureTopbar(){
    const top=document.querySelector('.topbar'),auth=top?.querySelector('.authArea'),logo=top?.querySelector('.logoButton');if(!top||!auth||!logo)return false;
    let title=$('rdHeaderTitleV1');if(!title){title=document.createElement('div');title.id='rdHeaderTitleV1';title.className='rdHeaderTitle';title.innerHTML='<b>Gestione Magazzino</b><span>Dashboard</span>';logo.insertAdjacentElement('afterend',title)}
    let views=$('rdViewIconsV1');if(!views){views=document.createElement('div');views.id='rdViewIconsV1';views.className='rdViewIcons';views.innerHTML='<button id="rdDesktopViewV1" class="rdViewBtn" type="button" title="Desktop" aria-label="Vista desktop" onclick="setWarehouseViewMode(\'desktop\');WarehouseRoleDashboardV1.syncViewIcons()">▣</button><button id="rdPhoneViewV1" class="rdViewBtn" type="button" title="Smartphone" aria-label="Vista smartphone" onclick="setWarehouseViewMode(\'smartphone\');WarehouseRoleDashboardV1.syncViewIcons()">▯</button>';auth.insertBefore(views,auth.firstChild)}
    syncViewIcons();return true;
  }
  function syncViewIcons(){const desk=document.body.classList.contains('desktopMode');$('rdDesktopViewV1')?.classList.toggle('active',desk);$('rdPhoneViewV1')?.classList.toggle('active',!desk)}

  function ensureMasterDialog(){
    if($('rdMasterDialog'))return $('rdMasterDialog');
    const d=document.createElement('dialog');d.id='rdMasterDialog';d.innerHTML='<div class="rdDialogHead"><h2>Master Excel</h2><button type="button" onclick="rdMasterDialog.close()">×</button></div><div id="rdMasterDialogBody" class="rdDialogBody"></div>';document.body.appendChild(d);return d;
  }

  function masterState(){
    const m=safeDb().master||{},rows=Array.isArray(m.rows)?m.rows:[];
    let dirty=0;try{const meta=JSON.parse(localStorage.getItem('so_local_master_meta_v3')||'{}'),base=meta.lastExportAt||meta.importedAt;if(base){const t=new Date(base).getTime();dirty=(safeDb().audits||[]).filter(a=>new Date(a.at||0).getTime()>t).length}}catch{}
    return {loaded:rows.length>0,count:rows.length,file:m.filename||'Nessun Master importato',at:m.imported_at||'',dirty};
  }
  function masterHtml(){
    const m=masterState(),status=m.loaded?(m.dirty?`${m.dirty} modifiche da esportare`:'Nessuna modifica in attesa di export'):'Master non caricato';
    return `<section class="rdMaster ${m.loaded?'':'rdNoMaster'}"><div class="rdMasterMain"><div class="rdExcelIcon">X</div><div class="rdMasterText"><div class="rdMasterTopline"><b>MASTER EXCEL</b><span class="rdReady">${m.loaded?'PRONTO':'NON CARICATO'}</span></div><div class="rdMasterFile" title="${html(m.file)}">${html(m.file)}</div></div></div><div class="rdMasterMetric"><span>Righe totali</span><b>${m.count.toLocaleString('it-IT')}</b></div><div class="rdMasterMetric"><span>Ultimo aggiornamento</span><b>${m.at?html(fmt(m.at)):'—'}</b></div><div class="rdMasterMetric rdMasterState"><span>Stato</span><b>${html(status)}</b></div><button class="rdMasterDetails" type="button" onclick="openMasterDetailsV1()">DETTAGLI</button></section>`;
  }

  const icon={move:'↔',stock:'⌕',requests:'✓',registry:'≡'};
  function action(label,ico,cap,fn,lockLabel){const ok=can(cap);return `<button class="rdAction ${ok?'':'locked'}" type="button" onclick="${ok?fn:`WarehouseRoleDashboardV1.deny('${html(lockLabel||label)}')`}"><span class="rdActionIcon">${ico}</span><b>${label}</b><span class="rdActionArrow">›</span></button>`}
  function moduleCard(kind,title,sub,actions){return `<section class="rdModule ${kind}"><div class="rdModuleHead"><div class="rdModuleIcon">${icon[kind]}</div><div class="rdModuleTitle"><b>${title}</b><span>${sub}</span></div></div>${actions.join('')}</section>`}

  function modulesHtml(){
    const cards=[];
    if(!isLina()){
      cards.push(moduleCard('move','MOVIMENTA','Carica, scarica e sposta',[
        action('CARICA','↑','MOVE',"openOperation('CARICA')"),action('SCARICA','↓','MOVE',"openOperation('SCARICA')"),action('SPOSTA','↔','MOVE','openStockMoveV2()')
      ]));
    }
    const stockActions=[action('CERCA','⌕','STOCK_VIEW','openSearch()')];
    if(!isLina()){stockActions.push(action('RETTIFICA','✎','RECTIFY','openDirectRectificationV2()'));stockActions.push(action('CONTEGGIO ASSISTITO','☷','COUNT','openPhysicalCountV2()'))}
    cards.push(moduleCard('stock','GIACENZE',isLina()?'Cerca articoli e posizioni':'Cerca, rettifica e verifica',stockActions));
    const reqActions=[action('NUOVA RICHIESTA','＋','REQUEST_CREATE','openRoleRequestNewV1()')];
    reqActions.push(action('AVANZAMENTO','▥','REQUEST_VIEW','openRoleRequestProgressV1()'));
    if(!isLina())reqActions.push(action('COMPLETAMENTO','✓','REQUEST_VIEW','openRoleRequestCompletionV1()'));
    cards.push(moduleCard('requests','RICHIESTE','Prelievi e avanzamento',reqActions));
    if(!isLina())cards.push(moduleCard('registry','REGISTRO','Movimenti e storico',[action('MOVIMENTI','≡','REGISTRY_VIEW','openRoleRegistryMovementsV1()'),action('AUDIT','◷','AUDIT_VIEW','openRoleAuditV1()'),action('ESPORTA MOVIMENTI','⇩','EXPORT','exportRoleMovementsV1()')]));
    return cards.join('');
  }

  function activityStats(){
    const d=safeDb(),moves=d.movements||[],trans=d.stock_transfers||[],reqs=d.requests||[],audits=d.audits||[];
    const car=moves.filter(m=>!m.cancelled_at&&m.movement_type==='CARICA'&&today(m.operation_at||m.registered_at)).length;
    const scar=moves.filter(m=>!m.cancelled_at&&m.movement_type==='SCARICA'&&today(m.operation_at||m.registered_at)).length;
    const sp=trans.filter(x=>today(x.created_at||x.operation_at||x.registered_at)).length;
    const visible=isLina()?reqs.filter(requestVisibleToCurrent):reqs;
    const open=visible.filter(r=>r.status!=='COMPLETATA').length,complete=visible.filter(r=>r.status==='COMPLETATA').length;
    const latest=[...audits].sort((a,b)=>new Date(b.at||0)-new Date(a.at||0))[0]?.at||'';
    return {car,scar,sp,open,complete,latest};
  }
  function activityHtml(){const s=activityStats(),items=isLina()?[[s.open,'Richieste aperte','▥'],[s.complete,'Completate','✓'],[s.latest?fmt(s.latest):'—','Ultima attività','◷']]:[[s.car,'Carichi oggi','↑'],[s.scar,'Scarichi oggi','↓'],[s.sp,'Spostamenti oggi','↔'],[s.open,'Richieste aperte','▥'],[s.complete,'Richieste completate','✓'],[s.latest?fmt(s.latest):'—','Ultima attività','◷']];return `<section class="rdActivity"><div class="rdActivityTitle">RIEPILOGO ATTIVITÀ</div><div class="rdActivityGrid">${items.map(([v,l,i])=>`<div class="rdActivityItem"><div class="rdActivityDot">${i}</div><div><b>${html(v)}</b><span>${l}</span></div></div>`).join('')}</div></section>`}

  function ensureDashboard(){
    const home=$('home');if(!home)return false;
    let root=$('rdDashboardV1');if(!root){root=document.createElement('div');root.id='rdDashboardV1';home.insertBefore(root,home.firstChild)}
    renderDashboard();return true;
  }
  function renderDashboard(){
    const root=$('rdDashboardV1');if(!root||!logged())return false;
    const p=profile();root.innerHTML=`<div class="rdDashTop"><div class="rdDashTitle"><h1>Dashboard</h1><span>${html(user())} · ${html(p.label)}</span></div></div>${isLina()?'':masterHtml()}<div class="rdModules">${modulesHtml()}</div>${activityHtml()}`;
    document.body.classList.toggle('rdReadOnly',isReadonly());
    return true;
  }

  function ensureAuxScreens(){
    const main=document.querySelector('main');if(!main)return false;
    if(!$('rdRequestProgressV1')){const s=document.createElement('section');s.id='rdRequestProgressV1';s.className='screen';s.innerHTML='<button class="back" onclick="show(\'home\')">← HOME</button><div class="rdSectionHead"><div><div class="eyebrow">RICHIESTE</div><h1>Avanzamento</h1></div></div><div id="rdRequestProgressListV1"></div>';main.appendChild(s)}
    if(!$('rdRequestCompletionV1')){const s=document.createElement('section');s.id='rdRequestCompletionV1';s.className='screen';s.innerHTML='<button class="back" onclick="show(\'home\')">← HOME</button><div class="rdSectionHead"><div><div class="eyebrow">RICHIESTE</div><h1>Completamento</h1></div></div><div id="rdRequestCompletionListV1"></div>';main.appendChild(s)}
    if(!$('rdAuditV1')){const s=document.createElement('section');s.id='rdAuditV1';s.className='screen';s.innerHTML='<button class="back" onclick="show(\'home\')">← HOME</button><div class="rdSectionHead"><div><div class="eyebrow">REGISTRO</div><h1>Audit</h1></div></div><div class="rdCleanCard rdAuditFilters"><input id="rdAuditSearchV1" class="field" placeholder="Cerca operatore, azione, articolo…" oninput="renderRoleAuditV1()"><input id="rdAuditDateV1" class="field" type="date" onchange="renderRoleAuditV1()"></div><div id="rdAuditListV1"></div>';main.appendChild(s)}
    return true;
  }

  function requestVisibleToCurrent(r){if(!isLina())return true;return norm(r?.operator)==='LINA'||norm(r?.destination)==='LINA'}
  function requestSummary(r){try{return window.WarehouseRequestCompletionWorkflow?.requestSummary?.(r)||{requested:0,picked:0,unpicked:0}}catch{return {requested:0,picked:0,unpicked:0}}}
  function requestCard(r,completion=false){const s=requestSummary(r),pct=s.requested?Math.min(100,Math.round(s.picked*100/s.requested)):0,status=norm(r.status||'DA PREPARARE'),cls=status==='COMPLETATA'?'complete':status==='PARZIALE'?'partial':'';return `<article class="rdRequestCard"><div class="rdReqMain"><b>${html(r.id||'RICHIESTA')}</b><div class="rdReqMeta">${html(r.destination||'—')} · ${html(fmt(r.requested_at||r.created_at))}</div><div class="rdReqProgress"><i style="width:${pct}%"></i></div><div class="rdReqStats"><span>${s.picked}/${s.requested} cartoni</span><span>${s.unpicked} mancanti</span></div><button class="rdReqOpen" type="button" onclick="openRoleRequestDetailV1('${html(r.id)}')">${completion&&status!=='COMPLETATA'&&can('REQUEST_PROCESS')?'APRI / COMPLETA':'APRI'}</button></div><span class="rdReqStatus ${cls}">${html(status)}</span></article>`}
  function renderRequestProgress(){const list=$('rdRequestProgressListV1');if(!list)return;let rows=(safeDb().requests||[]).filter(requestVisibleToCurrent).filter(r=>r.status!=='COMPLETATA');rows=[...rows].sort((a,b)=>new Date(b.requested_at||b.created_at||0)-new Date(a.requested_at||a.created_at||0));list.innerHTML=rows.length?rows.map(r=>requestCard(r)).join(''):'<div class="rdCleanCard">Nessuna richiesta in corso.</div>'}
  function renderRequestCompletion(){const list=$('rdRequestCompletionListV1');if(!list)return;const all=(safeDb().requests||[]).filter(requestVisibleToCurrent),pending=all.filter(r=>r.status!=='COMPLETATA'&&(r.status==='PARZIALE'||(r.deliveries||[]).length>0)),done=all.filter(r=>r.status==='COMPLETATA');list.innerHTML=`${pending.length?'<div class="sectionTitle">Da completare</div>'+pending.map(r=>requestCard(r,true)).join(''):''}${done.length?'<div class="sectionTitle">Completate</div>'+done.map(r=>requestCard(r,true)).join(''):''}${!pending.length&&!done.length?'<div class="rdCleanCard">Nessuna richiesta da mostrare.</div>':''}`}

  function auditRows(){const q=norm($('rdAuditSearchV1')?.value),date=$('rdAuditDateV1')?.value||'';return (safeDb().audits||[]).filter(a=>{if(date){const d=new Date(a.at||0);const iso=Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);if(iso!==date)return false}if(!q)return true;const blob=norm([a.operator,a.action,a.entityType,a.entityId,JSON.stringify(a.after||{}),JSON.stringify(a.before||{})].join(' '));return blob.includes(q)}).slice(0,300)}
  function renderAudit(){const h=$('rdAuditListV1');if(!h)return;const rows=auditRows();h.innerHTML=rows.length?rows.map(a=>`<div class="rdAuditRow"><div class="rdAuditTop"><b>${html(a.action||'ATTIVITÀ')} · ${html(a.entityType||'')}</b><span>${html(fmt(a.at))}</span></div><div class="rdAuditMeta"><span>${html(a.operator||'—')}</span><span>${html(a.entityId||'—')}</span></div></div>`).join(''):'<div class="rdCleanCard">Nessuna attività trovata.</div>'}

  function decorateRegistryReadonly(){if(!isReadonly())return;document.querySelectorAll('#registryList .actions').forEach(a=>a.style.display='none')}
  function decorateRequestDetailReadonly(){
    if(can('REQUEST_PROCESS'))return;
    const screen=$('requestDetail');if(!screen)return;screen.querySelectorAll('input,textarea,select').forEach(el=>el.disabled=true);$('confirmPickBtn')?.style.setProperty('display','none','important');screen.querySelectorAll('[data-request-close-button]').forEach(x=>x.style.setProperty('display','none','important'));const extra=$('extraSearch')?.closest('.card');if(extra)extra.style.display='none';screen.querySelectorAll('button').forEach(b=>{if(/RIAPRI|MODIFICA/i.test(b.textContent||''))b.style.display='none'})
  }

  function installPermissionGuards(){
    const wrap=(name,cap,label)=>{const base=window[name];if(typeof base!=='function'||base.__rdGuard)return;const f=guard(cap,label,base);f.__rdGuard=true;f.__previous=base;window[name]=f};
    ['openOperation','confirmOperation','openStockMoveV2','confirmStockMoveV2'].forEach(n=>wrap(n,'MOVE','Movimentazione'));
    ['openDirectRectificationV2','openStockEdit','saveStockEdit'].forEach(n=>wrap(n,'RECTIFY','Rettifica'));
    ['openPhysicalCountV2','loadPhysicalCountAssistV3','confirmPhysicalCountAssistV3','addCountPartialV3','markCountZeroV3','openStockQuickFoundV3'].forEach(n=>wrap(n,'COUNT','Conteggio assistito'));
    ['newRequest','createManualRequest','prepareRequestAnalysis','saveRequestFromReview'].forEach(n=>wrap(n,'REQUEST_CREATE','Nuova richiesta'));
    ['confirmPicking','completeRequest','reopenRequest'].forEach(n=>wrap(n,'REQUEST_PROCESS','Gestione richiesta'));
    ['openMovementEdit','saveMovementEdit','cancelMovement'].forEach(n=>wrap(n,'MOVE','Modifica movimenti'));
    ['importMappedMaster','confirmDeleteMaster','openDeleteMasterDialog'].forEach(n=>wrap(n,'MASTER','Gestione Master'));
  }

  function installWrappers(){
    if(typeof window.syncAuthUI==='function'&&!window.syncAuthUI.__rdV1){baseSyncAuth=window.syncAuthUI;const f=function(){const out=baseSyncAuth.apply(this,arguments);syncAuthState();return out};f.__rdV1=true;window.syncAuthUI=f}
    if(typeof window.submitLogin==='function'&&!window.submitLogin.__rdV1){baseSubmitLogin=window.submitLogin;const f=async function(){const before=user(),out=await baseSubmitLogin.apply(this,arguments);if(user()&&user()!==before){syncAuthState();renderDashboard()}return out};f.__rdV1=true;window.submitLogin=f}
    if(typeof window.logout==='function'&&!window.logout.__rdV1){baseLogout=window.logout;const f=function(){const out=baseLogout.apply(this,arguments);syncAuthState();return out};f.__rdV1=true;window.logout=f}
    if(typeof window.openRegistry==='function'&&!window.openRegistry.__rdV1){baseOpenRegistry=window.openRegistry}
    if(typeof window.renderStock==='function'&&!window.renderStock.__rdV1){baseRenderStock=window.renderStock;const f=function(){const out=baseRenderStock.apply(this,arguments);if(!can('RECTIFY'))document.querySelectorAll('#stockList .uxQuickEdit,#stockList .uxQuickIn,#stockList .uxQuickOut').forEach(x=>x.style.display='none');return out};f.__rdV1=true;window.renderStock=f}
    if(typeof window.renderRegistry==='function'&&!window.renderRegistry.__rdV1){baseRenderRegistry=window.renderRegistry;const f=function(){const out=baseRenderRegistry.apply(this,arguments);decorateRegistryReadonly();return out};f.__rdV1=true;window.renderRegistry=f}
    if(typeof window.openRequestDetail==='function'&&!window.openRequestDetail.__rdV1){baseOpenRequestDetail=window.openRequestDetail;const f=function(){const out=baseOpenRequestDetail.apply(this,arguments);setTimeout(decorateRequestDetailReadonly,0);return out};f.__rdV1=true;window.openRequestDetail=f}
    if(typeof window.renderRequestDetail==='function'&&!window.renderRequestDetail.__rdV1){baseRenderRequestDetail=window.renderRequestDetail;const f=function(){const out=baseRenderRequestDetail.apply(this,arguments);setTimeout(decorateRequestDetailReadonly,0);return out};f.__rdV1=true;window.renderRequestDetail=f}
    installPermissionGuards();
  }

  function syncAuthState(){
    ensureLanding();ensureTopbar();ensureDashboard();ensureAuxScreens();
    if(!logged()){
      document.body.classList.remove('rdReadOnly');
      if(document.querySelector('.screen.on')?.id!=='accessLandingV1')show('accessLandingV1');
      return;
    }
    document.body.classList.toggle('rdReadOnly',isReadonly());
    if(document.querySelector('.screen.on')?.id==='accessLandingV1')show('home');
    const u=$('userBtn');if(u){u.textContent=user();u.title=`${user()} · ${profile().label}`}
    renderDashboard();syncViewIcons();
  }

  window.openMasterDetailsV1=function(){
    const d=ensureMasterDialog(),m=masterState(),body=$('rdMasterDialogBody');
    body.innerHTML=`<div class="rdMasterInfoGrid"><div class="rdInfoCell"><span>File</span><b>${html(m.file)}</b></div><div class="rdInfoCell"><span>Righe</span><b>${m.count.toLocaleString('it-IT')}</b></div><div class="rdInfoCell"><span>Ultimo aggiornamento</span><b>${m.at?html(fmt(m.at)):'—'}</b></div><div class="rdInfoCell"><span>Stato export</span><b>${m.dirty?`${m.dirty} modifiche in attesa`:'Aggiornato'}</b></div></div>${can('MASTER')?'<div class="rdDialogActions"><button class="primary" onclick="triggerMasterImportV1()">SOSTITUISCI / REIMPORTA</button><button class="success" onclick="exportMasterV1()">ESPORTA AGGIORNATO</button><button class="danger full" onclick="removeMasterV1()">RIMUOVI MASTER</button></div>':''}`;d.showModal();
  };
  window.triggerMasterImportV1=function(){if(!can('MASTER'))return deny('Importazione Master');$('rdMasterDialog')?.close();$('masterInput')?.click()};
  window.exportMasterV1=function(){if(!can('MASTER'))return deny('Esportazione Master');$('rdMasterDialog')?.close();window.LocalMaster?.exportUpdatedMaster?.()};
  window.removeMasterV1=function(){if(!can('MASTER'))return deny('Rimozione Master');$('rdMasterDialog')?.close();window.openDeleteMasterDialog?.()};

  window.openRoleRequestNewV1=function(){if(!can('REQUEST_CREATE'))return deny('Nuova richiesta');if(typeof window.newRequest==='function')window.newRequest();else show('requestNew');setTimeout(()=>{const b=$('requestNew')?.querySelector(':scope>.back');if(b){b.textContent='← HOME';b.onclick=()=>show('home')}},0)};
  window.openRoleRequestProgressV1=function(){if(!can('REQUEST_VIEW'))return deny('Richieste');renderRequestProgress();show('rdRequestProgressV1')};
  window.openRoleRequestCompletionV1=function(){if(!can('REQUEST_VIEW'))return deny('Completamento richieste');renderRequestCompletion();show('rdRequestCompletionV1')};
  window.openRoleRequestDetailV1=function(id){const req=(safeDb().requests||[]).find(r=>r.id===id);if(!req||!requestVisibleToCurrent(req))return deny('Richiesta');window.openRequestDetail?.(id);setTimeout(decorateRequestDetailReadonly,0)};

  window.openRoleRegistryMovementsV1=function(){if(!can('REGISTRY_VIEW'))return deny('Registro movimenti');if(baseOpenRegistry)baseOpenRegistry.call(window);else window.openRegistry?.();setTimeout(()=>{const s=$('registryScreen');if(!s)return;const h=s.querySelector('h1');if(h)h.textContent='Movimenti';const b=s.querySelector(':scope>.back');if(b){b.textContent='← HOME';b.onclick=()=>show('home')}s.querySelector('.tabs')?.style.setProperty('display','none');decorateRegistryReadonly()},0)};
  window.openRoleAuditV1=function(){if(!can('AUDIT_VIEW'))return deny('Audit');renderAudit();show('rdAuditV1')};
  window.renderRoleAuditV1=renderAudit;
  window.exportRoleMovementsV1=function(){
    if(!can('EXPORT'))return deny('Esporta movimenti');const d=safeDb(),rows=[];
    for(const m of (d.movements||[]))rows.push({Tipo:m.movement_type||'MOVIMENTO',Data:fmt(m.operation_at||m.registered_at),Operatore:m.operator||'',Articolo:m.article_base||'',Taglia:m.size||'',Stato:m.state||'',Quantità:m.quantity||0,Origine:`${typeof locationOf==='function'?locationOf(m):m.fila_scaffale||''} ${m.bancale||''}`.trim(),Destinazione:m.destination||'',Riferimento:m.document_id||'',Note:m.note||''});
    for(const t of (d.stock_transfers||[]))for(const l of (t.lines||[]))rows.push({Tipo:'SPOSTA',Data:fmt(t.created_at),Operatore:t.operator||'',Articolo:l.article_base||'',Taglia:l.size||'',Stato:l.state||'',Quantità:l.quantity||0,Origine:`${l.from?.fila_scaffale||''} ${l.from?.bancale||''}`.trim(),Destinazione:`${l.to?.fila_scaffale||''} ${l.to?.bancale||''}`.trim(),Riferimento:t.id||'',Note:''});
    for(const r of (d.rectifications||[]).filter(x=>!x.cancelled_at&&x.semantic_type!=='SPOSTA'))rows.push({Tipo:r.semantic_type||'RETTIFICA',Data:fmt(r.operation_at||r.registered_at),Operatore:r.operator||'',Articolo:r.after?.article_base||r.before?.article_base||'',Taglia:r.after?.size||r.before?.size||'',Stato:r.after?.state||r.before?.state||'',Quantità:r.after?.quantity??r.before?.quantity??0,Origine:r.before?`${r.before.fila_scaffale||''} ${r.before.bancale||''}`.trim():'',Destinazione:r.after?`${r.after.fila_scaffale||''} ${r.after.bancale||''}`.trim():'',Riferimento:r.id||'',Note:r.note||''});
    if(!rows.length)return alert('Nessun movimento da esportare.');if(typeof downloadExcel==='function')downloadExcel(`Movimenti_${new Date().toISOString().slice(0,10)}.xls`,rows);else alert('Esportazione non disponibile.');
  };

  window.WarehouseRoleDashboardV1={version:VERSION,PROFILES,profile,can,deny,renderDashboard,renderRequestProgress,renderRequestCompletion,renderAudit,syncAuthState,syncViewIcons,install};

  function install(){
    if(installed)return true;installed=true;ensureCss();ensureLanding();ensureTopbar();ensureDashboard();ensureAuxScreens();installWrappers();
    syncAuthState();
    if(!refreshTimer)refreshTimer=setInterval(()=>{if(logged()&&document.querySelector('.screen.on')?.id==='home')renderDashboard();syncViewIcons()},1500);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncAuthState();renderDashboard()}});
    return true;
  }
  install();
})();
