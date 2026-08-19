/* Scorciatoie cliccabili nelle statistiche del Master Excel. */
(function installDashboardLinks(){
  'use strict';
  const ROUTES=[
    {key:'movimenti',label:'Movimenti',go(){if(typeof openRegistry==='function')openRegistry();if(typeof setRegistryTab==='function')setRegistryTab('MOVIMENTI')}},
    {key:'scarichi',label:'Scarichi',go(){if(typeof openRegistry==='function')openRegistry();if(typeof setRegistryTab==='function')setRegistryTab('SCARICHI')}},
    {key:'richieste',label:'Richieste',go(){if(typeof openRequests==='function')openRequests()}}
  ];

  function ensureStyle(){
    if(document.getElementById('lmDashboardLinksStyle'))return;
    const s=document.createElement('style');s.id='lmDashboardLinksStyle';
    s.textContent=`
      #lmStats .lmStatLink{position:relative;cursor:pointer;user-select:none;outline:none;border:1px solid transparent;transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease,background .14s ease;padding-bottom:21px}
      #lmStats .lmStatLink:after{content:'APRI ›';position:absolute;left:0;right:0;bottom:6px;font-size:8px;letter-spacing:.08em;font-weight:950;color:#2c60aa;opacity:.72}
      #lmStats .lmStatLink:hover{background:#e5eff7;border-color:#c8dbea;box-shadow:0 6px 15px #173b5e14}
      #lmStats .lmStatLink:focus-visible{border-color:#2c60aa;box-shadow:0 0 0 3px #2c60aa26}
      #lmStats .lmStatLink:active{transform:scale(.96);background:#dceaf4}
      #lmStats .lmStatLink b,#lmStats .lmStatLink span{pointer-events:none}
      @media(max-width:430px){#lmStats .lmStatLink{min-height:86px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:23px}}
    `;
    document.head.appendChild(s);
  }

  function activate(tile,route){
    tile.classList.add('lmStatLink');
    tile.dataset.lmNav=route.key;
    tile.setAttribute('role','button');
    tile.setAttribute('tabindex','0');
    tile.setAttribute('aria-label',`Apri ${route.label}`);
    tile.title=`Apri ${route.label}`;
  }

  function decorate(){
    ensureStyle();
    const stats=document.getElementById('lmStats');if(!stats)return false;
    [...stats.children].slice(0,3).forEach((tile,i)=>{if(ROUTES[i])activate(tile,ROUTES[i])});
    if(stats.dataset.lmLinksBound==='1')return true;
    stats.dataset.lmLinksBound='1';
    stats.addEventListener('click',e=>{
      const tile=e.target.closest('[data-lm-nav]');if(!tile||!stats.contains(tile))return;
      const route=ROUTES.find(r=>r.key===tile.dataset.lmNav);if(route)route.go();
    });
    stats.addEventListener('keydown',e=>{
      if(e.key!=='Enter'&&e.key!==' ')return;
      const tile=e.target.closest('[data-lm-nav]');if(!tile||!stats.contains(tile))return;
      e.preventDefault();const route=ROUTES.find(r=>r.key===tile.dataset.lmNav);if(route)route.go();
    });
    return true;
  }

  decorate();
  const observer=new MutationObserver(()=>decorate());
  observer.observe(document.body,{childList:true,subtree:true});
  window.WarehouseDashboardLinks={decorate};
})();
