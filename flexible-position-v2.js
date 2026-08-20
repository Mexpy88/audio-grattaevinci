/* Flexible Position V2 — ogni giacenza può avere Fila/Scaffale, Bancale/Carrello oppure entrambi. */
(function installFlexiblePositionV2(){
  'use strict';
  if(window.WarehouseFlexiblePositionV2)return;
  const norm=v=>String(v??'').trim().toUpperCase();
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const artOf=r=>typeof normalizeArticle==='function'?normalizeArticle(r?.article_base||''):norm(r?.article_base||'');
  const posOk=r=>!!(locOf(r)||norm(r?.bancale));
  const rowKey=r=>[artOf(r),norm(r?.size),norm(r?.state||'NON_CHIARO'),locOf(r),norm(r?.bancale)].join('|');
  const nowIso=()=>new Date().toISOString();
  function normalizeRow(r){return {article_base:artOf(r),size:norm(r?.size),quantity:Math.max(0,Number(r?.quantity)||0),state:norm(r?.state||'NON_CHIARO'),fila_scaffale:locOf(r),fila:locOf(r),scaffale:'',bancale:norm(r?.bancale)}}
  function same(a,b){if(!a||!b)return a===b;return rowKey(a)===rowKey(b)&&Math.abs(Number(a.quantity||0)-Number(b.quantity||0))<1e-9}
  function describe(before,after){
    const p=[];if(!before&&after)return `RETTIFICA AGGIUNTA · ${after.quantity} pezzi`;if(before&&!after)return `RETTIFICA RIMOZIONE · ${before.quantity} pezzi`;if(!before||!after)return 'RETTIFICA';
    if(artOf(before)!==artOf(after))p.push(`Articolo: ${artOf(before)||'—'} → ${artOf(after)||'—'}`);
    if(norm(before.size)!==norm(after.size))p.push(`Taglia: ${norm(before.size)||'—'} → ${norm(after.size)||'—'}`);
    if(norm(before.state)!==norm(after.state))p.push(`Stato: ${norm(before.state)||'—'} → ${norm(after.state)||'—'}`);
    if(locOf(before)!==locOf(after))p.push(`Fila/Scaffale: ${locOf(before)||'—'} → ${locOf(after)||'—'}`);
    if(norm(before.bancale)!==norm(after.bancale))p.push(`Bancale/Carrello: ${norm(before.bancale)||'—'} → ${norm(after.bancale)||'—'}`);
    if(Number(before.quantity||0)!==Number(after.quantity||0))p.push(`Quantità: ${Number(before.quantity||0)} → ${Number(after.quantity||0)}`);
    return 'RETTIFICA · '+(p.join(' · ')||'dati confermati');
  }
  function validateBefore(changes){
    const available=new Map((typeof stockBuckets==='function'?stockBuckets():[]).map(x=>[rowKey(x),Number(x.quantity||0)])),needed=new Map();
    for(const c of changes){if(!c.before)continue;const k=rowKey(c.before);needed.set(k,(needed.get(k)||0)+Number(c.before.quantity||0))}
    for(const [k,q] of needed){if((available.get(k)||0)+1e-9<q)return {ok:false,available:available.get(k)||0,needed:q}}
    return {ok:true};
  }
  function showUndo(batchId,count){
    document.getElementById('uxSnackbar')?.remove();const s=document.createElement('div');s.id='uxSnackbar';s.className='uxSnackbar';s.innerHTML=`<span>${count} rettifiche salvate · Nessun CARICA/SCARICA creato.</span><button type="button">ANNULLA</button>`;document.body.appendChild(s);s.querySelector('button').onclick=()=>window.undoRectificationBatch?.(batchId);setTimeout(()=>s.remove(),15000);
  }
  window.saveStockEdit=function(){
    if(!requireLogin())return;if(!stockEditRowsDraft?.length)return alert('Cerca prima una posizione da modificare.');
    const changes=[];
    for(const draft of stockEditRowsDraft){
      const before=draft.original?normalizeRow(draft.original):null;
      const after=(!draft.deleted&&Number(draft.quantity)>0)?normalizeRow(draft):null;
      if(after){if(!after.article_base)return alert('Completa il codice articolo in tutte le righe attive.');if(!posOk(after))return alert('Ogni riga attiva deve avere almeno Fila/Scaffale oppure Bancale/Carrello.')}
      if(same(before,after)||(!before&&!after))continue;changes.push({before,after});
    }
    if(!changes.length)return alert('Nessuna modifica da salvare.');
    const check=validateBefore(changes);if(!check.ok)return alert(`La giacenza è cambiata. Disponibili ${check.available}, attesi ${check.needed}. Ricarica la posizione e riprova.`);
    const lines=changes.map(c=>describe(c.before,c.after)).join('\n');if(!confirm(`Confermi ${changes.length} rettifiche?\n\n${lines}\n\nNon verrà creato alcun CARICA o SCARICA.`))return;
    if(!Array.isArray(db.rectifications))db.rectifications=[];const batchId=uid(),at=nowIso();
    for(const c of changes){const r={id:uid(),batch_id:batchId,type:'RETTIFICA',operator:operatorName(),registered_at:at,operation_at:at,updated_at:at,cancelled_at:null,before:c.before?clone(c.before):null,after:c.after?clone(c.after):null,note:describe(c.before,c.after)};db.rectifications.unshift(r);if(typeof audit==='function')audit('CREATE','RECTIFICATION',r.id,null,clone(r))}
    saveDb();const remaining=window.stockEditRowsAtSource?.()||[];
    if(remaining.length){stockEditBuildDraft(remaining);renderStockEditRows();setStatus('stockEditSearchStatus',`Rettifiche salvate. Restano ${remaining.length} righe nella posizione di origine.`,'good')}else{stockEditRowsDraft=[];document.getElementById('stockEditRows').innerHTML='';document.getElementById('stockEditEditor').classList.add('hidden');setStatus('stockEditSearchStatus','Rettifica salvata. La posizione di origine non contiene più giacenze.','good')}
    window.renderStock?.();window.renderRegistry?.();LocalMaster?.renderPanel?.();showUndo(batchId,changes.length);if(typeof warehouseToast==='function')warehouseToast('Rettifica salvata.','success');
  };
  window.WarehouseFlexiblePositionV2={version:'2026.08.20-1',posOk};
})();
