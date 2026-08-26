/* Final consistency and safety layer for Managerial V2. */
(function installWarehouseManagerialV2Polish(){
  'use strict';
  if(window.WarehouseManagerialV2Polish)return;
  const VERSION='2026.08.26-managerial-v2-polish3-assisted-ux4';
  const norm=v=>String(v??'').trim().toUpperCase();
  const article=v=>{try{return typeof normalizeArticle==='function'?normalizeArticle(v,true):norm(v)}catch{return norm(v)}};
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const palletOf=r=>norm(r?.bancale||'');
  const matchesTarget=(r,loc,pal)=>(!loc||locOf(r)===loc)&&(!pal||palletOf(r)===pal);
  function relabelSearch(){document?.querySelectorAll?.('#stockList .uxQuickEdit').forEach(b=>{if((b.textContent||'').trim()!=='RETTIFICA')b.textContent='RETTIFICA';b.title='Rettifica questa giacenza'})}
  function wrapRenderStock(){const base=window.renderStock;if(typeof base!=='function'||base.__managerialV2Polish)return;const f=function(){const out=base.apply(this,arguments);relabelSearch();return out};f.__managerialV2Polish=true;f.__previous=base;window.renderStock=f}
  function extraRowsFromDom(){return [...(document?.querySelectorAll?.('#mgrCountRows .mgrFound')||[])].map(row=>{const inputs=row.querySelectorAll('input'),sel=row.querySelector('select');return {article_base:article(inputs[0]?.value),size:norm(inputs[1]?.value),state:norm(sel?.value),counted:Math.max(0,Math.floor(Number(inputs[2]?.value)||0))}}).filter(r=>r.counted>0)}
  function wrapCountConfirm(){const base=window.confirmPhysicalCountV2;if(typeof base!=='function'||base.__managerialV2Polish)return;const f=function(){const extras=extraRowsFromDom(),loc=norm(document.getElementById('mgrCountLoc')?.value),pal=norm(document.getElementById('mgrCountPal')?.value),seen=new Set();for(const r of extras){const k=[r.article_base,r.size,r.state].join('|');if(seen.has(k)){alert(`${r.article_base} ${r.size||''}: la stessa riga TROVATO NON PREVISTO è stata inserita più volte. Uniscila in una sola quantità.`);return false}seen.add(k);const already=(typeof stockBuckets==='function'?stockBuckets():[]).some(s=>article(s.article_base)===r.article_base&&norm(s.size)===r.size&&norm(s.state)===r.state&&matchesTarget(s,loc,pal)&&Number(s.quantity)>0);if(already){alert(`${r.article_base} ${r.size||''} ${r.state}: questa giacenza è già prevista nella posizione verificata. Inserisci la quantità CONTATA nella riga esistente, senza aggiungerla come TROVATO NON PREVISTO.`);return false}}return base.apply(this,arguments)};f.__managerialV2Polish=true;f.__previous=base;window.confirmPhysicalCountV2=f}
  function loadAssistedUxV4(){
    if(window.WarehouseStockControlAssistedUxV4){window.WarehouseStockControlAssistedUxV4.install?.();return true}
    if(document.getElementById('stockControlAssistedUxV4Js'))return true;
    const u=document.createElement('script');u.id='stockControlAssistedUxV4Js';u.src='stock-control-assisted-ux-v4.js?v=20260826-assist-ux4';u.async=false;u.onload=()=>window.WarehouseStockControlAssistedUxV4?.install?.();u.onerror=()=>console.error('Impossibile caricare stock-control-assisted-ux-v4.js');document.body.appendChild(u);return true;
  }
  function loadAssistedStockControl(){
    if(window.WarehouseStockControlAssistedV3){window.WarehouseStockControlAssistedV3.install?.();loadAssistedUxV4();return true}
    const existing=document.getElementById('stockControlAssistedV3Js');if(existing){existing.addEventListener('load',loadAssistedUxV4,{once:true});return true}
    const s=document.createElement('script');s.id='stockControlAssistedV3Js';s.src='stock-control-assisted-v3.js?v=20260826-assist3';s.async=false;s.onload=()=>{window.WarehouseStockControlAssistedV3?.install?.();loadAssistedUxV4()};s.onerror=()=>console.error('Impossibile caricare stock-control-assisted-v3.js');document.body.appendChild(s);return true;
  }
  function install(){if(typeof document==='undefined')return false;wrapRenderStock();wrapCountConfirm();relabelSearch();loadAssistedStockControl();return true}
  window.WarehouseManagerialV2Polish={version:VERSION,install,relabelSearch,loadAssistedStockControl,loadAssistedUxV4};install();
})();
