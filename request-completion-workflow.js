/* Request completion workflow.
   COMPLETATA means the operator has finished working the request, even when some
   requested cartons were unavailable. Completed requests are read-only until an
   explicit audited reopen action. */
(function installWarehouseRequestCompletionWorkflow(){
  'use strict';
  if(window.WarehouseRequestCompletionWorkflow)return;

  const VERSION='2026.08.25-request-completion1';
  let installed=false;
  let baseRenderList=null,baseRenderDetail=null,baseConfirmPicking=null,baseEnsureDraft=null;

  const txt=v=>String(v??'');
  const norm=v=>txt(v).trim().toUpperCase();
  const h=v=>typeof esc==='function'?esc(v):txt(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const article=v=>typeof normalizeArticle==='function'?normalizeArticle(v):norm(v).replace(/^1(?=[A-Z0-9])/,'I');
  const cartons=v=>Math.max(0,Math.floor(Number(v)||0));
  const isCartonRequest=req=>window.RequestCartons?.isCartonRequest?.(req)??!!(req&&(req.quantity_unit==='CARTONI'||Number(req.request_schema||0)>=2));
  const lineKey=l=>article(l?.article_base)+'|'+norm(l?.size);
  const requested=l=>cartons(l?.cartons??l?.quantity);
  const itemCartons=i=>cartons(i?.cartons??i?.quantity);
  const itemPieces=i=>Math.max(0,Math.floor(Number(i?.pieces)||0));
  const actor=()=>typeof operatorName==='function'?operatorName():(typeof currentUser!=='undefined'?currentUser:'');

  function requestGroups(req){
    const groups=new Map();
    for(const l of (req?.lines||[])){
      const k=lineKey(l);
      if(!groups.has(k))groups.set(k,{key:k,article_base:article(l.article_base),size:norm(l.size),requested:0,picked:0,pieces:0});
      groups.get(k).requested+=requested(l);
    }
    for(const d of (req?.deliveries||[]))for(const i of (d?.items||[])){
      if(i?.extra)continue;
      const k=lineKey(i),g=groups.get(k);if(!g)continue;
      g.picked+=itemCartons(i);g.pieces+=itemPieces(i);
    }
    return [...groups.values()].map(g=>{
      const picked=Math.min(g.requested,g.picked);
      return {...g,picked,unpicked:Math.max(0,g.requested-picked)};
    });
  }
  function requestSummary(req){
    const groups=requestGroups(req),requestedTotal=groups.reduce((a,g)=>a+g.requested,0),picked=groups.reduce((a,g)=>a+g.picked,0),pieces=groups.reduce((a,g)=>a+g.pieces,0);
    return {requested:requestedTotal,picked,unpicked:Math.max(0,requestedTotal-picked),pieces,groups};
  }
  function hasPendingDraft(req){
    const all=[...(req?.draft?.allocations||[]),...(req?.draft?.extraAllocations||[])];
    return all.some(a=>!!a?.checked||cartons(a?.cartons)>0||Math.max(0,Math.floor(Number(a?.quantity)||0))>0);
  }
  function completionRecord(req,closedBy,closedAt,reason='CHIUSA_OPERATORE'){
    const s=requestSummary(req);
    return {closed_at:closedAt||new Date().toISOString(),closed_by:txt(closedBy||''),reason,requested_cartons:s.requested,picked_cartons:s.picked,unpicked_cartons:s.unpicked,pieces_discharged:s.pieces};
  }
  function applyCompletion(req,closedBy,closedAt,reason='CHIUSA_OPERATORE'){
    if(!req)return null;
    const before={status:req.status||'',completion:req.completion||null};
    req.status='COMPLETATA';
    req.completion=completionRecord(req,closedBy,closedAt,reason);
    req.draft={allocations:[],extraAllocations:[],note:''};
    return {before,after:{status:req.status,completion:req.completion}};
  }
  function applyReopen(req,reopenedBy,reopenedAt){
    if(!req)return null;
    const before={status:req.status||'',completion:req.completion||null};
    req.completion_history=Array.isArray(req.completion_history)?req.completion_history:[];
    if(req.completion)req.completion_history.push({...req.completion});
    const s=requestSummary(req);
    req.status=s.picked>0?'PARZIALE':'DA PREPARARE';
    req.reopened_at=reopenedAt||new Date().toISOString();
    req.reopened_by=txt(reopenedBy||'');
    req.completion=null;
    req.draft={allocations:[],extraAllocations:[],note:''};
    return {before,after:{status:req.status,reopened_at:req.reopened_at,reopened_by:req.reopened_by}};
  }
  function persistAudit(action,req,before,after){
    if(typeof audit==='function')audit(action,'REQUEST',req.id,before,after);
    else if(typeof saveDb==='function')saveDb();
  }
  function toast(msg,type='success'){
    if(typeof warehouseToast==='function')warehouseToast(msg,type);
    else console.log('[REQUEST]',msg);
  }

  function ensureDecisionDialog(){
    if(typeof document==='undefined')return null;
    let d=document.getElementById('requestWorkflowDialog');if(d)return d;
    d=document.createElement('dialog');d.id='requestWorkflowDialog';d.className='requestWorkflowDialog';
    d.innerHTML='<div class="dialogHead"><h2 id="requestWorkflowTitle"></h2><button type="button" data-action="close">×</button></div><div id="requestWorkflowBody"></div><div class="requestWorkflowActions"><button type="button" class="btn soft" data-action="cancel">ANNULLA</button><button type="button" class="btn success" data-action="ok">CONFERMA</button></div>';
    document.body.appendChild(d);return d;
  }
  function decision({title,body,confirmText='CONFERMA',danger=false}){
    const d=ensureDecisionDialog();if(!d)return Promise.resolve(false);
    d.querySelector('#requestWorkflowTitle').textContent=title;
    d.querySelector('#requestWorkflowBody').innerHTML=body;
    const ok=d.querySelector('[data-action="ok"]');ok.textContent=confirmText;ok.className='btn '+(danger?'danger':'success');
    return new Promise(resolve=>{
      let done=false;
      const finish=v=>{if(done)return;done=true;try{d.close()}catch{}resolve(v)};
      d.querySelector('[data-action="close"]').onclick=()=>finish(false);
      d.querySelector('[data-action="cancel"]').onclick=()=>finish(false);
      ok.onclick=()=>finish(true);
      d.oncancel=e=>{e.preventDefault();finish(false)};
      d.showModal();
    });
  }

  async function completeRequest(id){
    if(typeof requireLogin==='function'&&!requireLogin())return false;
    const req=(db?.requests||[]).find(r=>r.id===id);if(!req||!isCartonRequest(req))return false;
    if(req.status==='COMPLETATA')return true;
    if(hasPendingDraft(req)){
      alert('Ci sono dati di prelievo compilati ma non ancora confermati. Conferma prima il prelievo oppure azzera quei valori, poi chiudi la richiesta.');
      return false;
    }
    const s=requestSummary(req);
    const ok=await decision({
      title:'Completa richiesta',
      confirmText:'COMPLETA RICHIESTA',
      body:`<div class="requestCloseTotals"><div><b>${s.requested}</b><span>cartoni richiesti</span></div><div><b>${s.picked}</b><span>cartoni prelevati</span></div><div class="missing"><b>${s.unpicked}</b><span>non prelevati</span></div></div><div class="status ${s.unpicked?'warn':'good'}">${s.unpicked?`I <b>${s.unpicked} cartoni</b> non prelevati resteranno registrati come mancanti/non disponibili. La richiesta verrà comunque considerata <b>COMPLETATA</b>.`:'Tutti i cartoni richiesti risultano prelevati.'}</div><p>Dopo la chiusura la richiesta sarà in sola lettura. Per integrarla successivamente dovrai usare <b>MODIFICA / RIAPRI</b>.</p>`
    });
    if(!ok)return false;
    const change=applyCompletion(req,actor(),new Date().toISOString(),'CHIUSA_OPERATORE');
    persistAudit('COMPLETE',req,change.before,change.after);
    toast(`Richiesta ${req.id} completata: ${s.picked}/${s.requested} cartoni prelevati${s.unpicked?` · ${s.unpicked} non prelevati`:''}.`,'success');
    window.renderRequestDetail?.(req);window.renderRequestList?.();return true;
  }
  async function reopenRequest(id){
    if(typeof requireLogin==='function'&&!requireLogin())return false;
    const req=(db?.requests||[]).find(r=>r.id===id);if(!req||!isCartonRequest(req)||req.status!=='COMPLETATA')return false;
    const s=requestSummary(req);
    const ok=await decision({title:'Riapri richiesta',confirmText:'MODIFICA / RIAPRI',danger:true,body:`<div class="status warn"><b>La richiesta è già completata.</b><br>Riaprendola potrai integrare il prelievo dei ${s.unpicked} cartoni ancora non prelevati. L'operazione verrà registrata nello storico.</div>`});
    if(!ok)return false;
    const change=applyReopen(req,actor(),new Date().toISOString());
    if(typeof baseEnsureDraft==='function')baseEnsureDraft.call(window,req);
    persistAudit('REOPEN',req,change.before,change.after);
    toast(`Richiesta ${req.id} riaperta per modifica.`,'success');
    window.renderRequestDetail?.(req);window.renderRequestList?.();return true;
  }

  function readonlyHtml(req){
    const s=requestSummary(req);
    return `<div class="requestReadonlySummary"><div class="requestCloseTotals"><div><b>${s.requested}</b><span>richiesti</span></div><div><b>${s.picked}</b><span>prelevati</span></div><div class="missing"><b>${s.unpicked}</b><span>non prelevati</span></div></div><div class="requestReadonlyList">${s.groups.map(g=>`<div class="requestReadonlyRow ${g.unpicked?'missing':'done'}"><div><b>${h(g.article_base)}${g.size?` · ${h(g.size)}`:''}</b><span>${g.pieces} pezzi scaricati</span></div><div><b>${g.picked}/${g.requested}</b><span>${g.unpicked?`${g.unpicked} non prelevati`:'completo'}</span></div></div>`).join('')}</div></div>`;
  }
  function ensureCloseButton(req){
    if(typeof document==='undefined')return;
    document.querySelectorAll('[data-request-close-button]').forEach(x=>x.remove());
    if(!req||req.status==='COMPLETATA')return;
    const btn=document.getElementById('confirmPickBtn');if(!btn)return;
    const close=document.createElement('button');close.type='button';close.className='btn requestCloseBtn';close.dataset.requestCloseButton='1';close.textContent='✓ CHIUDI / COMPLETA RICHIESTA';close.onclick=()=>completeRequest(req.id);btn.insertAdjacentElement('afterend',close);
  }
  function decorateDetail(req){
    if(typeof document==='undefined'||!req||!isCartonRequest(req))return;
    const completed=req.status==='COMPLETATA',screen=document.getElementById('requestDetail'),btn=document.getElementById('confirmPickBtn');
    ensureCloseButton(req);if(btn)btn.style.display=completed?'none':'';
    if(screen)screen.querySelectorAll('input,textarea,select').forEach(el=>{el.disabled=completed});
    const extra=document.getElementById('extraSearch');if(extra?.closest('.card'))extra.closest('.card').style.display=completed?'none':'';
    const holder=document.getElementById('requestAvailability');if(completed&&holder)holder.innerHTML=readonlyHtml(req);
    const header=document.getElementById('requestDetailHeader');
    if(header){
      header.querySelector('[data-request-completion-banner]')?.remove();
      if(completed){
        const s=requestSummary(req),banner=document.createElement('div');
        banner.dataset.requestCompletionBanner='1';banner.className='requestCompletionBanner';
        banner.innerHTML=`<b>✓ RICHIESTA COMPLETATA</b><span>${s.picked} di ${s.requested} cartoni prelevati${s.unpicked?` · ${s.unpicked} non prelevati`:''}</span>`;
        const actions=header.querySelector('.cartonReqActions');header.insertBefore(banner,actions||null);
        if(actions){
          const buttons=[...actions.querySelectorAll('button')],other=buttons.find(b=>!/ESPORTA/i.test(b.textContent||''));
          if(other){other.textContent='MODIFICA / RIAPRI';other.className='btn soft';other.onclick=()=>reopenRequest(req.id)}
        }
      }
    }
  }
  function decorateList(){
    if(typeof document==='undefined')return;
    for(const card of document.querySelectorAll('#requestList .requestCard')){
      const id=card.querySelector('.requestId')?.textContent?.trim(),req=(db?.requests||[]).find(r=>r.id===id);if(!req||!isCartonRequest(req))continue;
      const badge=card.querySelector('.requestStatus');
      if(badge){
        badge.textContent=req.status||'';
        badge.classList.toggle('complete',req.status==='COMPLETATA');
        badge.classList.toggle('partial',req.status==='PARZIALE');
        badge.classList.toggle('open',!['COMPLETATA','PARZIALE'].includes(req.status));
      }
      card.querySelector('[data-completion-meta]')?.remove();
      if(req.status!=='COMPLETATA'){card.classList.remove('requestClosedCard');continue}
      card.classList.add('requestClosedCard');
      const s=requestSummary(req),meta=card.querySelector('.meta');
      if(meta){const span=document.createElement('span');span.dataset.completionMeta='1';span.innerHTML=`✓ COMPLETATA${s.unpicked?` · ⚠ ${s.unpicked} non prelevati`:''}`;meta.appendChild(span)}
      const actions=card.querySelector('.actions');
      if(actions){
        const buttons=[...actions.querySelectorAll('button')];
        if(buttons[0]){buttons[0].textContent='VEDI DETTAGLI';buttons[0].onclick=()=>openRequestDetail(req.id)}
        if(buttons[1]){buttons[1].textContent='MODIFICA / RIAPRI';buttons[1].className='btn soft';buttons[1].onclick=()=>reopenRequest(req.id)}
      }
    }
  }

  function wrapEnsureDraft(){
    baseEnsureDraft=window.ensureDraftAllocations;
    if(typeof baseEnsureDraft!=='function'||baseEnsureDraft.__requestCompletionWrapped)return;
    const wrapped=function(req){
      if(isCartonRequest(req)&&req?.status==='COMPLETATA'){
        req.draft=req.draft||{allocations:[],extraAllocations:[],note:''};req.draft.allocations=[];req.draft.extraAllocations=[];return;
      }
      return baseEnsureDraft.apply(this,arguments);
    };
    wrapped.__requestCompletionWrapped=true;window.ensureDraftAllocations=wrapped;
  }
  function wrapRenderers(){
    baseRenderList=window.renderRequestList;baseRenderDetail=window.renderRequestDetail;
    if(typeof baseRenderList==='function'&&!baseRenderList.__requestCompletionWrapped){
      const f=function(){const out=baseRenderList.apply(this,arguments);decorateList();return out};f.__requestCompletionWrapped=true;window.renderRequestList=f;
    }
    if(typeof baseRenderDetail==='function'&&!baseRenderDetail.__requestCompletionWrapped){
      const f=function(req){const out=baseRenderDetail.apply(this,arguments);decorateDetail(req);return out};f.__requestCompletionWrapped=true;window.renderRequestDetail=f;
    }
  }
  function wrapConfirmPicking(){
    baseConfirmPicking=window.confirmPicking;
    if(typeof baseConfirmPicking!=='function'||baseConfirmPicking.__requestCompletionWrapped)return;
    const f=async function(){
      const req=(db?.requests||[]).find(r=>r.id===activeRequestId);
      if(req&&isCartonRequest(req)&&req.status==='COMPLETATA'){alert('La richiesta è completata. Usa MODIFICA / RIAPRI per aggiungere altro materiale.');return}
      const out=await baseConfirmPicking.apply(this,arguments);
      if(req&&isCartonRequest(req)&&req.status==='COMPLETATA'&&!req.completion){
        const change=applyCompletion(req,actor(),new Date().toISOString(),'TUTTI_PRELEVATI');persistAudit('COMPLETE',req,change.before,change.after);window.renderRequestDetail?.(req);window.renderRequestList?.();
      }
      return out;
    };
    f.__requestCompletionWrapped=true;window.confirmPicking=f;
  }
  function install(){if(installed)return true;installed=true;wrapEnsureDraft();wrapRenderers();wrapConfirmPicking();decorateList();return true}

  window.WarehouseRequestCompletionWorkflow={version:VERSION,requestGroups,requestSummary,hasPendingDraft,completionRecord,applyCompletion,applyReopen,completeRequest,reopenRequest,readonlyHtml,decorateDetail,decorateList,install};
  if(typeof document!=='undefined')install();
})();
