/* Premium Dashboard V2 integration hardening. */
(function installWarehousePremiumDashboardV2Fix(){
  'use strict';
  if(window.WarehousePremiumDashboardV2Fix)return;
  const VERSION='2026.08.27-premium-dashboard2-fix2-teramo1';
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

  function ensureTeramoPolishCss(){
    if($('teramoDashboardPolishV1Css'))return;
    const style=document.createElement('style');style.id='teramoDashboardPolishV1Css';style.textContent=`
      @media(max-width:899px){
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2{grid-template-columns:minmax(0,1fr) 52px!important;column-gap:12px!important;align-items:center!important}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdMasterMain{grid-column:1!important;grid-row:1!important;min-width:0!important;padding-right:0!important;overflow:hidden!important}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdMasterDetails.rdMasterAddV2{grid-column:2!important;grid-row:1!important;width:48px!important;height:48px!important;min-width:48px!important;margin:0!important;padding:0!important;justify-self:end!important;align-self:center!important}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdMasterText{min-width:0!important;width:100%!important}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdMasterTopline{display:flex!important;align-items:center!important;flex-wrap:wrap!important;column-gap:7px!important;row-gap:5px!important;min-width:0!important}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdMasterTopline>b{white-space:nowrap!important}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdReady{position:static!important;transform:none!important;white-space:nowrap!important;max-width:100%!important;flex:0 0 auto!important}
      }
      @media(max-width:430px){
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2{padding:14px!important;column-gap:10px!important}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdMasterMain{gap:10px!important}
      }
    `;document.head.appendChild(style);
  }

  function decorateTeramoTitle(){
    const title=document.querySelector('#rdDashboardV1 .rdDashTitle h1');
    if(title&&title.textContent!=='MAGAZZINO TERAMO')title.textContent='MAGAZZINO TERAMO';
    const headerSub=$('rdHeaderTitleV1')?.querySelector('span');
    if(headerSub&&headerSub.textContent==='Dashboard')headerSub.textContent='MAGAZZINO TERAMO';
  }

  function decorate(){ensureTeramoPolishCss();decorateTeramoTitle();wrapReview();decorateLinaStatuses();decorateScanTitle()}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate()})}
  function install(){decorate();if(!observer){observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true})}return true}
  window.WarehousePremiumDashboardV2Fix={version:VERSION,install,reviewShell,decorate,ensureTeramoPolishCss,decorateTeramoTitle};install();
})();
