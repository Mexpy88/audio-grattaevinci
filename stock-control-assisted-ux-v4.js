/* Assisted Stock Control UX V4 — presentation-only layer.
   Does not alter stock calculations, rectification semantics or Excel export.
   Adds compact navigation aids, article collapse, state badges, progress and search. */
(function installStockControlAssistedUxV4(){
  'use strict';
  if(window.WarehouseStockControlAssistedUxV4)return;

  const VERSION='2026.08.26-stock-control-assisted-ux4.1';
  const $=id=>document.getElementById(id);
  const norm=v=>String(v??'').trim().toUpperCase();
  const collapsed=new Set();
  let scheduled=false,observer=null;

  function safeText(el,value){if(el&&el.textContent!==value)el.textContent=value}
  function injectCss(){
    if($('stockControlAssistedUxV4Css'))return;
    const s=document.createElement('style');s.id='stockControlAssistedUxV4Css';s.textContent=`
      .scaArticleGroup{padding:12px!important;margin:10px 0!important;border-radius:20px!important}
      .scaArticleHead{margin-bottom:7px!important;cursor:pointer}.scaArticleCode{font-size:19px!important}
      .scaVariant{padding:10px!important;margin:7px 0!important;border-radius:15px!important}
      .scaVariantHead{min-height:30px}.scaVariantTitle{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:15px!important}
      .scaSizeLabel{font-weight:950;color:#17314d}.scaStateBadge{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:950;letter-spacing:.02em}
      .scaStateBadge.NUOVO{background:#dff3e7;color:#176640}.scaStateBadge.SCARICATO{background:#e4edf5;color:#315b7a}.scaStateBadge.USATO{background:#fff0c7;color:#805c00}.scaStateBadge.DISMESSO{background:#f4e2e1;color:#8a3a34}.scaStateBadge.NON_CHIARO{background:#edf0f3;color:#5c6872}
      .scaCollapseBtn{flex:0 0 auto;width:38px;height:38px;border:0;border-radius:50%;background:#ffffff9e;color:#17314d;font-size:18px;font-weight:950;display:grid;place-items:center}
      .scaArticleGroup.scaCollapsed>.scaVariant,.scaArticleGroup.scaCollapsed>.scaAddVariant{display:none!important}.scaArticleGroup.scaCollapsed{padding-bottom:10px!important}.scaArticleGroup.scaCollapsed .scaArticleHead{margin-bottom:0!important}
      .scaArticleProgress{font-size:11px;font-weight:900;color:#65788c;white-space:nowrap}.scaArticleProgress.done{color:#08784a}
      .scaCheckState{display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:28px;border-radius:999px;padding:0 8px;font-size:12px;font-weight:950;white-space:nowrap}
      .scaCheckState.pending{background:#fff0d3;color:#7d5300}.scaCheckState.ok{background:#dff3e7;color:#08784a}.scaCheckState.plus{background:#e2f2ec;color:#08784a}.scaCheckState.minus{background:#fde7e4;color:#a43b35}
      .scaCountTools{position:sticky;top:78px;z-index:24;margin:10px 0 9px;background:#edf3f8ef;backdrop-filter:blur(10px);border:1px solid #d9e5ee;border-radius:18px;padding:9px;box-shadow:0 8px 20px #17314d12}
      .scaProgressTop{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:900;color:#456078}.scaProgressTop b{font-size:13px;color:#17314d}
      .scaProgressTrack{height:7px;border-radius:999px;background:#dbe5ec;overflow:hidden;margin:7px 0}.scaProgressFill{height:100%;width:0;background:#2c60aa;border-radius:999px;transition:width .15s ease}
      .scaSearchRow{display:flex;gap:7px;align-items:center}.scaSearchRow .field{min-height:44px!important;margin:0!important}.scaSearchClear{border:0;border-radius:12px;min-width:44px;height:44px;background:#fff;color:#40566a;font-size:18px;font-weight:950}
      .scaHelpBox{padding:0!important;overflow:hidden}.scaHelpToggle{width:100%;border:0;background:transparent;text-align:left;padding:12px 14px;font-weight:950;color:inherit;display:flex;justify-content:space-between;align-items:center}.scaHelpContent{padding:0 14px 13px;line-height:1.4}.scaHelpContent.hidden{display:none}
      .scaLiveSummary{margin:12px 0;background:#fff;border:1px solid #d9e5ee;border-radius:18px;padding:12px;box-shadow:0 7px 18px #17314d0d}.scaSummaryTitle{font-weight:950;color:#17314d;margin-bottom:6px}.scaSummaryGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.scaSummaryCell{background:#f3f7fa;border-radius:12px;padding:8px;text-align:center}.scaSummaryCell b{display:block;font-size:17px}.scaSummaryCell span{font-size:10px;color:#65788c;font-weight:850}
      .scaFloatAdd{background:#17314d!important}.scaQuickDialog #scaQuickTitle{font-size:21px}
      @media(max-width:430px){.scaCountTools{top:72px}.scaArticleGroup{padding:10px!important}.scaVariant{padding:9px!important}.scaCountMetrics{margin:7px 0!important}.scaMetric{padding:7px!important}.scaMetric b{font-size:17px!important}.scaSummaryGrid{grid-template-columns:repeat(2,1fr)}}
    `;document.head.appendChild(s);
  }

  function modeOf(group){return group.closest('#mgrCountAssistScreenV3')?'count':'direct'}
  function articleCodeOf(group){const code=group.querySelector('.scaArticleCode')?.textContent||group.querySelector('.scaArticleInput')?.value||'';return norm(code)||'SENZA ARTICOLO'}
  function collapseKey(group){return `${modeOf(group)}|${articleCodeOf(group)}`}

  function decorateArticleGroup(group){
    const head=group.querySelector('.scaArticleHead');if(!head)return;
    const key=collapseKey(group),isCollapsed=collapsed.has(key);group.classList.toggle('scaCollapsed',isCollapsed);
    let btn=head.querySelector('.scaCollapseBtn');if(!btn){btn=document.createElement('button');btn.type='button';btn.className='scaCollapseBtn';btn.setAttribute('aria-label','Comprimi o espandi articolo');btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const k=collapseKey(group);if(collapsed.has(k))collapsed.delete(k);else collapsed.add(k);decorateArticleGroup(group)});head.appendChild(btn)}
    safeText(btn,isCollapsed?'⌄':'⌃');btn.setAttribute('aria-expanded',String(!isCollapsed));
    if(modeOf(group)==='count'){
      const variants=[...group.querySelectorAll(':scope > .scaVariant')],verified=variants.filter(v=>!v.querySelector('.scaUnverified')).length;
      let p=head.querySelector('.scaArticleProgress');if(!p){p=document.createElement('span');p.className='scaArticleProgress';head.insertBefore(p,btn)}
      safeText(p,`${verified}/${variants.length} verificate`);p.classList.toggle('done',variants.length>0&&verified===variants.length);
    }
  }

  function stateFromVariant(v){const existing=v.querySelector('.scaStateBadge');if(existing)return norm(existing.textContent)||'NON_CHIARO';const sel=v.querySelector('select');if(sel)return norm(sel.value)||'NON_CHIARO';const raw=v.querySelector('.scaVariantTitle')?.textContent||'';const bits=raw.split('·').map(norm).filter(Boolean);return bits.at(-1)||'NON_CHIARO'}
  function sizeFromVariant(v){const existing=v.querySelector('.scaSizeLabel');if(existing)return norm(existing.textContent)||'SENZA TAGLIA';const input=v.querySelector('input.field:not([type="number"])');if(input&&v.closest('#stockEditScreen'))return norm(input.value)||'SENZA TAGLIA';const raw=v.querySelector('.scaVariantTitle')?.textContent||'';return norm(raw.split('·')[0])||'SENZA TAGLIA'}
  function decorateVariant(v){
    const title=v.querySelector('.scaVariantTitle');if(title){const size=sizeFromVariant(v),state=stateFromVariant(v);const signature=`${size}|${state}`;if(title.dataset.scaSignature!==signature){title.dataset.scaSignature=signature;title.innerHTML=`<span class="scaSizeLabel">${size}</span><span class="scaStateBadge ${state.replace(/[^A-Z0-9_-]/g,'_')}">${state}</span>`}}
    if(!v.closest('#mgrCountAssistScreenV3'))return;
    const head=v.querySelector('.scaVariantHead');if(!head)return;let badge=head.querySelector('.scaCheckState');if(!badge){badge=document.createElement('span');badge.className='scaCheckState';head.appendChild(badge)}
    if(v.querySelector('.scaUnverified')){badge.className='scaCheckState pending';safeText(badge,'○ DA FARE');return}
    const metrics=v.querySelectorAll('.scaMetric b'),raw=metrics[2]?.textContent?.trim()||'0',d=Number(raw.replace('+',''))||0;
    if(d===0){badge.className='scaCheckState ok';safeText(badge,'✓ OK')}else if(d>0){badge.className='scaCheckState plus';safeText(badge,`▲ +${d}`)}else{badge.className='scaCheckState minus';safeText(badge,`▼ ${d}`)}
  }

  function ensureHelp(){const body=$('scaCountBody');if(!body)return;const warn=[...body.children].find(el=>el.classList?.contains('status')&&el.classList.contains('warn'));if(!warn||warn.dataset.scaHelp==='1')return;warn.dataset.scaHelp='1';warn.classList.add('scaHelpBox');const original=warn.innerHTML;warn.innerHTML=`<button class="scaHelpToggle" type="button"><span>ⓘ Come funziona il conteggio</span><span>⌄</span></button><div class="scaHelpContent hidden">${original}</div>`;const toggle=warn.querySelector('.scaHelpToggle'),content=warn.querySelector('.scaHelpContent'),arrow=toggle.lastElementChild;toggle.addEventListener('click',()=>{const hidden=content.classList.toggle('hidden');safeText(arrow,hidden?'⌄':'⌃')})}

  function ensureTools(){const body=$('scaCountBody'),rows=$('scaCountRows');if(!body||!rows)return;let tools=$('scaCountToolsV4');if(!tools){tools=document.createElement('div');tools.id='scaCountToolsV4';tools.className='scaCountTools';tools.innerHTML=`<div class="scaProgressTop"><b id="scaProgressTextV4">0/0 verificate</b><span id="scaProgressPositionV4"></span></div><div class="scaProgressTrack"><div id="scaProgressFillV4" class="scaProgressFill"></div></div><div class="scaSearchRow"><input id="scaArticleSearchV4" class="field" placeholder="⌕ Cerca articolo nella fila…" autocomplete="off"><button id="scaArticleSearchClearV4" class="scaSearchClear" type="button" aria-label="Azzera ricerca">×</button></div>`;body.insertBefore(tools,rows);$('scaArticleSearchV4').addEventListener('input',applySearch);$('scaArticleSearchClearV4').addEventListener('click',()=>{$('scaArticleSearchV4').value='';applySearch()})}
  }

  function applySearch(){const q=norm($('scaArticleSearchV4')?.value);document.querySelectorAll('#scaCountRows>.scaArticleGroup').forEach(g=>{const show=!q||articleCodeOf(g).includes(q);if(g.style.display!==(show?'':'none'))g.style.display=show?'':'none'})}

  function summaryFromDom(){
    const variants=[...document.querySelectorAll('#scaCountRows .scaVariant')],verified=variants.filter(v=>!v.querySelector('.scaUnverified')),diffs=verified.map(v=>{const bs=v.querySelectorAll('.scaMetric b');return Number((bs[2]?.textContent||'0').replace('+',''))||0});
    return {total:variants.length,verified:verified.length,ok:diffs.filter(d=>d===0).length,plusCount:diffs.filter(d=>d>0).length,minusCount:diffs.filter(d=>d<0).length,plusPieces:diffs.filter(d=>d>0).reduce((a,b)=>a+b,0),minusPieces:Math.abs(diffs.filter(d=>d<0).reduce((a,b)=>a+b,0))};
  }

  function updateProgress(){
    const body=$('scaCountBody');if(!body||body.classList.contains('hidden'))return;ensureTools();const s=summaryFromDom(),pct=s.total?Math.round(s.verified*100/s.total):0;safeText($('scaProgressTextV4'),`${s.verified}/${s.total} verificate · ${s.total-s.verified} da controllare`);const fill=$('scaProgressFillV4');if(fill&&fill.style.width!==pct+'%')fill.style.width=pct+'%';
    let box=$('scaLiveSummaryV4');const confirmBtn=[...body.querySelectorAll('button')].find(b=>/CONFERMA VERIFICA/i.test(b.textContent||''));if(!box&&confirmBtn){box=document.createElement('div');box.id='scaLiveSummaryV4';box.className='scaLiveSummary';confirmBtn.insertAdjacentElement('beforebegin',box)}
    if(box){const sig=[s.total,s.verified,s.ok,s.plusCount,s.minusCount,s.plusPieces,s.minusPieces].join('|');if(box.dataset.sig!==sig){box.dataset.sig=sig;box.innerHTML=`<div class="scaSummaryTitle">Riepilogo verifica</div><div class="scaSummaryGrid"><div class="scaSummaryCell"><b>${s.verified}/${s.total}</b><span>CONTROLLATE</span></div><div class="scaSummaryCell"><b>${s.ok}</b><span>CORRETTE</span></div><div class="scaSummaryCell"><b>${s.minusCount} · -${s.minusPieces}</b><span>IN DIFETTO</span></div><div class="scaSummaryCell"><b>${s.plusCount} · +${s.plusPieces}</b><span>IN ECCEDENZA</span></div></div>`}}
    const loc=norm($('scaCountLoc')?.value),pal=norm($('scaCountPal')?.value),where=`${loc?`Fila ${loc}`:''}${loc&&pal?' · ':''}${pal?`Bancale ${pal}`:''}`;safeText($('scaProgressPositionV4'),`${where?where+' · ':''}${pct}%`);applySearch();
  }

  function renameAddActions(){
    const direct=$('stockQuickFoundDirectV3'),count=$('scaFloatFound');safeText(direct,'＋ AGGIUNGI');safeText(count,'＋ AGGIUNGI');
    const status=$('scaCountStatus');if(status&&/\+ TROVATO/i.test(status.textContent||''))safeText(status,(status.textContent||'').replace(/\+ TROVATO/ig,'+ AGGIUNGI'));
    const title=$('scaQuickTitle');if(title&&/^Trovato durante il conteggio$/i.test(title.textContent||''))safeText(title,'Aggiungi al conteggio');
  }

  function decorate(){scheduled=false;injectCss();renameAddActions();ensureHelp();ensureTools();document.querySelectorAll('.scaArticleGroup').forEach(decorateArticleGroup);document.querySelectorAll('.scaVariant').forEach(decorateVariant);updateProgress()}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate)}

  function install(){
    if(typeof document==='undefined')return false;injectCss();schedule();
    if(!observer){const root=document.querySelector('main')||document.body;observer=new MutationObserver(()=>schedule());observer.observe(root,{childList:true,subtree:true})}
    if(!document.documentElement.dataset.scaUxV4Events){document.documentElement.dataset.scaUxV4Events='1';document.addEventListener('input',e=>{if(e.target?.closest?.('.scaArticleGroup'))schedule()},true);document.addEventListener('change',e=>{if(e.target?.closest?.('.scaArticleGroup'))schedule()},true)}
    return true;
  }

  window.WarehouseStockControlAssistedUxV4={version:VERSION,install,decorate};
  install();
})();
