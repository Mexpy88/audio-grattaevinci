/* Premium Dashboard V2 integration hardening. */
(function installWarehousePremiumDashboardV2Fix(){
  'use strict';
  if(window.WarehousePremiumDashboardV2Fix)return;
  const VERSION='2026.08.27-premium-dashboard2-fix1';
  const $=id=>document.getElementById(id);
  let baseReview=null,observer=null,scheduled=false;

  function reviewShell(){
    const s=$('linaDigitalReviewV2');if(!s)return false;
    if($('linaReviewListV2'))return true;
    s.innerHTML=`<button class="back" onclick="show('linaDigitalRequestV2')">← MODIFICA</button><div class="eyebrow">RIEPILOGO</div><h1>Richiesta di prelievo</h1><div class="rdCleanCard"><div id="linaReviewListV2" class="linaReviewList"></div><div class="linaReviewActions"><button class="linaCancel" type="button" onclick="cancelLinaDigitalRequestV2()">ANNULLA</button><button class="linaModify" type="button" onclick="show('linaDigitalRequestV2')">MODIFICA</button><button class="linaTransmit" type="button" onclick="transmitLinaDigitalRequestV2()">TRASMETTI</button></div></div>`;return true;
  }

  function wrapReview(){
    const fn=window.openLinaRequestReviewV2;if(typeof fn!=='function'||fn.__premiumV2Fix)return;
    baseReview=fn;const f=function(){reviewShell();return baseReview.apply(this,arguments)};f.__premiumV2Fix=true;f.__previous=fn;window.openLinaRequestReviewV2=f;
  }

  function decorateLinaStatuses(){
    if(typeof currentUser==='undefined'||currentUser!=='Lina')return;
    document.querySelectorAll('#rdRequestProgressListV1 .rdRequestCard,#rdRequestCompletionListV1 .rdRequestCard').forEach(card=>{
      const id=card.querySelector('.rdReqMain>b')?.textContent?.trim(),req=(typeof db!=='undefined'?(db.requests||[]):[]).find(r=>r.id===id);if(!req||req.source!=='DIGITALE_LINA')return;
      const badge=card.querySelector('.rdReqStatus');if(!badge)return;
      if(req.status==='DA PREPARARE')badge.textContent='TRASMESSA';
      else badge.textContent=req.status||'';
    });
  }

  function decorateScanTitle(){
    if(typeof currentUser==='undefined'||!['Mattia','Massimo'].includes(currentUser))return;
    const s=$('requestNew');if(!s?.classList.contains('on'))return;const e=s.querySelector('.eyebrow'),h=s.querySelector('h1');if(e)e.textContent='SCANSIONA RICHIESTA';if(h)h.textContent='Acquisisci richiesta cartacea';
  }

  function decorate(){wrapReview();decorateLinaStatuses();decorateScanTitle()}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate()})}
  function install(){decorate();if(!observer){observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true})}return true}
  window.WarehousePremiumDashboardV2Fix={version:VERSION,install,reviewShell,decorate};install();
})();
