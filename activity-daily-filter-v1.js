/* Daily activity summary filter for Role Dashboard V1.
   Keeps warehouse engines untouched: this layer only recalculates the existing activity card
   for one selected local calendar day. Default is always today on a fresh app load. */
(function installWarehouseActivityDailyFilterV1(){
  'use strict';
  if(window.WarehouseActivityDailyFilterV1)return;

  const VERSION='2026.08.28-activity-daily-filter1';
  const $=id=>document.getElementById(id);
  const txt=v=>String(v??'');
  const norm=v=>txt(v).trim().toUpperCase();
  const h=v=>typeof esc==='function'?esc(v):txt(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let installed=false,rootObserver=null,scheduled=false,baseRender=null,selectedDate='',explicitDate=false;

  function safeDb(){try{return typeof db!=='undefined'&&db?db:{}}catch{return {}}}
  function actor(){try{return currentUser||''}catch{return ''}}
  function isLina(){return actor()==='Lina'}
  function pad(n){return String(n).padStart(2,'0')}
  function keyFromDate(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
  function todayKey(){return keyFromDate(new Date())}
  function dateKey(v){
    if(!v)return '';
    if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
    const d=v instanceof Date?v:new Date(v);return Number.isNaN(d.getTime())?'':keyFromDate(d);
  }
  function activeKey(){
    if(!explicitDate)selectedDate=todayKey();
    if(!selectedDate)selectedDate=todayKey();
    return selectedDate;
  }
  function sameDay(v,key=activeKey()){return !!v&&dateKey(v)===key}
  function labelDate(key){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(key||'');return m?`${m[3]}/${m[2]}/${m[1]}`:'—'}
  function fmt(v){try{return typeof fmtDateTime==='function'?fmtDateTime(v):new Date(v).toLocaleString('it-IT')}catch{return '—'}}
  function visibleRequest(r){if(!isLina())return true;return norm(r?.operator)==='LINA'||norm(r?.destination)==='LINA'}
  function requestCreatedAt(r){return r?.requested_at||r?.created_at||r?.registered_at||r?.received_at||r?.at||''}
  function completionAt(r,audits){
    const direct=r?.completion?.closed_at||r?.completed_at||r?.closed_at||'';
    if(direct)return direct;
    const id=txt(r?.id);
    if(!id)return '';
    const row=(audits||[]).filter(a=>txt(a?.entityId)===id&&norm(a?.entityType)==='REQUEST'&&['COMPLETE','COMPLETATA','COMPLETA'].includes(norm(a?.action))).sort((a,b)=>new Date(b?.at||0)-new Date(a?.at||0))[0];
    return row?.at||'';
  }
  function icon(name,fallback){try{return window.WarehousePremiumDashboardV2?.svg?.(name)||fallback}catch{return fallback}}
  function calendarSvg(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>'}

  function stats(key=activeKey()){
    const d=safeDb(),moves=Array.isArray(d.movements)?d.movements:[],trans=Array.isArray(d.stock_transfers)?d.stock_transfers:[],reqs=Array.isArray(d.requests)?d.requests:[],audits=Array.isArray(d.audits)?d.audits:[];
    const car=moves.filter(m=>!m?.cancelled_at&&norm(m?.movement_type)==='CARICA'&&sameDay(m?.operation_at||m?.registered_at,key)).length;
    const scar=moves.filter(m=>!m?.cancelled_at&&norm(m?.movement_type)==='SCARICA'&&sameDay(m?.operation_at||m?.registered_at,key)).length;
    const sp=trans.filter(t=>!t?.cancelled_at&&sameDay(t?.created_at||t?.operation_at||t?.registered_at,key)).length;
    const visible=reqs.filter(visibleRequest);
    const received=visible.filter(r=>sameDay(requestCreatedAt(r),key)).length;
    const complete=visible.filter(r=>sameDay(completionAt(r,audits),key)).length;
    const dayAudits=audits.filter(a=>sameDay(a?.at,key));
    const latest=[...dayAudits].sort((a,b)=>new Date(b?.at||0)-new Date(a?.at||0))[0]?.at||'';
    return {car,scar,sp,received,complete,latest};
  }

  function injectCss(){
    if($('activityDailyFilterV1Css'))return;
    const s=document.createElement('style');s.id='activityDailyFilterV1Css';s.textContent=`
      #rdDashboardV1 .rdActivityHeadV1{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 0 8px}
      #rdDashboardV1 .rdActivityHeadV1 .rdActivityTitle{margin:0}
      #rdDashboardV1 .rdActivityDayV1{margin-top:4px;color:#17314d;font-size:13px;font-weight:900;letter-spacing:.01em}
      #rdDashboardV1 .rdActivityDayV1 strong{color:#2c60aa;font-size:10px;letter-spacing:.08em;margin-right:6px}
      #rdDashboardV1 .rdActivityControlsV1{display:flex;align-items:center;gap:7px;flex:0 0 auto}
      #rdDashboardV1 .rdActivityTodayV1{height:38px;padding:0 12px;border:1px solid #d7e4ee;border-radius:12px;background:#f4f8fb;color:#2c60aa;font-size:10px;font-weight:950;letter-spacing:.04em}
      #rdDashboardV1 .rdActivityCalendarV1{position:relative;width:42px;height:42px;border:1px solid #cfe0ec;border-radius:13px;background:linear-gradient(145deg,#eef6fb,#e4f0f7);color:#2c60aa;display:grid;place-items:center;box-shadow:0 4px 12px #17314d0d;overflow:hidden;cursor:pointer}
      #rdDashboardV1 .rdActivityCalendarV1 svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
      #rdDashboardV1 .rdActivityCalendarV1 input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0;margin:0}
      #rdDashboardV1 .rdActivityCalendarV1 input::-webkit-calendar-picker-indicator{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
      #rdDashboardV1 .rdActivityCalendarV1:active,#rdDashboardV1 .rdActivityTodayV1:active{transform:scale(.97)}
      @media(max-width:899px){#rdDashboardV1 .rdActivityHeadV1{padding:2px 2px 7px;border-bottom:1px solid #e2e9ef;margin-bottom:0}#rdDashboardV1 .rdActivityDayV1{font-size:12px}#rdDashboardV1 .rdActivityCalendarV1{width:40px;height:40px}}
      @media(max-width:430px){#rdDashboardV1 .rdActivityTodayV1{height:36px;padding:0 9px;font-size:9px}#rdDashboardV1 .rdActivityDayV1 strong{display:block;margin:0 0 2px}}
    `;document.head.appendChild(s);
  }

  function decorate(){
    injectCss();
    const card=document.querySelector('#rdDashboardV1>.rdActivity');if(!card)return false;
    const key=activeKey(),isToday=key===todayKey(),s=stats(key);
    const items=isLina()?[
      [s.received,'Richieste ricevute','requests','▥'],[s.complete,'Richieste completate','check','✓'],[s.latest?fmt(s.latest):'—','Ultima attività','clock','◷']
    ]:[
      [s.car,'Carichi','truck','↑'],[s.scar,'Scarichi','truck','↓'],[s.sp,'Spostamenti','swap','↔'],[s.received,'Richieste ricevute','requests','▥'],[s.complete,'Richieste completate','check','✓'],[s.latest?fmt(s.latest):'—','Ultima attività','clock','◷']
    ];
    card.innerHTML=`<div class="rdActivityHeadV1"><div><div class="rdActivityTitle">RIEPILOGO ATTIVITÀ</div><div class="rdActivityDayV1">${isToday?'<strong>OGGI</strong>':''}${h(labelDate(key))}</div></div><div class="rdActivityControlsV1">${isToday?'':`<button type="button" class="rdActivityTodayV1" onclick="resetRoleActivityDateV1()">OGGI</button>`}<label class="rdActivityCalendarV1" title="Scegli giorno" aria-label="Scegli giorno">${calendarSvg()}<input id="rdActivityDateV1" type="date" value="${h(key)}" max="${h(todayKey())}" onchange="setRoleActivityDateV1(this.value)" aria-label="Data riepilogo attività"></label></div></div><div class="rdActivityGrid">${items.map(([value,label,ico,fallback])=>`<div class="rdActivityItem"><div class="rdActivityDot">${icon(ico,fallback)}</div><div><b>${h(value)}</b><span>${h(label)}</span></div></div>`).join('')}</div>`;
    return true;
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate()})}
  function observeRoot(){
    const root=$('rdDashboardV1');if(!root||rootObserver)return !!root;
    rootObserver=new MutationObserver(mutations=>{if(mutations.some(m=>m.target===root&&m.type==='childList'))schedule()});
    rootObserver.observe(root,{childList:true});return true;
  }
  function wrapRender(){
    const api=window.WarehouseRoleDashboardV1,fn=api?.renderDashboard;if(typeof fn!=='function'||fn.__activityDailyFilterV1)return;
    baseRender=fn;const wrapped=function(){const out=baseRender.apply(this,arguments);schedule();return out};wrapped.__activityDailyFilterV1=true;wrapped.__previous=fn;api.renderDashboard=wrapped;
  }

  window.setRoleActivityDateV1=function(value){
    const key=/^\d{4}-\d{2}-\d{2}$/.test(txt(value))?txt(value):todayKey();
    selectedDate=key;explicitDate=key!==todayKey();decorate();
  };
  window.resetRoleActivityDateV1=function(){selectedDate=todayKey();explicitDate=false;decorate()};

  function install(){
    if(installed){observeRoot();decorate();return true}
    installed=true;injectCss();wrapRender();observeRoot();decorate();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!explicitDate)decorate()});
    window.addEventListener('pageshow',()=>{if(!explicitDate)decorate()});
    return true;
  }

  window.WarehouseActivityDailyFilterV1={version:VERSION,install,decorate,stats,getDate:activeKey,setDate:window.setRoleActivityDateV1,reset:window.resetRoleActivityDateV1};
  install();
})();