/* Request Floating Confirm V1
   Mobile-only confirmation entry point for request picking.
   Keeps the existing picking/completion engines authoritative.
*/
(function installRequestFloatingConfirmV1(){
  'use strict';
  if(window.WarehouseRequestFloatingConfirmV1)return;

  const VERSION='2026.08.27-request-floating-confirm1';
  const $=id=>document.getElementById(id);
  const txt=v=>String(v??'');
  const h=v=>typeof esc==='function'?esc(v):txt(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const num=v=>Math.max(0,Math.floor(Number(v)||0));
  const canProcess=()=>window.WarehouseRoleDashboardV1?.can?.('REQUEST_PROCESS')??true;
  const mobile=()=>window.matchMedia?.('(max-width:899px)')?.matches??(innerWidth<900);
  let installed=false,observer=null,timer=null;

  function request(){
    try{return (db?.requests||[]).find(r=>r.id===activeRequestId)||null}catch{return null}
  }
  function isCartonRequest(req){return window.RequestCartons?.isCartonRequest?.(req)??!!(req&&(req.quantity_unit==='CARTONI'||Number(req.request_schema||0)>=2))}
  function selectedDraft(req){
    const rows=[...(req?.draft?.allocations||[]),...(req?.draft?.extraAllocations||[])];
    return rows.filter(a=>!!a?.checked&&(num(a?.cartons)>0||num(a?.quantity)>0)&&!a?.missing);
  }
  function summary(req){
    const rows=selectedDraft(req),cartons=rows.reduce((n,a)=>n+num(a.cartons),0),pieces=rows.reduce((n,a)=>n+num(a.quantity),0),keys=new Set(rows.map(a=>`${txt(a.article_base).trim().toUpperCase()}|${txt(a.size).trim().toUpperCase()}`));
    return {rows,cartons,pieces,articles:keys.size};
  }

  function ensureCss(){
    if($('requestFloatingConfirmV1Css'))return;
    const l=document.createElement('link');l.id='requestFloatingConfirmV1Css';l.rel='stylesheet';l.href='request-floating-confirm-v1.css?v=20260827-rf1';document.head.appendChild(l);
  }
  function checkSvg(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg>'}

  function ensureUi(){
    if(!$('requestFloatConfirmV1')){
      const b=document.createElement('button');b.id='requestFloatConfirmV1';b.type='button';b.innerHTML=`${checkSvg()}<span>CONFERMA</span>`;b.setAttribute('aria-label','Conferma prelievo');b.onclick=openDialog;document.body.appendChild(b);
    }
    if(!$('requestFloatDialogV1')){
      const d=document.createElement('dialog');d.id='requestFloatDialogV1';d.innerHTML=`<div class="rfDialogHead"><h2>Conferma operazione</h2><button type="button" class="rfDialogClose" aria-label="Chiudi">×</button></div><div id="requestFloatDialogBodyV1" class="rfDialogBody"></div><div class="rfDialogActions"><button type="button" class="rfCancel">ANNULLA</button><button type="button" class="rfConfirm">CONFERMA PRELIEVO</button><button type="button" class="rfComplete">CHIUDI / COMPLETA RICHIESTA</button></div>`;
      document.body.appendChild(d);
      d.querySelector('.rfDialogClose').onclick=()=>d.close();d.querySelector('.rfCancel').onclick=()=>d.close();
      d.addEventListener('cancel',e=>{e.preventDefault();d.close()});
      d.querySelector('.rfConfirm').onclick=confirmPickingFromDialog;
      d.querySelector('.rfComplete').onclick=completeFromDialog;
    }
  }

  function rowHtml(a){
    const article=h(txt(a.article_base).trim().toUpperCase()),size=h(txt(a.size).trim().toUpperCase()),cart=num(a.cartons),pieces=num(a.quantity);
    return `<div class="rfLine"><div><b>${article}${size?` · ${size}`:''}</b><span>${h(a.state||'')}</span></div><div class="rfLineQty"><b>${cart} cart.${cart===1?'':'oni'}</b><span>${pieces} pezzi</span></div></div>`;
  }
  function renderDialog(){
    const req=request(),body=$('requestFloatDialogBodyV1'),confirmBtn=$('requestFloatDialogV1')?.querySelector('.rfConfirm'),completeBtn=$('requestFloatDialogV1')?.querySelector('.rfComplete');if(!req||!body)return false;
    const s=summary(req),workflow=window.WarehouseRequestCompletionWorkflow,overall=workflow?.requestSummary?.(req);
    body.innerHTML=`<div class="rfReqId">${h(req.id||'RICHIESTA')} · ${h(req.destination||'')}</div><div class="rfTotals"><div class="rfMetric"><b>${s.cartons}</b><span>Cartoni</span></div><div class="rfMetric"><b>${s.pieces}</b><span>Pezzi</span></div><div class="rfMetric"><b>${s.articles}</b><span>Articoli</span></div></div>${s.rows.length?`<div class="rfLines">${s.rows.slice(0,10).map(rowHtml).join('')}${s.rows.length>10?`<div class="rfLine"><b>+ ${s.rows.length-10} altre righe</b><span></span></div>`:''}</div>`:'<div class="rfEmpty">Nessun prelievo selezionato. Puoi chiudere la richiesta solo se hai terminato il lavoro su questa richiesta.</div>'}${overall?`<div class="rfHint">Richiesta: ${overall.picked}/${overall.requested} cartoni già prelevati · ${overall.unpicked} ancora non prelevati.</div>`:''}`;
    if(confirmBtn){confirmBtn.disabled=!s.rows.length;confirmBtn.title=s.rows.length?'Conferma i dati inseriti':'Nessun prelievo selezionato'}
    if(completeBtn){completeBtn.disabled=s.rows.length>0;completeBtn.title=s.rows.length?'Conferma prima il prelievo compilato':'Chiudi la richiesta'}
    return true;
  }

  function openDialog(){
    if(!canProcess())return window.WarehouseRoleDashboardV1?.deny?.('Gestione richiesta');
    const req=request();if(!req||!isCartonRequest(req)||req.status==='COMPLETATA')return;
    ensureUi();renderDialog();$('requestFloatDialogV1').showModal();
  }

  async function confirmPickingFromDialog(){
    const req=request(),s=req?summary(req):null;if(!req||!s?.rows.length)return;
    const d=$('requestFloatDialogV1');d?.close();
    const nativeConfirm=window.confirm;
    let autoAccepted=false;
    window.confirm=function(message){
      const m=txt(message).toLowerCase();
      if(!autoAccepted&&(m.includes('preliev')||m.includes('scaric'))&&(m.includes('giacenz')||m.includes('quantit')||m.includes('carton'))){autoAccepted=true;return true}
      return nativeConfirm.call(window,message);
    };
    try{await Promise.resolve(window.confirmPicking?.())}finally{window.confirm=nativeConfirm;setTimeout(sync,30)}
  }

  async function completeFromDialog(){
    const req=request();if(!req)return;
    const s=summary(req);if(s.rows.length)return;
    $('requestFloatDialogV1')?.close();
    await window.WarehouseRequestCompletionWorkflow?.completeRequest?.(req.id);
    setTimeout(sync,30);
  }

  function visibleExportPanel(){
    const candidates=[...document.querySelectorAll('button')].filter(b=>/ESPORTA\s+ORA/i.test(b.textContent||''));
    let best=null;
    for(const b of candidates){
      if(!b.offsetParent)continue;
      let el=b,found=null;
      while(el&&el!==document.body){const pos=getComputedStyle(el).position;if(pos==='fixed'||pos==='sticky'){found=el;break}el=el.parentElement}
      const target=found||b.parentElement||b,rect=target.getBoundingClientRect();
      if(rect.width<40||rect.height<30||rect.bottom<innerHeight-8||rect.top<innerHeight*.35)continue;
      if(!best||rect.top<best.top)best=rect;
    }
    return best;
  }
  function updateBottom(){
    const btn=$('requestFloatConfirmV1');if(!btn)return;
    const panel=visibleExportPanel();let bottom=22;
    if(panel)bottom=Math.max(bottom,Math.round(innerHeight-panel.top+14));
    const vv=window.visualViewport;if(vv&&vv.height<innerHeight*.78)bottom=18;
    btn.style.setProperty('--rf-bottom',`${bottom}px`);
  }

  function sync(){
    ensureUi();
    const screen=$('requestDetail'),req=request(),btn=$('requestFloatConfirmV1');
    const show=!!(mobile()&&screen?.classList.contains('on')&&req&&isCartonRequest(req)&&req.status!=='COMPLETATA'&&canProcess());
    btn?.classList.toggle('rfVisible',show);screen?.classList.toggle('rfHasFloatingConfirm',show);
    if(show){renderDialog();updateBottom()}
    else $('requestFloatDialogV1')?.open&&$('requestFloatDialogV1').close();
  }

  function install(){
    if(installed)return true;installed=true;ensureCss();ensureUi();sync();
    observer=new MutationObserver(()=>requestAnimationFrame(sync));observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
    window.addEventListener('resize',sync,{passive:true});window.addEventListener('scroll',updateBottom,{passive:true});window.visualViewport?.addEventListener('resize',updateBottom,{passive:true});
    timer=setInterval(sync,650);return true;
  }

  window.WarehouseRequestFloatingConfirmV1={version:VERSION,install,sync,summary,openDialog,updateBottom,visibleExportPanel};
  install();
})();
