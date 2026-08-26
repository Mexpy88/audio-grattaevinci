/* Final consistency and safety layer for Managerial V2. */
(function installWarehouseManagerialV2Polish(){
  'use strict';
  if(window.WarehouseManagerialV2Polish)return;
  const VERSION='2026.08.26-managerial-v2-polish6-grouped-rect-v2';
  const norm=v=>String(v??'').trim().toUpperCase();
  const article=v=>{try{return typeof normalizeArticle==='function'?normalizeArticle(v,true):norm(v)}catch{return norm(v)}};
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const palletOf=r=>norm(r?.bancale||'');
  const matchesTarget=(r,loc,pal)=>(!loc||locOf(r)===loc)&&(!pal||palletOf(r)===pal);
  function relabelSearch(){document?.querySelectorAll?.('#stockList .uxQuickEdit').forEach(b=>{if((b.textContent||'').trim()!=='RETTIFICA')b.textContent='RETTIFICA';b.title='Rettifica questa giacenza'})}
  function wrapRenderStock(){const base=window.renderStock;if(typeof base!=='function'||base.__managerialV2Polish)return;const f=function(){const out=base.apply(this,arguments);relabelSearch();return out};f.__managerialV2Polish=true;f.__previous=base;window.renderStock=f}
  function extraRowsFromDom(){return [...(document?.querySelectorAll?.('#mgrCountRows .mgrFound')||[])].map(row=>{const inputs=row.querySelectorAll('input'),sel=row.querySelector('select');return {article_base:article(inputs[0]?.value),size:norm(inputs[1]?.value),state:norm(sel?.value),counted:Math.max(0,Math.floor(Number(inputs[2]?.value)||0))}}).filter(r=>r.counted>0)}
  function wrapCountConfirm(){const base=window.confirmPhysicalCountV2;if(typeof base!=='function'||base.__managerialV2Polish)return;const f=function(){const extras=extraRowsFromDom(),loc=norm(document.getElementById('mgrCountLoc')?.value),pal=norm(document.getElementById('mgrCountPal')?.value),seen=new Set();for(const r of extras){const k=[r.article_base,r.size,r.state].join('|');if(seen.has(k)){alert(`${r.article_base} ${r.size||''}: la stessa riga TROVATO NON PREVISTO è stata inserita più volte. Uniscila in una sola quantità.`);return false}seen.add(k);const already=(typeof stockBuckets==='function'?stockBuckets():[]).some(s=>article(s.article_base)===r.article_base&&norm(s.size)===r.size&&norm(s.state)===r.state&&matchesTarget(s,loc,pal)&&Number(s.quantity)>0);if(already){alert(`${r.article_base} ${r.size||''} ${r.state}: questa giacenza è già prevista nella posizione verificata. Inserisci la quantità CONTATA nella riga esistente, senza aggiungerla come TROVATO NON PREVISTO.`);return false}}return base.apply(this,arguments)};f.__managerialV2Polish=true;f.__previous=base;window.confirmPhysicalCountV2=f}
  function loadAssistedUxV5(){
    if(window.WarehouseStockControlAssistedUxV5){window.WarehouseStockControlAssistedUxV5.install?.();return true}
    if(document.getElementById('stockControlAssistedUxV5Js'))return true;
    const v=document.createElement('script');v.id='stockControlAssistedUxV5Js';v.src='stock-control-assisted-ux-v5.js?v=20260826-assist-ux5';v.async=false;v.onload=()=>window.WarehouseStockControlAssistedUxV5?.install?.();v.onerror=()=>console.error('Impossibile caricare stock-control-assisted-ux-v5.js');document.body.appendChild(v);return true;
  }
  function loadAssistedUxV4(){
    if(window.WarehouseStockControlAssistedUxV4){window.WarehouseStockControlAssistedUxV4.install?.();loadAssistedUxV5();return true}
    const existing=document.getElementById('stockControlAssistedUxV4Js');if(existing){existing.addEventListener('load',loadAssistedUxV5,{once:true});return true}
    const u=document.createElement('script');u.id='stockControlAssistedUxV4Js';u.src='stock-control-assisted-ux-v4.js?v=20260826-assist-ux4';u.async=false;u.onload=()=>{window.WarehouseStockControlAssistedUxV4?.install?.();loadAssistedUxV5()};u.onerror=()=>console.error('Impossibile caricare stock-control-assisted-ux-v4.js');document.body.appendChild(u);return true;
  }
  function loadAssistedStockControl(){
    if(window.WarehouseStockControlAssistedV3){window.WarehouseStockControlAssistedV3.install?.();loadAssistedUxV4();return true}
    const existing=document.getElementById('stockControlAssistedV3Js');if(existing){existing.addEventListener('load',loadAssistedUxV4,{once:true});return true}
    const s=document.createElement('script');s.id='stockControlAssistedV3Js';s.src='stock-control-assisted-v3.js?v=20260826-assist3';s.async=false;s.onload=()=>{window.WarehouseStockControlAssistedV3?.install?.();loadAssistedUxV4()};s.onerror=()=>console.error('Impossibile caricare stock-control-assisted-v3.js');document.body.appendChild(s);return true;
  }
  function loadGroupedRectificationV2(){
    if(window.WarehouseDirectRectificationGroupedV2){window.WarehouseDirectRectificationGroupedV2.install?.();return true}
    const existing=document.getElementById('directRectificationGroupedV2Js');if(existing){existing.addEventListener('load',()=>window.WarehouseDirectRectificationGroupedV2?.install?.(),{once:true});return true}
    const g=document.createElement('script');g.id='directRectificationGroupedV2Js';g.src='stock-rectification-grouped-ux-v2.js?v=20260826-direct-rect2';g.async=false;g.onload=()=>window.WarehouseDirectRectificationGroupedV2?.install?.();g.onerror=()=>console.error('Impossibile caricare stock-rectification-grouped-ux-v2.js');document.body.appendChild(g);return true;
  }
  function install(){if(typeof document==='undefined')return false;wrapRenderStock();wrapCountConfirm();relabelSearch();loadAssistedStockControl();loadGroupedRectificationV2();return true}
  window.WarehouseManagerialV2Polish={version:VERSION,install,relabelSearch,loadAssistedStockControl,loadAssistedUxV4,loadAssistedUxV5,loadGroupedRectificationV2};install();
})();
