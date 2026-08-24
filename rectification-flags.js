/* Persistent checklist flags for MODIFICA / rettifiche.
   A flag belongs to one physical Master identity: FILA + BANCALE + ARTICOLO + TAGLIA.
   It is app-only metadata, is preserved in APP_DATI, and does not alter the A:I Master schema. */
(function installRectificationFlags(){
  'use strict';
  if(window.WarehouseRectificationFlags)return;

  const VERSION='2026.08.24-rect-flags1';
  const STORE='rectification_flags';
  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const article=v=>window.WarehouseMasterSchemaV4?.normalizeArticle?.(v)||norm(v);
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const nowIso=()=>new Date().toISOString();

  function flagKey(row){
    if(!row)return '';
    return [article(row.article_base),norm(row.size),locOf(row),norm(row.bancale)].join('|');
  }
  function ensureStore(){
    if(typeof db==='undefined')return {};
    if(!db[STORE]||typeof db[STORE]!=='object'||Array.isArray(db[STORE]))db[STORE]={};
    return db[STORE];
  }
  function markFor(row){const k=flagKey(row);return k?ensureStore()[k]||null:null}
  function isFlagged(row){return !!markFor(row)}
  function operator(){try{return typeof operatorName==='function'?operatorName():''}catch{return ''}}
  function save(){try{if(typeof saveDb==='function')saveDb()}catch(e){console.error('Salvataggio flag rettifica',e)}}
  function setFlag(row,flagged){
    const k=flagKey(row);if(!k)return false;const store=ensureStore();
    if(flagged){store[k]={flagged:true,at:nowIso(),operator:operator(),article_base:article(row.article_base),size:norm(row.size),fila_scaffale:locOf(row),bancale:norm(row.bancale)}}
    else delete store[k];
    save();return !!flagged;
  }
  function moveFlag(oldRow,newRow){
    const oldKey=flagKey(oldRow),newKey=flagKey(newRow);if(!oldKey||!newKey||oldKey===newKey)return false;
    const store=ensureStore(),mark=store[oldKey];if(!mark)return false;
    store[newKey]={...mark,at:nowIso(),operator:operator()||mark.operator,article_base:article(newRow.article_base),size:norm(newRow.size),fila_scaffale:locOf(newRow),bancale:norm(newRow.bancale)};
    let oldStillUsed=false;
    try{oldStillUsed=(stockEditRowsDraft||[]).some(r=>!r.deleted&&r!==newRow&&flagKey(r)===oldKey)}catch{}
    if(!oldStillUsed)delete store[oldKey];
    save();return true;
  }
  function uniqueDraftStats(){
    const keys=new Set(),flagged=new Set();
    try{for(const r of (stockEditRowsDraft||[])){if(r.deleted)continue;const k=flagKey(r);if(!k)continue;keys.add(k);if(ensureStore()[k])flagged.add(k)}}catch{}
    return {total:keys.size,flagged:flagged.size};
  }
  function syncDraftFlags(){
    try{for(const r of (stockEditRowsDraft||[]))r.rectification_flagged=isFlagged(r)}catch{}
  }

  function injectStyles(){
    if(document.getElementById('rectificationFlagsStyle'))return;
    const s=document.createElement('style');s.id='rectificationFlagsStyle';s.textContent=`
      .rectFlagWrap{display:flex;align-items:center;gap:8px;margin-left:auto;padding:5px 8px;border-radius:12px;background:#edf3f8;font-size:12px;font-weight:950;cursor:pointer;user-select:none}
      .rectFlagWrap input{width:22px;height:22px;margin:0;accent-color:#00a45b;cursor:pointer}
      .stockEditRow.rectFlagged{border-color:#72bd92!important;box-shadow:0 0 0 2px #00a45b18 inset}
      .stockEditRow.rectFlagged .rectFlagWrap{background:#e2f5e9;color:#14633f}
      .rectFlagMeta{font-size:11px;color:#65788c;margin:4px 0 0;text-align:right}
      .rectFlagSummary{font-weight:950;color:#14633f}
    `;document.head.appendChild(s);
  }

  let baseBuild=null,baseRender=null,baseEdit=null;

  function decorateRows(){
    syncDraftFlags();
    const nodes=[...document.querySelectorAll('#stockEditRows .stockEditRow')];
    let drafts=[];try{drafts=stockEditRowsDraft||[]}catch{}
    nodes.forEach((node,i)=>{
      const d=drafts[i];if(!d)return;const k=flagKey(d),checked=!!ensureStore()[k];node.classList.toggle('rectFlagged',checked);
      const head=node.querySelector('.stockEditHead');if(!head)return;head.querySelector('.rectFlagWrap')?.remove();head.querySelector('.rectFlagMeta')?.remove();
      const label=document.createElement('label');label.className='rectFlagWrap';label.title='Segna questa riga del Master come già controllata/modificata';
      const box=document.createElement('input');box.type='checkbox';box.checked=checked;box.disabled=!!d.deleted;box.setAttribute('aria-label','Articolo modificato');
      const span=document.createElement('span');span.textContent='MODIFICATO';label.append(box,span);head.appendChild(label);
      box.addEventListener('change',()=>{
        const same=[];try{for(const r of (stockEditRowsDraft||[]))if(!r.deleted&&flagKey(r)===k)same.push(r)}catch{}
        setFlag(d,box.checked);for(const r of same)r.rectification_flagged=box.checked;
        if(typeof window.renderStockEditRows==='function')window.renderStockEditRows();
      });
      const mark=ensureStore()[k];if(mark){const meta=document.createElement('div');meta.className='rectFlagMeta';const dt=mark.at?new Date(mark.at):null;const when=dt&&!Number.isNaN(dt.getTime())?dt.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';meta.textContent=[mark.operator,when].filter(Boolean).join(' · ');head.insertAdjacentElement('afterend',meta)}
    });
    const summary=document.getElementById('stockEditSummary'),st=uniqueDraftStats();if(summary){summary.querySelector('.rectFlagSummary')?.remove();const x=document.createElement('span');x.className='rectFlagSummary';x.textContent=` · MODIFICATI ${st.flagged}/${st.total}`;summary.appendChild(x)}
  }

  function installWrappers(){
    if(typeof window.stockEditBuildDraft==='function'&&!window.stockEditBuildDraft.__rectFlags){
      baseBuild=window.stockEditBuildDraft;const wrapped=function(...args){const out=baseBuild.apply(this,args);syncDraftFlags();return out};wrapped.__rectFlags=true;window.stockEditBuildDraft=wrapped;
    }
    if(typeof window.renderStockEditRows==='function'&&!window.renderStockEditRows.__rectFlags){
      baseRender=window.renderStockEditRows;const wrapped=function(...args){const out=baseRender.apply(this,args);decorateRows();return out};wrapped.__rectFlags=true;window.renderStockEditRows=wrapped;
    }
    if(typeof window.editStockDraft==='function'&&!window.editStockDraft.__rectFlags){
      baseEdit=window.editStockDraft;const wrapped=function(id,key,value){let d=null,oldSnapshot=null,wasFlagged=false;try{d=(stockEditRowsDraft||[]).find(r=>r.edit_id===id);if(d){oldSnapshot={...d};wasFlagged=isFlagged(d)}}catch{}
        const out=baseEdit.apply(this,arguments);
        if(d&&wasFlagged&&['article_base','size','fila_scaffale','bancale'].includes(key))moveFlag(oldSnapshot,d);
        if(d)d.rectification_flagged=isFlagged(d);return out};wrapped.__rectFlags=true;window.editStockDraft=wrapped;
    }
  }

  function install(){injectStyles();ensureStore();installWrappers();setTimeout(()=>{installWrappers();if(document.getElementById('stockEditRows')?.children.length)decorateRows()},100)}

  window.WarehouseRectificationFlags={version:VERSION,flagKey,isFlagged,setFlag,moveFlag,uniqueDraftStats,decorateRows,install};
  if(typeof document!=='undefined')install();
})();
