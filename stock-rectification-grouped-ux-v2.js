/* Direct Rectification Grouped UX V2
   Authoritative presentation layer for RETTIFICA DIRETTA.
   Keeps the existing saveStockEdit/rectification/Excel engines unchanged.
   It also neutralizes legacy direct renderers and duplicate floating add buttons. */
(function installWarehouseDirectRectificationGroupedV2(){
  'use strict';
  if(window.WarehouseDirectRectificationGroupedV2)return;

  const VERSION='2026.08.26-direct-rect-grouped2';
  const collapsed=new Set();
  const $=id=>document.getElementById(id);
  const norm=v=>String(v??'').trim().toUpperCase();
  const escHtml=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const stateList=()=>{try{const s=typeof STATES!=='undefined'&&Array.isArray(STATES)?STATES:['NUOVO','SCARICATO','USATO','DISMESSO','NON_CHIARO'];return [...new Set(s.map(norm).filter(Boolean))]}catch{return ['NUOVO','SCARICATO','USATO','DISMESSO','NON_CHIARO']}};
  let observer=null,scheduled=false,wrapping=false;

  function draft(){try{return Array.isArray(stockEditRowsDraft)?stockEditRowsDraft:[]}catch{return []}}
  function source(){try{return stockEditSource||{fila_scaffale:'',bancale:''}}catch{return {fila_scaffale:'',bancale:''}}}
  function findDraft(id){try{return typeof stockEditFind==='function'?stockEditFind(id):draft().find(r=>r.edit_id===id)}catch{return null}}

  function injectCss(){
    if($('directRectGroupedV2Css'))return;
    const s=document.createElement('style');s.id='directRectGroupedV2Css';s.textContent=`
      /* Semantic mode cards */
      #mgrStockControlHub .mgrActionGrid>.mgrAction:first-child{background:#fff0e3!important;border-color:#edc29b!important;box-shadow:0 8px 24px rgba(166,91,24,.09)!important}
      #mgrStockControlHub .mgrActionGrid>.mgrAction:first-child .icon,#mgrStockControlHub .mgrActionGrid>.mgrAction:first-child b{color:#9a5420!important}
      #mgrStockControlHub .mgrActionGrid>.mgrAction:nth-child(2){background:#e6f5f3!important;border-color:#b7ddd7!important;box-shadow:0 8px 24px rgba(24,108,99,.09)!important}
      #mgrStockControlHub .mgrActionGrid>.mgrAction:nth-child(2) .icon,#mgrStockControlHub .mgrActionGrid>.mgrAction:nth-child(2) b{color:#176c63!important}

      /* Authoritative grouped direct rectification */
      #stockEditScreen .srg2Article{border:1px solid transparent;border-radius:20px;padding:10px;margin:10px 0;transition:.16s ease}
      #stockEditScreen .srg2Article.toneA{background:#e7c89f;border-color:#d1aa75}
      #stockEditScreen .srg2Article.toneB{background:#fff0d0;border-color:#e4c99b}
      #stockEditScreen .srg2Head{display:grid;grid-template-columns:minmax(0,1fr) 38px;grid-template-rows:auto auto;gap:4px 8px;align-items:center;min-height:50px}
      #stockEditScreen .srg2Code{grid-column:1;grid-row:1;width:100%;min-width:0;border:0;background:transparent;color:#17314d;font-weight:950;font-size:clamp(19px,5.4vw,23px);line-height:1.04;padding:2px 0;outline:none;text-transform:uppercase;white-space:nowrap}
      #stockEditScreen .srg2Code:focus{background:#ffffffb8;border-radius:10px;padding:5px 7px;box-shadow:0 0 0 2px #2c60aa30}
      #stockEditScreen .srg2Meta{grid-column:1;grid-row:2;display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:#51697f;font-size:11px;font-weight:900}
      #stockEditScreen .srg2Collapse{grid-column:2;grid-row:1 / span 2;width:36px;height:36px;border:0;border-radius:50%;background:#fff9;color:#17314d;font-weight:950;font-size:16px;padding:0}
      #stockEditScreen .srg2Article.srg2Collapsed .srg2Variants{display:none}
      #stockEditScreen .srg2Variants{margin-top:8px}
      #stockEditScreen .srg2Variant{background:#fffdf9;border:1px solid rgba(23,49,77,.09);border-radius:17px;padding:11px;margin:9px 0;box-shadow:0 5px 14px rgba(23,49,77,.05)}
      #stockEditScreen .srg2Variant.deleted{opacity:.58;background:#f5f6f7}
      #stockEditScreen .srg2VariantTop{display:grid;grid-template-columns:minmax(70px,.72fr) minmax(112px,1.1fr);gap:7px;align-items:end}
      #stockEditScreen .srg2Variant label{margin:0;font-size:11px;color:#51697f;font-weight:900}
      #stockEditScreen .srg2Variant .field{min-height:48px;font-size:16px;border-radius:13px;padding:7px 9px;margin-top:4px}
      #stockEditScreen .srg2Qty{margin-top:8px}
      #stockEditScreen .srg2Actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px}
      #stockEditScreen .srg2Delete{min-height:42px;border:0;border-radius:12px;background:#fde8e6;color:#9a342f;font-weight:950;padding:0 12px;font-size:12px;white-space:nowrap}
      #stockEditScreen .srg2Delete.restore{background:#e4f4ec;color:#14633f}
      #stockEditScreen .srg2Flag{display:flex;align-items:center;gap:7px;background:#edf3f8;border-radius:12px;padding:6px 9px;color:#40566a;font-size:11px;font-weight:950;cursor:pointer}
      #stockEditScreen .srg2Flag.checked{background:#e2f5e9;color:#14633f}
      #stockEditScreen .srg2Flag input{width:21px;height:21px;margin:0;accent-color:#00a45b}
      #stockEditScreen .srg2Position{margin-top:8px;border-top:1px solid #e6e7e8;padding-top:7px}
      #stockEditScreen .srg2Position summary{cursor:pointer;color:#53697d;font-size:11px;font-weight:950;list-style:none;user-select:none}
      #stockEditScreen .srg2Position summary::-webkit-details-marker{display:none}
      #stockEditScreen .srg2PosGrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}
      #stockEditScreen .srg2Original{margin-top:6px;font-size:10px;color:#718295;font-weight:800}
      #stockEditScreen .srg2AddVariant{width:100%;min-height:46px;border:1px dashed #365f7d66;border-radius:14px;background:#ffffff72;color:#244d68;font-weight:950;margin-top:7px}
      #stockEditScreen #stockEditEditor>.btn.soft{display:none!important}

      /* exactly one floating ADD button in direct rectification */
      #stockQuickFoundDirectV3,#srgAddArticleFloat{display:none!important}
      #srg2AddFloat{position:fixed;right:max(18px,calc((100vw - 560px)/2 + 18px));bottom:max(18px,env(safe-area-inset-bottom));z-index:46;border:0;border-radius:999px;min-height:56px;background:#17314d;color:#fff;box-shadow:0 12px 28px rgba(23,49,77,.23);font-weight:950;font-size:16px;padding:0 19px;display:none}
      #stockEditScreen.on #stockEditEditor:not(.hidden) #srg2AddFloat{display:block}

      @media(max-width:430px){#stockEditScreen .srg2Code{font-size:clamp(18px,5.3vw,21px)}#srg2AddFloat{right:18px}.srg2VariantTop{gap:6px}}
      @media(max-width:360px){#stockEditScreen .srg2VariantTop,#stockEditScreen .srg2PosGrid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function groups(){
    const out=[],map=new Map();
    draft().forEach((row,index)=>{
      const code=norm(row.article_base),key=code||`__NEW__${row.edit_id||index}`;
      let g=map.get(key);if(!g){g={key,code,rows:[]};map.set(key,g);out.push(g)}
      g.rows.push(row);
    });
    return out;
  }
  function options(current){return stateList().map(s=>`<option ${norm(s)===norm(current)?'selected':''}>${escHtml(s)}</option>`).join('')}
  function isFlagged(r){try{return !!window.WarehouseRectificationFlags?.isFlagged?.(r)}catch{return false}}

  function variantHtml(r){
    const disabled=r.deleted?'disabled':'',flagged=isFlagged(r);
    const original=r.original?`${escHtml(r.original.size||'—')} · ${Number(r.original.quantity)||0} · ${escHtml(r.original.state||'—')}`:'Nuova variante';
    return `<div class="srg2Variant ${r.deleted?'deleted':''}" data-edit-id="${escHtml(r.edit_id)}">
      <div class="srg2VariantTop">
        <label>TAGLIA<input class="field" ${disabled} value="${escHtml(r.size||'')}" oninput="editStockDraft('${r.edit_id}','size',this.value)"></label>
        <label>STATO<select class="field" ${disabled} onchange="editStockDraft('${r.edit_id}','state',this.value)">${options(r.state)}</select></label>
      </div>
      <div class="srg2Qty"><label>QUANTITÀ<input class="field" ${disabled} type="number" min="0" value="${Number(r.quantity)||0}" oninput="editStockDraft('${r.edit_id}','quantity',this.value)"></label></div>
      <div class="srg2Actions">
        <button type="button" class="srg2Delete ${r.deleted?'restore':''}" onclick="toggleStockEditDelete('${r.edit_id}')">${r.deleted?'RIPRISTINA':'ELIMINA'}</button>
        <label class="srg2Flag ${flagged?'checked':''}"><input type="checkbox" ${disabled} ${flagged?'checked':''} onchange="setDirectRectFlagV2('${r.edit_id}',this.checked)"><span>MODIFICATO</span></label>
      </div>
      <div class="srg2Original">Prima: ${original}</div>
      <details class="srg2Position"><summary>▾ POSIZIONE</summary><div class="srg2PosGrid">
        <label>FILA/SCAFFALE<input class="field" ${disabled} value="${escHtml(r.fila_scaffale||'')}" oninput="editStockDraft('${r.edit_id}','fila_scaffale',this.value)"></label>
        <label>BANCALE/CARRELLO<input class="field" ${disabled} value="${escHtml(r.bancale||'')}" oninput="editStockDraft('${r.edit_id}','bancale',this.value)"></label>
      </div></details>
    </div>`;
  }

  function groupHtml(g,index){
    const ids=encodeURIComponent(JSON.stringify(g.rows.map(r=>r.edit_id))),active=g.rows.filter(r=>!r.deleted).length,flagged=g.rows.filter(r=>!r.deleted&&isFlagged(r)).length;
    const isCollapsed=collapsed.has(g.key);
    return `<section class="srg2Article ${index%2?'toneB':'toneA'} ${isCollapsed?'srg2Collapsed':''}" data-key="${escHtml(g.key)}">
      <div class="srg2Head">
        <input class="srg2Code" value="${escHtml(g.code)}" placeholder="CODICE ARTICOLO" aria-label="Codice articolo" onchange="renameDirectRectGroupV2('${ids}',this.value)">
        <div class="srg2Meta"><span>${active===1?'1 variante':active+' varianti'}</span><span>·</span><span>${flagged}/${active} modificate</span></div>
        <button type="button" class="srg2Collapse" onclick="toggleDirectRectGroupV2('${encodeURIComponent(g.key)}')">${isCollapsed?'⌄':'⌃'}</button>
      </div>
      <div class="srg2Variants">${g.rows.map(variantHtml).join('')}<button type="button" class="srg2AddVariant" onclick="addDirectRectVariantV2('${ids}')">＋ AGGIUNGI TAGLIA / STATO</button></div>
    </section>`;
  }

  function summaryText(){
    const rows=draft(),active=rows.filter(r=>!r.deleted),gs=groups(),src=source(),flagged=active.filter(isFlagged).length;
    const where=[src.fila_scaffale?`Fila/Scaffale ${norm(src.fila_scaffale)}`:'',src.bancale?`Bancale/Carrello ${norm(src.bancale)}`:''].filter(Boolean).join(' · ');
    return `${where}${where?' · ':''}${gs.length} articoli · ${active.length} varianti attive · MODIFICATI ${flagged}/${active.length}`;
  }

  function removeLegacyFloats(){
    $('stockQuickFoundDirectV3')?.remove();
    $('srgAddArticleFloat')?.remove();
  }
  function ensureFloat(){
    removeLegacyFloats();const editor=$('stockEditEditor');if(!editor)return;
    let b=$('srg2AddFloat');if(!b){b=document.createElement('button');b.id='srg2AddFloat';b.type='button';b.textContent='＋ AGGIUNGI';b.onclick=()=>{if(typeof window.openStockQuickFoundV3==='function')window.openStockQuickFoundV3('direct');else if(typeof window.addStockEditRow==='function')window.addStockEditRow()};editor.appendChild(b)}
  }

  function renderGrouped(){
    injectCss();removeLegacyFloats();const host=$('stockEditRows');if(!host)return false;
    const summary=$('stockEditSummary');if(summary)summary.textContent=summaryText();
    const gs=groups();host.innerHTML=gs.length?gs.map(groupHtml).join(''):'<div class="status warn">Nessuna riga da rettificare.</div>';
    host.dataset.directRectGroupedV2='1';ensureFloat();return true;
  }

  function ensureAuthoritativeRenderer(){
    if(window.renderStockEditRows===renderGrouped)return;
    window.renderStockEditRows=renderGrouped;
  }
  function scheduleEnsure(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;removeLegacyFloats();const screen=$('stockEditScreen'),editor=$('stockEditEditor'),host=$('stockEditRows');if(!screen?.classList.contains('on')||editor?.classList.contains('hidden')||!draft().length)return;ensureAuthoritativeRenderer();if(host&&!host.querySelector(':scope > .srg2Article'))renderGrouped()})}

  function wrapOperation(name){
    const base=window[name];if(typeof base!=='function'||base.__directRectGroupedV2)return;
    const wrapped=function(){const out=base.apply(this,arguments);queueMicrotask(()=>{ensureAuthoritativeRenderer();if(draft().length&&!$('stockEditEditor')?.classList.contains('hidden'))renderGrouped()});return out};
    wrapped.__directRectGroupedV2=true;wrapped.__previous=base;window[name]=wrapped;
  }
  function patchCompetingInstallers(){
    const manual=window.WarehouseManualEditRequestRefreshFix;if(manual&&typeof manual.install==='function'&&!manual.install.__directRectGroupedV2){const base=manual.install;manual.install=function(){const out=base.apply(this,arguments);queueMicrotask(()=>{ensureAuthoritativeRenderer();scheduleEnsure()});return out};manual.install.__directRectGroupedV2=true}
    const assist=window.WarehouseStockControlAssistedV3;if(assist&&typeof assist.install==='function'&&!assist.install.__directRectGroupedV2){const base=assist.install;assist.install=function(){const out=base.apply(this,arguments);queueMicrotask(()=>{removeLegacyFloats();ensureAuthoritativeRenderer();scheduleEnsure()});return out};assist.install.__directRectGroupedV2=true}
  }

  window.toggleDirectRectGroupV2=function(keyEncoded){const key=decodeURIComponent(keyEncoded);collapsed.has(key)?collapsed.delete(key):collapsed.add(key);renderGrouped()};
  window.renameDirectRectGroupV2=function(idsEncoded,value){const ids=JSON.parse(decodeURIComponent(idsEncoded)),code=typeof normalizeArticle==='function'?normalizeArticle(value):norm(value);ids.forEach(id=>{const r=findDraft(id);if(r)r.article_base=code});renderGrouped()};
  window.addDirectRectVariantV2=function(idsEncoded){const ids=JSON.parse(decodeURIComponent(idsEncoded)),base=ids.length?findDraft(ids[0]):null,src=source();if(!base)return;const newId=typeof uid==='function'?uid():`${Date.now()}-${Math.random().toString(36).slice(2)}`;draft().push({edit_id:newId,original:null,deleted:false,article_base:norm(base.article_base),size:'',quantity:0,state:'NUOVO',fila_scaffale:norm(base.fila_scaffale||src.fila_scaffale),bancale:norm(base.bancale||src.bancale)});collapsed.delete(norm(base.article_base));renderGrouped()};
  window.setDirectRectFlagV2=function(id,checked){const r=findDraft(id);if(!r)return;try{window.WarehouseRectificationFlags?.setFlag?.(r,!!checked)}catch{}renderGrouped()};

  function install(){
    injectCss();removeLegacyFloats();patchCompetingInstallers();
    ['loadStockPallet','addStockEditRow','toggleStockEditDelete'].forEach(wrapOperation);
    ensureAuthoritativeRenderer();ensureFloat();
    if(!observer){const root=$('stockEditScreen')||document.querySelector('main')||document.body;observer=new MutationObserver(scheduleEnsure);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})}
    scheduleEnsure();return true;
  }

  window.WarehouseDirectRectificationGroupedV2={version:VERSION,install,renderGrouped,groups,ensureAuthoritativeRenderer,removeLegacyFloats};
  install();
})();
