/* Mobile navigation stability hotfix.
   Keeps the swipe-back gesture but restores the original screen router so HOME buttons
   (CARICA, SCARICA, CERCA, REGISTRO, RICHIESTE) keep using the proven base navigation.
   Also prevents an empty search from rendering thousands of stock groups at once. */
(function installWarehouseNavigationHotfix(){
  'use strict';
  if(window.WarehouseNavigationHotfix)return;

  const VERSION='2026.08.20-nav-hotfix1';
  const byId=id=>document.getElementById(id);

  function restoreBaseShow(){
    const current=window.show;
    const original=current&&current.__msv3Original;
    if(typeof original==='function'){
      window.show=original;
      return true;
    }
    return false;
  }

  function installSafeSearch(){
    const current=window.renderStock;
    if(typeof current!=='function'||current.__warehouseSafeSearch)return;

    const underlying=current.__warehouseSafeSearchOriginal||current;
    const wrapped=function safeWarehouseStockRender(){
      const input=byId('searchInput');
      const state=String(byId('uxSearchState')?.value||'').trim();
      const query=String(input?.value||'').trim();

      // With a large Master, opening CERCA with an empty query must not create
      // thousands of DOM cards. Results are rendered as soon as the user types.
      if(input&&!query&&!state){
        const summary=byId('uxSearchSummary');
        const list=byId('stockList');
        if(summary)summary.textContent='Inserisci un articolo o articolo + taglia per vedere le disponibilità.';
        if(list)list.innerHTML='<div class="status">Cerca un articolo, per esempio <b>I00215</b> oppure <b>I00215-S</b>.</div>';
        return;
      }
      return underlying.apply(this,arguments);
    };
    wrapped.__warehouseSafeSearch=true;
    wrapped.__warehouseSafeSearchOriginal=underlying;
    window.renderStock=wrapped;
  }

  function install(){
    restoreBaseShow();
    installSafeSearch();
  }

  // Mobile Search V3 performs delayed installs at startup. Re-apply after those
  // timers so it cannot reintroduce the navigation wrapper or the heavy empty search.
  install();
  setTimeout(install,220);
  setTimeout(install,520);

  window.WarehouseNavigationHotfix={version:VERSION,install,restoreBaseShow,installSafeSearch};
})();
