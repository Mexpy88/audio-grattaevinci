/* Assisted Stock Control UX V5.1 — visual-only refinement.
   Keeps counting, stock, rectification and Excel semantics unchanged. */
(function installStockControlAssistedUxV5(){
  'use strict';
  if(window.WarehouseStockControlAssistedUxV5)return;
  const VERSION='2026.08.26-stock-control-assisted-ux5-1';
  const $=id=>document.getElementById(id);
  let observer=null,scheduled=false;

  function injectCss(){
    if($('stockControlAssistedUxV5Css'))return;
    const s=document.createElement('style');s.id='stockControlAssistedUxV5Css';s.textContent=`
      /* Stronger but still warm alternating article palette */
      #mgrCountAssistScreenV3 .scaArticleGroup.toneA{background:#e7c89f!important;border-color:#d1aa75!important}
      #mgrCountAssistScreenV3 .scaArticleGroup.toneB{background:#fff0d0!important;border-color:#e4c99b!important}

      /* Compact two-line article header: article first, counters second */
      #mgrCountAssistScreenV3 .scaArticleGroup{padding:9px 10px!important;margin:8px 0!important;border-width:1px!important;border-style:solid!important;border-radius:18px!important;transition:border-color .16s ease,box-shadow .16s ease,background-color .16s ease}
      #mgrCountAssistScreenV3 .scaArticleHead{display:grid!important;grid-template-columns:minmax(0,1fr) 36px!important;grid-template-rows:auto auto!important;align-items:center!important;column-gap:8px!important;row-gap:4px!important;margin:0!important;min-height:48px!important;cursor:pointer}
      #mgrCountAssistScreenV3 .scaArticleCode{grid-column:1!important;grid-row:1!important;min-width:0!important;white-space:nowrap!important;overflow:visible!important;overflow-wrap:normal!important;word-break:normal!important;line-height:1.02!important;font-size:clamp(19px,5.6vw,23px)!important;font-weight:950!important;letter-spacing:-.02em!important}
      #mgrCountAssistScreenV3 .scaArticleMetaLine{grid-column:1!important;grid-row:2!important;display:flex!important;align-items:center!important;gap:8px!important;min-width:0!important;white-space:nowrap!important}
      #mgrCountAssistScreenV3 .scaArticleMetaLine>.tag{white-space:nowrap!important;margin:0!important;padding:4px 8px!important;border-radius:999px!important;font-size:10.5px!important;line-height:1!important}
      #mgrCountAssistScreenV3 .scaArticleProgress{white-space:nowrap!important;font-size:10.5px!important;line-height:1!important;margin:0!important}
      #mgrCountAssistScreenV3 .scaCollapseBtn{grid-column:2!important;grid-row:1 / span 2!important;align-self:center!important;width:36px!important;height:36px!important;min-width:36px!important;border-radius:50%!important;font-size:16px!important;margin:0!important;padding:0!important}
      #mgrCountAssistScreenV3 .scaArticleGroup.scaCollapsed{padding-top:8px!important;padding-bottom:8px!important}

      /* The expected-location sentence is redundant in assisted counting */
      #mgrCountAssistScreenV3 .scaVariantMeta.scaExpectedLocationMeta{display:none!important}
      #mgrCountAssistScreenV3 .scaVariantHead{margin-bottom:2px!important}

      /* Clear completion state without changing the warm alternating palette */
      #mgrCountAssistScreenV3 .scaArticleGroup.scaArticleComplete{border:2px solid #8fc69d!important;box-shadow:0 0 0 3px rgba(110,180,128,.14),0 7px 18px rgba(39,112,64,.08)!important}
      #mgrCountAssistScreenV3 .scaArticleGroup.scaArticleComplete .scaArticleCode{color:#145d36!important}
      #mgrCountAssistScreenV3 .scaArticleGroup.scaArticleComplete .scaArticleProgress{color:#147343!important;font-weight:950!important}

      @media(max-width:380px){
        #mgrCountAssistScreenV3 .scaArticleHead{grid-template-columns:minmax(0,1fr) 34px!important;column-gap:6px!important;row-gap:3px!important;min-height:46px!important}
        #mgrCountAssistScreenV3 .scaArticleCode{font-size:clamp(18px,5.4vw,21px)!important}
        #mgrCountAssistScreenV3 .scaArticleMetaLine{gap:6px!important}
        #mgrCountAssistScreenV3 .scaArticleMetaLine>.tag{font-size:9.5px!important;padding:4px 6px!important}
        #mgrCountAssistScreenV3 .scaArticleProgress{font-size:9.5px!important}
        #mgrCountAssistScreenV3 .scaCollapseBtn{width:34px!important;height:34px!important;min-width:34px!important}
      }
    `;document.head.appendChild(s);
  }

  function ensureHeaderStructure(group){
    const head=group.querySelector('.scaArticleHead');if(!head)return;
    const tag=head.querySelector(':scope > .tag')||head.querySelector('.scaArticleMetaLine > .tag');
    const progress=head.querySelector('.scaArticleProgress');
    let line=head.querySelector('.scaArticleMetaLine');
    if(!line){line=document.createElement('div');line.className='scaArticleMetaLine';const btn=head.querySelector('.scaCollapseBtn');head.insertBefore(line,btn||null)}
    if(tag&&tag.parentElement!==line)line.appendChild(tag);
    if(progress&&progress.parentElement!==line)line.appendChild(progress);
  }

  function hideRedundantMeta(group){
    group.querySelectorAll('.scaVariantMeta').forEach(meta=>{
      const t=(meta.textContent||'').trim().toUpperCase();
      meta.classList.toggle('scaExpectedLocationMeta',t==='PREVISTO NELLA POSIZIONE');
    });
  }

  function decorate(){
    scheduled=false;injectCss();
    document.querySelectorAll('#mgrCountAssistScreenV3 .scaArticleGroup').forEach(group=>{
      ensureHeaderStructure(group);
      hideRedundantMeta(group);
      const progress=group.querySelector('.scaArticleProgress');
      const complete=!!progress?.classList.contains('done');
      group.classList.toggle('scaArticleComplete',complete);
      group.dataset.scaComplete=complete?'1':'0';
      const code=group.querySelector('.scaArticleCode');
      if(code){const len=(code.textContent||'').trim().length;code.classList.toggle('scaCodeLong',len>=10)}
    });
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate)}
  function install(){
    if(typeof document==='undefined')return false;injectCss();schedule();
    if(!observer){const root=$('mgrCountAssistScreenV3')||document.querySelector('main')||document.body;observer=new MutationObserver(()=>schedule());observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})}
    return true;
  }
  window.WarehouseStockControlAssistedUxV5={version:VERSION,install,decorate};
  install();
})();