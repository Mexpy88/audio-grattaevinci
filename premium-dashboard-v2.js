/* Premium Dashboard V2
   Professional SVG iconography, visible brand background, inbox notifications,
   Lina digital request composer, and paper-scan workflow naming for warehouse operators.
*/
(function installWarehousePremiumDashboardV2(){
  'use strict';
  if(window.WarehousePremiumDashboardV2)return;
  const VERSION='2026.08.27-premium-dashboard2';
  const $=id=>document.getElementById(id);
  const txt=v=>String(v??'');
  const norm=v=>txt(v).trim().toUpperCase();
  const h=v=>typeof esc==='function'?esc(v):txt(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const actor=()=>{try{return currentUser||''}catch{return ''}};
  const now=()=>new Date().toISOString();
  const can=cap=>window.WarehouseRoleDashboardV1?.can?.(cap)??false;
  const isLina=()=>actor()==='Lina';
  let installed=false,observer=null,scheduled=false,baseOpenNew=null;
  let linaSelected=new Map();

  const PATHS={
    monitor:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    phone:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    inbox:'<path d="M4 4h16v12H15l-2 3h-2l-2-3H4z"/><path d="M4 12h5l1.5 2h3L15 12h5"/>',
    move:'<path d="M5 12h14M8 9l-3 3 3 3M16 9l3 3-3 3"/>',
    search:'<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
    requests:'<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6"/><path d="m9 16 1.5 1.5L14 14"/>',
    history:'<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8"/><path d="M4 4v4h4M12 8v5l3 2"/>',
    up:'<path d="M12 19V5M7 10l5-5 5 5"/>',
    down:'<path d="M12 5v14M7 14l5 5 5-5"/>',
    swap:'<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    pencil:'<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10z"/><path d="m13.5 7 3.5 3.5"/>',
    clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/>',
    filePlus:'<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M12 11v6M9 14h6"/>',
    bars:'<path d="M5 20v-7M12 20V5M19 20v-11"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    shield:'<path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6z"/><path d="M9 12h6M12 9v6"/>',
    download:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>',
    truck:'<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bell:'<path d="M6 9a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 20h4"/>',
    excel:'<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 10l5 6M13 10l-5 6"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>'
  };
  function svg(name){return `<svg class="rdSvg" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]||PATHS.chevron}</svg>`}

  function ensureCss(){if($('premiumDashboardV2Css'))return;const l=document.createElement('link');l.id='premiumDashboardV2Css';l.rel='stylesheet';l.href='premium-dashboard-v2.css?v=20260827-premium2';document.head.appendChild(l)}

  function ensureBackground(){
    if($('rdPremiumBgV2'))return;
    const d=document.createElement('div');d.id='rdPremiumBgV2';d.setAttribute('aria-hidden','true');
    d.innerHTML=`<svg viewBox="0 0 1600 900" preserveAspectRatio="none"><defs><linearGradient id="pvb" x1="0" x2="1"><stop offset="0" stop-color="#2c60aa"/><stop offset="1" stop-color="#55aee0"/></linearGradient><linearGradient id="pvg" x1="0" x2="1"><stop offset="0" stop-color="#1b9b73"/><stop offset="1" stop-color="#62c5a4"/></linearGradient></defs><path d="M-90 710 C180 480 330 805 620 585 S1110 400 1690 690" fill="none" stroke="url(#pvb)" stroke-width="4" opacity=".055"/><path d="M-100 765 C210 535 355 835 650 635 S1130 470 1700 750" fill="none" stroke="url(#pvg)" stroke-width="3" opacity=".042"/><path d="M1250 -80 C1100 170 1510 235 1320 510 S1420 810 1680 860" fill="none" stroke="#2c60aa" stroke-width="76" opacity=".022"/><path d="M-150 100 C140 10 135 320 410 215 S750 80 940 215" fill="none" stroke="#1b9b73" stroke-width="44" opacity=".018"/></svg>`;
    document.body.insertBefore(d,document.body.firstChild);
  }

  function actionIcon(label){
    const t=norm(label);
    if(t==='CARICA')return'up';if(t==='SCARICA')return'down';if(t==='SPOSTA')return'swap';if(t==='CERCA')return'search';if(t==='RETTIFICA')return'pencil';if(t.includes('CONTEGGIO'))return'clipboard';if(t.includes('SCANSIONA')||t.includes('NUOVA RICHIESTA'))return'filePlus';if(t==='AVANZAMENTO')return'bars';if(t==='COMPLETAMENTO')return'check';if(t==='MOVIMENTI')return'list';if(t==='AUDIT')return'shield';if(t.includes('ESPORTA'))return'download';return'chevron';
  }
  function moduleIcon(cls){if(cls.contains('move'))return'move';if(cls.contains('stock'))return'search';if(cls.contains('requests'))return'requests';return'history'}

  function decorateDashboard(){
    const root=$('rdDashboardV1');if(!root)return;
    root.querySelectorAll('.rdModule').forEach(m=>{const icon=m.querySelector('.rdModuleIcon');if(icon)icon.innerHTML=svg(moduleIcon(m.classList))});
    root.querySelectorAll('.rdAction').forEach(a=>{const b=a.querySelector('b'),icon=a.querySelector('.rdActionIcon'),arrow=a.querySelector('.rdActionArrow');if(!b)return;if(!isLina()&&norm(b.textContent)==='NUOVA RICHIESTA')b.textContent='SCANSIONA RICHIESTA';if(icon)icon.innerHTML=svg(actionIcon(b.textContent));if(arrow)arrow.innerHTML=svg('chevron')});
    const excel=root.querySelector('.rdExcelIcon');if(excel)excel.innerHTML=svg('excel');
    const activity=[...root.querySelectorAll('.rdActivityItem')];activity.forEach((x,i)=>{const dot=x.querySelector('.rdActivityDot');if(!dot)return;const label=norm(x.querySelector('span')?.textContent);let name='clock';if(label.includes('CARICHI'))name='truck';else if(label.includes('SCARICHI'))name='truck';else if(label.includes('SPOSTAMENTI'))name='swap';else if(label.includes('APERTE'))name='requests';else if(label.includes('COMPLETATE'))name='check';dot.innerHTML=svg(name)});
    if(!root.querySelector('.rdFooterPremiumV2'))root.insertAdjacentHTML('beforeend','<footer class="rdFooterPremiumV2">© 2026 Servizi Ospedalieri – Gestione Magazzino</footer>');
  }

  function decorateViewIcons(){const d=$('rdDesktopViewV1'),p=$('rdPhoneViewV1');if(d)d.innerHTML=svg('monitor');if(p)p.innerHTML=svg('phone')}

  function notifications(){const d=typeof db!=='undefined'?db:null;if(!d)return[];if(!Array.isArray(d.notifications))d.notifications=[];return d.notifications}
  function unreadForMe(){const me=actor();return notifications().filter(n=>n.recipient===me&&!n.read_at)}
  function notificationRows(){const me=actor();return notifications().filter(n=>n.recipient===me).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,50)}

  function ensureInbox(){
    const auth=document.querySelector('.topbar .authArea');if(!auth)return false;
    let wrap=$('rdInboxWrapV2');if(!wrap){wrap=document.createElement('div');wrap.id='rdInboxWrapV2';wrap.className='rdInboxWrap';wrap.innerHTML=`<button id="rdInboxBtnV2" type="button" aria-label="Notifiche" title="Notifiche">${svg('inbox')}<span id="rdInboxBadgeV2" class="rdInboxBadge hidden"></span></button><div id="rdInboxPanelV2"></div>`;const views=$('rdViewIconsV1');if(views)views.insertAdjacentElement('afterend',wrap);else auth.insertBefore(wrap,auth.firstChild);$('rdInboxBtnV2').addEventListener('click',e=>{e.stopPropagation();toggleInbox()})}
    wrap.style.display=actor()&&actor()!=='Lina'?'flex':'none';renderInbox();return true;
  }
  function toggleInbox(force){const p=$('rdInboxPanelV2'),b=$('rdInboxBtnV2');if(!p)return;const open=force===undefined?!p.classList.contains('open'):!!force;p.classList.toggle('open',open);b?.classList.toggle('active',open);if(open)renderInbox()}
  function renderInbox(){
    const badge=$('rdInboxBadgeV2'),panel=$('rdInboxPanelV2');if(!badge||!panel)return;
    const unread=unreadForMe().length;badge.textContent=unread>99?'99+':String(unread);badge.classList.toggle('hidden',!unread);
    const rows=notificationRows();panel.innerHTML=`<div class="rdInboxHead"><b>NOTIFICHE</b>${unread?'<button class="rdInboxClear" type="button" onclick="markAllNotificationsReadV2()">SEGNA LETTE</button>':''}</div>${rows.length?rows.map(n=>`<button type="button" class="rdNotification ${n.read_at?'':'unread'}" onclick="openRoleNotificationV2('${h(n.id)}')"><span class="rdNotifIcon">${svg('requests')}</span><span class="rdNotifText"><b>${h(n.title||'Richiesta di prelievo')}</b><span>${h(n.from||'—')} · ${h(formatNotificationTimeV2(n.created_at))}</span></span>${n.read_at?'':'<i class="rdNotifDot"></i>'}</button>`).join(''):'<div class="rdNotifEmpty">Nessuna notifica.</div>'}`;
  }
  window.formatNotificationTimeV2=function(v){if(!v)return'—';try{return new Date(v).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return'—'}};
  window.markAllNotificationsReadV2=function(){const at=now(),me=actor();notifications().forEach(n=>{if(n.recipient===me&&!n.read_at)n.read_at=at});saveDb?.();renderInbox()};
  window.openRoleNotificationV2=function(id){
    const n=notifications().find(x=>x.id===id&&x.recipient===actor());if(!n)return; if(!n.read_at){n.read_at=now();saveDb?.()}renderInbox();toggleInbox(false);
    const req=(db.requests||[]).find(r=>r.id===n.request_id);if(!req)return alert('La richiesta collegata non è più disponibile.');
    if(can('REQUEST_PROCESS')&&req.source==='DIGITALE_LINA'&&req.status==='DA PREPARARE'){
      const before={status:req.status,assigned_to:req.assigned_to||null};req.status='IN PRELIEVO';req.assigned_to=actor();req.started_at=now();audit?.('START','REQUEST',req.id,before,{status:req.status,assigned_to:req.assigned_to,started_at:req.started_at});saveDb?.();
    }
    window.__rdRequestReturnV1='progress';window.openRoleRequestDetailV1?.(req.id);window.WarehouseRoleDashboardV1?.renderDashboard?.();
  };

  function aggregateStock(query){
    const q=norm(query);if(!q)return[];const map=new Map();let rows=[];try{rows=stockBuckets()}catch{return[]}
    for(const r of rows){const a=norm(r.article_base),s=norm(r.size);if(!(a.includes(q)||s.includes(q)))continue;const key=a+'|'+s;if(!map.has(key))map.set(key,{key,article_base:a,size:s,quantity:0,states:new Set(),positions:new Set()});const x=map.get(key);x.quantity+=Number(r.quantity||0);if(r.state)x.states.add(norm(r.state));const loc=[typeof locationOf==='function'?locationOf(r):(r.fila_scaffale||''),r.bancale||''].filter(Boolean).join(' / ');if(loc)x.positions.add(loc)}
    return [...map.values()].sort((a,b)=>(a.article_base+a.size).localeCompare(b.article_base+b.size)).slice(0,50)
  }

  function ensureLinaScreens(){
    const main=document.querySelector('main');if(!main)return false;
    if(!$('linaDigitalRequestV2')){const s=document.createElement('section');s.id='linaDigitalRequestV2';s.className='screen';s.innerHTML=`<button class="back" onclick="show('home')">← HOME</button><div class="eyebrow">RICHIESTE</div><h1>Nuova richiesta</h1><div class="linaRequestSearchShell"><div class="linaSearchField">${svg('search')}<input id="linaRequestSearchV2" class="field" autocomplete="off" placeholder="Cerca codice articolo o taglia" oninput="renderLinaRequestResultsV2()"></div><div id="linaRequestResultsV2" class="linaResults"></div><div class="linaSelectedBar"><span><b id="linaSelectedCountV2">0</b> varianti selezionate</span><button id="linaSaveRequestV2" class="linaSaveBtn" type="button" onclick="openLinaRequestReviewV2()" disabled>SALVA</button></div></div>`;main.appendChild(s)}
    if(!$('linaDigitalReviewV2')){const s=document.createElement('section');s.id='linaDigitalReviewV2';s.className='screen';s.innerHTML=`<button class="back" onclick="show('linaDigitalRequestV2')">← MODIFICA</button><div class="eyebrow">RIEPILOGO</div><h1>Richiesta di prelievo</h1><div class="rdCleanCard"><div id="linaReviewListV2" class="linaReviewList"></div><div class="linaReviewActions"><button class="linaCancel" type="button" onclick="cancelLinaDigitalRequestV2()">ANNULLA</button><button class="linaModify" type="button" onclick="show('linaDigitalRequestV2')">MODIFICA</button><button class="linaTransmit" type="button" onclick="transmitLinaDigitalRequestV2()">TRASMETTI</button></div></div>`;main.appendChild(s)}
    return true;
  }

  function selectedArray(){return [...linaSelected.values()].filter(x=>Number(x.cartons)>0).sort((a,b)=>(a.article_base+a.size).localeCompare(b.article_base+b.size))}
  function refreshSelectedBar(){const a=selectedArray();if($('linaSelectedCountV2'))$('linaSelectedCountV2').textContent=String(a.length);if($('linaSaveRequestV2'))$('linaSaveRequestV2').disabled=!a.length}
  window.renderLinaRequestResultsV2=function(){
    const host=$('linaRequestResultsV2'),q=$('linaRequestSearchV2')?.value||'';if(!host)return;const rows=aggregateStock(q);
    if(!q.trim()){host.innerHTML='<div class="linaEmpty">Digita un codice articolo.</div>';refreshSelectedBar();return}
    host.innerHTML=rows.length?rows.map(r=>{const sel=linaSelected.get(r.key),enc=encodeURIComponent(r.key);return `<div class="linaResult ${sel?'selected':''}"><input class="linaCheck" type="checkbox" ${sel?'checked':''} onchange="toggleLinaVariantV2('${enc}',this.checked)"><div class="linaSku"><b>${h(r.article_base)}${r.size?` · ${h(r.size)}`:''}</b><span>${Math.floor(r.quantity)} pezzi disponibili · ${r.positions.size} ${r.positions.size===1?'posizione':'posizioni'}${r.states.size?` · ${h([...r.states].join(', '))}`:''}</span></div><div class="linaCartons"><label>CARTONI<input type="number" min="1" step="1" value="${sel?.cartons||1}" onchange="setLinaCartonsV2('${enc}',this.value)"></label></div></div>`}).join(''):'<div class="linaEmpty">Nessun articolo trovato.</div>';refreshSelectedBar();
  };
  window.toggleLinaVariantV2=function(enc,checked){const key=decodeURIComponent(enc),q=$('linaRequestSearchV2')?.value||'',row=aggregateStock(q).find(x=>x.key===key);if(checked&&row)linaSelected.set(key,{article_base:row.article_base,size:row.size,cartons:linaSelected.get(key)?.cartons||1,available:Math.floor(row.quantity)});else linaSelected.delete(key);window.renderLinaRequestResultsV2()};
  window.setLinaCartonsV2=function(enc,v){const key=decodeURIComponent(enc),x=linaSelected.get(key);if(!x)return;x.cartons=Math.max(1,Math.floor(Number(v)||1));refreshSelectedBar()};
  window.openLinaRequestReviewV2=function(){const arr=selectedArray();if(!arr.length)return alert('Seleziona almeno un articolo/taglia.');const list=$('linaReviewListV2');list.innerHTML=arr.map(x=>`<div class="linaReviewRow"><div><b>${h(x.article_base)}${x.size?` · ${h(x.size)}`:''}</b><span>${x.available} pezzi disponibili</span></div><span class="linaReviewQty">${x.cartons} ${x.cartons===1?'cartone':'cartoni'}</span></div>`).join('');show('linaDigitalReviewV2')};
  window.cancelLinaDigitalRequestV2=function(){if(!confirm('Annullare questa richiesta?'))return;linaSelected.clear();if($('linaRequestSearchV2'))$('linaRequestSearchV2').value='';show('home');window.WarehouseRoleDashboardV1?.renderDashboard?.()};

  function createRequestNotifications(req){const recipients=['Mattia','Massimo','Alessandra','Luca'],at=now();for(const recipient of recipients)notifications().unshift({id:typeof uid==='function'?uid():`${Date.now()}-${Math.random()}`,type:'REQUEST_TRANSMITTED',request_id:req.id,from:'Lina',recipient,title:'Richiesta di prelievo · Lina',created_at:at,read_at:null})}
  window.transmitLinaDigitalRequestV2=function(){
    if(!isLina()||!can('REQUEST_CREATE'))return window.WarehouseRoleDashboardV1?.deny?.('Trasmissione richiesta');const arr=selectedArray();if(!arr.length)return alert('La richiesta è vuota.');
    const at=now(),lines=arr.map(x=>({article_base:x.article_base,size:x.size,quantity:x.cartons,cartons:x.cartons,marker:'',note:''}));const req={id:nextRequestId(),destination:'LINA',requested_at:at,created_at:at,transmitted_at:at,operator:'Lina',reference:'',source:'DIGITALE_LINA',quantity_unit:'CARTONI',request_schema:2,lines,status:'DA PREPARARE',deliveries:[],draft:{allocations:[],extraAllocations:[],note:''},recipients:['Mattia','Massimo','Alessandra','Luca']};
    db.requests.unshift(req);createRequestNotifications(req);audit?.('CREATE','REQUEST',req.id,null,req);audit?.('TRANSMIT','REQUEST',req.id,null,{from:'Lina',recipients:req.recipients,lines:req.lines.length,cartons:lines.reduce((n,x)=>n+x.cartons,0)});saveDb?.();
    linaSelected.clear();const review=$('linaDigitalReviewV2');review.innerHTML=`<button class="back" onclick="show('home')">← HOME</button><div class="eyebrow">RICHIESTA TRASMESSA</div><h1>${h(req.id)}</h1><div class="rdTransmitSuccess">${svg('check')}<b>Richiesta trasmessa</b><span>Mattia, Massimo, Alessandra e Luca hanno una nuova notifica.</span></div><button class="btn primary" type="button" onclick="openRoleRequestProgressV1()">LE MIE RICHIESTE</button>`;show('linaDigitalReviewV2');renderInbox();window.WarehouseRoleDashboardV1?.renderDashboard?.();
  };

  function openLinaBuilder(){ensureLinaScreens();linaSelected.clear();$('linaRequestSearchV2').value='';window.renderLinaRequestResultsV2();show('linaDigitalRequestV2');setTimeout(()=>$('linaRequestSearchV2')?.focus(),40)}
  function patchNewRequestRoute(){
    if(baseOpenNew)return;const base=window.openRoleRequestNewV1;if(typeof base!=='function')return;baseOpenNew=base;
    window.openRoleRequestNewV1=function(){if(isLina())return openLinaBuilder();const out=baseOpenNew.apply(this,arguments);document.body.classList.add('rdScanRequestMode');setTimeout(()=>{const s=$('requestNew');if(!s)return;const e=s.querySelector('.eyebrow'),title=s.querySelector('h1');if(e)e.textContent='SCANSIONA RICHIESTA';if(title)title.textContent='Acquisisci richiesta cartacea';const back=s.querySelector(':scope>.back');if(back){back.textContent='← HOME';back.onclick=()=>show('home')}},0);return out};
  }

  function sync(){ensureBackground();ensureInbox();ensureLinaScreens();decorateViewIcons();decorateDashboard();patchNewRequestRoute();renderInbox()}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;sync()})}
  function install(){if(installed)return true;installed=true;ensureCss();ensureBackground();ensureLinaScreens();patchNewRequestRoute();sync();observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});document.addEventListener('click',e=>{if(!$('rdInboxWrapV2')?.contains(e.target))toggleInbox(false)});document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});setInterval(()=>{ensureInbox();renderInbox()},1200);return true}

  window.WarehousePremiumDashboardV2={version:VERSION,install,sync,svg,renderInbox,openLinaBuilder};install();
})();
