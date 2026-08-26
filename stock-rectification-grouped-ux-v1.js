/* Direct Rectification Grouped UX V1
   Presentation layer only: groups stockEditRowsDraft by article while preserving
   the existing rettification engine, history and Excel semantics. */
(function installWarehouseDirectRectificationGroupedV1(){
  'use strict';
  if(window.WarehouseDirectRectificationGroupedV1)return;
  const VERSION='2026.08.26-direct-rect-grouped1';
  const collapsed=new Set();
  const $=id=>document.getElementById(id);
  const norm=v=>String(v??'').trim().toUpperCase();
  const escHtml=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const states=()=>Array.isArray(window.STATES)?window.STATES:(typeof STATES!=='undefined'&&Array.isArray(STATES)?STATES:['NUOVO','SCARICATO','USATO','DISMESSO','NON_CHIARO']);
  let installed=false;

  function injectCss(){
    if($('directRectGroupedV1Css'))return;
    const s=document.createElement('style');s.id='directRectGroupedV1Css';s.textContent=`
      /* Clear semantic choice between the two verification modes */
      #mgrStockControlHub .mgrActionGrid>.mgrAction:first-child{background:#fff0e3!important;border-color:#edc29b!important;box-shadow:0 8px 24px rgba(166,91,24,.09)!important}
      #mgrStockControlHub .mgrActionGrid>.mgrAction:first-child .icon,#mgrStockControlHub .mgrActionGrid>.mgrAction:first-child b{color:#9a5420!important}
      #mgrStockControlHub .mgrActionGrid>.mgrAction:nth-child(2){background:#e6f5f3!important;border-color:#b7ddd7!important;box-shadow:0 8px 24px rgba(24,108,99,.09)!important}
      #mgrStockControlHub .mgrActionGrid>.mgrAction:nth-child(2) .icon,#mgrStockControlHub .mgrActionGrid>.mgrAction:nth-child(2) b{color:#176c63!important}

      /* Grouped direct-rectification cards */
      #stockEditScreen .srgArticleGroup{border:1px solid transparent;border-radius:20px;padding:10px;margin:10px 0;transition:.16s ease}
      #stockEditScreen .srgArticleGroup.toneA{background:#e7c89f;border-color:#d1aa75}
      #stockEditScreen .srgArticleGroup.toneB{background:#fff0d0;border-color:#e4c99b}
      #stockEditScreen .srgArticleHead{display:grid;grid-template-columns:minmax(0,1fr) 40px;grid-template-rows:auto auto;column-gap:8px;row-gap:4px;align-items:center;min-height:52px}
      #stockEditScreen .srgArticleInput{grid-column:1;grid-row:1;width:100%;min-width:0;border:0;background:transparent;color:#17314d;font-weight:950;font-size:clamp(19px,5.5vw,23px);line-height:1.04;padding:2px 0;outline:none;text-transform:uppercase;white-space:nowrap}
      #stockEditScreen .srgArticleInput:focus{background:#ffffffa8;border-radius:10px;padding:5px 7px;box-shadow:0 0 0 2px #2c60aa30}
      #stockEditScreen .srgArticleMeta{grid-column:1;grid-row:2;color:#51697f;font-size:11px;font-weight:900;white-space:nowrap}
      #stockEditScreen .srgCollapse{grid-column:2;grid-row:1 / span 2;width:38px;height:38px;border:0;border-radius:50%;background:#fff8;color:#17314d;font-weight:950;font-size:17px;padding:0}
      #stockEditScreen .srgVariants{margin-top:9px}
      #stockEditScreen .srgArticleGroup.srgCollapsed .srgVariants{display:none}
      #stockEditScreen .srgVariant{background:#fffdf9;border:1px solid rgba(23,49,77,.08);border-radius:17px;padding:11px;margin:9px 0;box-shadow:0 5px 14px rgba(23,49,77,.05)}
      #stockEditScreen .srgVariant.deleted{opacity:.58;background:#f5f6f7}
      #stockEditScreen .srgVariantTop{display:grid;grid-template-columns:minmax(78px,.7fr) minmax(120px,1.15fr) auto;gap:8px;align-items:end}
      #stockEditScreen .srgVariant label{margin:0;font-size:11px;color:#51697f;font-weight:900}
      #stockEditScreen .srgVariant .field{min-height:48px;font-size:16px;border-radius:13px;padding:7px 9px;margin-top:4px}
      #stockEditScreen .srgQtyRow{display:grid;grid-template-columns:1fr;gap:8px;margin-top:8px}
      #stockEditScreen .srgDelete{height:48px;align-self:end;border:0;border-radius:13px;background:#fde8e6;color:#9a342f;font-weight:950;padding:0 11px;font-size:12px;white-space:nowrap}
      #stockEditScreen .srgDelete.restore{background:#e4f4ec;color:#14633f}
      #stockEditScreen .srgPosition{margin-top:8px;border-top:1px solid #e6e7e8;padding-top:7px}
      #stockEditScreen .srgPosition summary{cursor:pointer;color:#53697d;font-size:11px;font-weight:950;list-style:none;user-select:none}
      #stockEditScreen .srgPosition summary::-webkit-details-marker{display:none}
      #stockEditScreen .srgPosGrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}
      #stockEditScreen .srgAddVariant{width:100%;min-height:46px;border:1px dashed #365f7d66;border-radius:14px;background:#ffffff72;color:#244d68;font-weight:950;margin-top:7px}
      #stockEditScreen #stockEditEditor>.btn.soft{display:none!important}
      #srgAddArticleFloat{position:fixed;right:max(20px,calc((100vw - 560px)/2 + 20px));bottom:22px;z-index:28;border:0;border-radius:999px;background:#17314d;color:#fff;box-shadow:0 12px 28px #17314d35;font-weight:950;font-size:16px;padding:15px 19px;display:none}
      #stockEditScreen.on #stockEditEditor:not(.hidden) #srgAddArticleFloat{display:block}
      @media(max-width:430px){
        #stockEditScreen .srgVariantTop{grid-template-columns:minmax(70px,.72fr) minmax(112px,1.12fr) auto;gap:6px}
        #stockEditScreen .srgArticleInput{font-size:clamp(18px,5.4vw,21px)}
        #stockEditScreen .srgDelete{padding:0 9px;font-size:11px}
        #srgAddArticleFloat{right:18px;bottom:18px}
      }
      @media(max-width:360px){#stockEditScreen .srgVariantTop{grid-template-columns:1fr 1fr}.srgDelete{grid-column:1/-1;width:100%}#stockEditScreen .srgPosGrid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function draft(){try{return stockEditRowsDraft}catch{return []}}
  function source(){try{return stockEditSource}catch{return {fila_scaffale:'',bancale:''}}}
  function groupRows(){
    const groups=[],map=new Map();
    draft().forEach((row,index)=>{
      const code=norm(row.article_base),key=code||`__NEW__${row.edit_id||index}`;
      let g=map.get(key);if(!g){g={key,code,rows:[],first:index};map.set(key,g);groups.push(g)}
      g.rows.push({row,index});
    });
    return groups;
  }
  function stateOptions(current){return states().map(s=>`<option ${norm(s)===norm(current)?'selected':''}>${escHtml(s)}</option>`).join('')}
  function variantHtml(item){
    const r=item.row,disabled=r.deleted?'disabled':'';
    const original=r.original?`${escHtml(r.original.size||'—')} · ${Number(r.original.quantity)||0} · ${escHtml(r.original.state||'—')}`:'Nuova variante';
    return `<div class="srgVariant stockEditRow ${r.deleted?'deleted':''}" data-edit-id="${escHtml(r.edit_id)}">
      <div class="srgVariantTop">
        <label>TAGLIA<input class="field" ${disabled} value="${escHtml(r.size||'')}" oninput="editStockDraft('${r.edit_id}','size',this.value)"></label>
        <label>STATO<select class="field" ${disabled} onchange="editStockDraft('${r.edit_id}','state',this.value)">${stateOptions(r.state)}</select></label>
        <button type="button" class="srgDelete ${r.deleted?'restore':''}" onclick="toggleStockEditDelete('${r.edit_id}')">${r.deleted?'RIPRISTINA':'ELIMINA'}</button>
      </div>
      <div class="srgQtyRow"><label>QUANTITÀ<input class="field" ${disabled} type="number" min="0" value="${Number(r.quantity)||0}" oninput="editStockDraft('${r.edit_id}','quantity',this.value)"></label></div>
      <div style="margin-top:6px;font-size:10px;color:#718295;font-weight:800">Prima: ${original}</div>
      <details class="srgPosition"><summary>▾ POSIZIONE</summary><div class="srgPosGrid">
        <label>FILA/SCAFFALE<input class="field" ${disabled} value="${escHtml(r.fila_scaffale||'')}" oninput="editStockDraft('${r.edit_id}','fila_scaffale',this.value)"></label>
        <label>BANCALE/CARRELLO<input class="field" ${disabled} value="${escHtml(r.bancale||'')}" oninput="editStockDraft('${r.edit_id}','bancale',this.value)"></label>
      </div></details>
    </div>`;
  }
  function groupHtml(group,idx){
    const ids=encodeURIComponent(JSON.stringify(group.rows.map(x=>x.row.edit_id)));
    const isCollapsed=collapsed.has(group.key);
    const active=group.rows.filter(x=>!x.row.deleted).length;
    const label=active===1?'1 variante':`${active} varianti`;
    return `<section class="srgArticleGroup ${idx%2?'toneB':'toneA'} ${isCollapsed?'srgCollapsed':''}" data-group-key="${escHtml(group.key)}">
      <div class="srgArticleHead">
        <input class="srgArticleInput" aria-label="Codice articolo" value="${escHtml(group.code)}" placeholder="CODICE ARTICOLO" onchange="editStockGroupArticleV1('${ids}',this.value)">
        <div class="srgArticleMeta">${label}${group.rows.length!==active?` · ${group.rows.length-active} eliminata/e`:''}</div>
        <button type="button" class="srgCollapse" onclick="toggleStockGroupV1('${encodeURIComponent(group.key)}')">${isCollapsed?'⌄':'⌃'}</button>
      </div>
      <div class="srgVariants">${group.rows.map(variantHtml).join('')}<button type="button" class="srgAddVariant" onclick="addStockVariantV1('${ids}')">＋ AGGIUNGI TAGLIA / STATO</button></div>
    </section>`;
  }

  function renderGrouped(){
    injectCss();const rows=draft(),host=$('stockEditRows');if(!host)return false;
    const active=rows.filter(r=>!r.deleted).length,src=source();
    const summary=$('stockEditSummary');if(summary)summary.textContent=`${src.fila_scaffale?`Fila/Scaffale ${src.fila_scaffale}`:''}${src.fila_scaffale&&src.bancale?' · ':''}${src.bancale?`Bancale/Carrello ${src.bancale}`:''} · ${active} righe attive`;
    const groups=groupRows();host.innerHTML=groups.length?groups.map(groupHtml).join(''):'<div class="status warn">Nessuna riga da rettificare.</div>';
    ensureFloat();return true;
  }

  function ensureFloat(){
    const editor=$('stockEditEditor');if(!editor||$('srgAddArticleFloat'))return;
    const b=document.createElement('button');b.id='srgAddArticleFloat';b.type='button';b.textContent='＋ AGGIUNGI';b.onclick=()=>{if(typeof addStockEditRow==='function')addStockEditRow()};editor.appendChild(b);
  }

  window.toggleStockGroupV1=function(encodedKey){const key=decodeURIComponent(encodedKey);collapsed.has(key)?collapsed.delete(key):collapsed.add(key);renderGrouped()};
  window.editStockGroupArticleV1=function(encodedIds,value){
    const ids=JSON.parse(decodeURIComponent(encodedIds)),code=typeof normalizeArticle==='function'?normalizeArticle(value):norm(value);
    for(const id of ids){const r=typeof stockEditFind==='function'?stockEditFind(id):draft().find(x=>x.edit_id===id);if(r)r.article_base=code}
    renderGrouped();
  };
  window.addStockVariantV1=function(encodedIds){
    const ids=JSON.parse(decodeURIComponent(encodedIds)),base=ids.length?(typeof stockEditFind==='function'?stockEditFind(ids[0]):draft().find(x=>x.edit_id===ids[0])):null,src=source();
    if(!base)return;
    const makeId=typeof uid==='function'?uid():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    draft().push({edit_id:makeId,original:null,deleted:false,article_base:norm(base.article_base),size:'',quantity:0,state:'NUOVO',fila_scaffale:norm(base.fila_scaffale||src.fila_scaffale),bancale:norm(base.bancale||src.bancale)});
    collapsed.delete(norm(base.article_base));renderGrouped();
  };

  function install(){
    if(installed){injectCss();ensureFloat();return true}installed=true;injectCss();
    if(typeof window.renderStockEditRows==='function'&&!window.renderStockEditRows.__groupedRectV1){
      const base=window.renderStockEditRows;const wrapped=function(){return renderGrouped()||base.apply(this,arguments)};wrapped.__groupedRectV1=true;wrapped.__previous=base;window.renderStockEditRows=wrapped;
    }
    ensureFloat();return true;
  }
  window.WarehouseDirectRectificationGroupedV1={version:VERSION,install,renderGrouped,groupRows};
  install();
})();
