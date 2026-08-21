/* MASTER schema V4 — official workbook contract:
   A SCAFFALE/FILA | B BANCALE | C ARTICOLO | D TAGLIA | E NUOVO | F SCARICATO | G USATO | H NOTE | I DATA CONTROLLO QUANTITÀ
   Built on the confirmed stable bc5c469 base. No swipe/router hooks and no extra search input listener. */
(function installWarehouseMasterSchemaV4(){
  'use strict';
  if(window.WarehouseMasterSchemaV4)return;

  const VERSION='2026.08.21-master-v4';
  const VALID_STATES=['NUOVO','SCARICATO','USATO'];
  const DB_NAME='so_warehouse_files_v1',DB_STORE='files',DB_ACTIVE='active-master-xlsx',META_KEY='so_local_master_meta_v3';
  const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const DOCREL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const XMLNS='http://www.w3.org/XML/1998/namespace';
  const DATA_SHEET='APP_DATI';
  const parser=typeof DOMParser!=='undefined'?new DOMParser():null;
  const serializer=typeof XMLSerializer!=='undefined'?new XMLSerializer():null;
  let compatibilityMode=false;
  let schemaInternalZip=false;
  let schemaExport=null;
  let priorGenerate=null;
  let priorExport=null;
  let priorRenderPanel=null;
  let rectUndoBatch=null,rectUndoTimer=null;
  let pendingMasterBytesPromise=null,pendingMasterFileName='';

  const byId=id=>document.getElementById(id);
  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const html=v=>typeof esc==='function'?esc(v):text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nowIso=()=>new Date().toISOString();

  function normalizeArticleV4(value,vision=false){
    let x=text(value).trim().toUpperCase().replace(/\s+/g,' ');
    if(/^[I1]\s*\d/.test(x))x=x.replace(/\s+/g,'');
    if(vision&&/^1(?=[A-Z0-9])/.test(x))x='I'+x.slice(1);
    return x;
  }
  function articleCompareKey(value){return normalizeArticleV4(value).replace(/\s+/g,' ')}
  function searchArticleKey(value){return normalizeArticleV4(value).replace(/\s+/g,'')}
  function positionValid(location,pallet){return !!(norm(location)||norm(pallet))}
  function locOf(r){return norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''))}
  function masterNoteOf(r){return text(r?.master_note??'').trim()}
  function mergeNote(a,b){const parts=[...new Set([text(a).trim(),text(b).trim()].filter(Boolean))];return parts.join(' | ')}
  function rowKey(r){return [articleCompareKey(r?.article_base),norm(r?.size),norm(r?.state||'NON_CHIARO'),locOf(r),norm(r?.bancale)].join('|')}
  function identityKey(r){return [articleCompareKey(r?.article_base),norm(r?.size),locOf(r),norm(r?.bancale)].join('|')}
  function compatArticle(article,size){const a=normalizeArticleV4(article),s=norm(size);return s?`${a}-${s}`:a}
  function splitCompatArticle(value){const raw=normalizeArticleV4(value);if(!raw)return {article:'',size:''};const i=raw.lastIndexOf('-');if(i<=0)return {article:raw,size:''};return {article:raw.slice(0,i),size:raw.slice(i+1)}}

  function headerNorm(v){return typeof masterNormHeader==='function'?masterNormHeader(v):norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9/]+/g,' ').trim()}
  function definitiveMasterColumnsV4(headers){
    const h=(headers||[]).map(headerNorm),find=(...names)=>h.findIndex(x=>names.includes(x));
    return {
      location:find('SCAFFALE / FILA','SCAFFALE/FILA','SCAFFALE FILA'),
      bancale:find('BANCALE'),
      article:find('ARTICOLO'),
      size:find('TAGLIA'),
      nuovo:find('NUOVO'),
      scaricato:find('SCARICATO'),
      usato:find('USATO'),
      note:find('NOTE','NOTA'),
      controlDate:find('DATA CONTROLLO QUANTITA')
    };
  }
  function isDefinitiveMasterV4(c){return !!c&&c.location>=0&&c.bancale>=0&&c.article>=0&&c.size>=0&&c.nuovo>=0&&c.scaricato>=0&&c.usato>=0&&c.note>=0&&c.controlDate>=0}

  function exposeBaseOverrides(){
    window.normalizeArticle=normalizeArticleV4;
    window.searchNorm=s=>searchArticleKey(s).replace(/^1(?=[A-Z0-9])/,'I');
    window.articleMatches=(a,q)=>{const A=searchArticleKey(a),Q=searchArticleKey(q);return !Q||A.includes(Q)};
    window.definitiveMasterColumns=definitiveMasterColumnsV4;
    window.isDefinitiveMaster=isDefinitiveMasterV4;
    window.splitMasterArticleSize=value=>compatibilityMode?splitCompatArticle(value):{article:normalizeArticleV4(value),size:''};
  }

  function prepareMasterSheetV4(){
    if(!masterWorkbook)return;
    const name=byId('masterSheet').value||masterWorkbook.SheetNames[0],ws=masterWorkbook.Sheets[name];
    masterMatrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,blankrows:false});
    masterHeaderRow=detectMasterHeader(masterMatrix);
    const headers=(masterMatrix[masterHeaderRow]||[]).map(v=>text(v).trim());
    byId('mapArticle').innerHTML=masterOptions(headers,'article',false);byId('mapSize').innerHTML=masterOptions(headers,'size',true);byId('mapQty').innerHTML=masterOptions(headers,'qty',false);byId('mapState').innerHTML=masterOptions(headers,'state',true);byId('mapLocation').innerHTML=masterOptions(headers,'location',true);byId('mapFila').innerHTML=masterOptions(headers,'fila',true);byId('mapScaffale').innerHTML=masterOptions(headers,'scaffale',true);byId('mapBancale').innerHTML=masterOptions(headers,'bancale',true);
    const c=definitiveMasterColumnsV4(headers),recognized=isDefinitiveMasterV4(c);setDefinitiveMasterUi(recognized);
    if(recognized){
      byId('mapArticle').value=String(c.article);byId('mapSize').value=String(c.size);byId('mapLocation').value=String(c.location);byId('mapFila').value='';byId('mapScaffale').value='';byId('mapBancale').value=String(c.bancale);byId('mapState').value='';byId('mapQty').value=String(c.nuovo);
      byId('masterPreviewInfo').className='status good';
      byId('masterPreviewInfo').textContent=`MASTER V4 riconosciuto. ${Math.max(0,masterMatrix.length-masterHeaderRow-1)} righe Excel. ARTICOLO, TAGLIA e NOTE resteranno separati; NUOVO, SCARICATO e USATO verranno letti dalle rispettive colonne.`;
    }else{
      byId('masterPreviewInfo').className='status error';
      byId('masterPreviewInfo').textContent='Struttura Master non valida. Servono le colonne: SCAFFALE / FILA, BANCALE, ARTICOLO, TAGLIA, NUOVO, SCARICATO, USATO, NOTE, DATA CONTROLLO QUANTITÀ.';
    }
  }

  function parseQty(v){if(typeof v==='number')return Number.isFinite(v)?v:0;const n=Number(text(v).trim().replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)?n:0}
  function parseMasterRowsV4(matrix,headerRow,headers){
    const c=definitiveMasterColumnsV4(headers),rows=[];if(!isDefinitiveMasterV4(c))return rows;let excelRow=headerRow+2;
    for(const row of (matrix||[]).slice(headerRow+1)){
      const article=normalizeArticleV4(row[c.article]);if(!article){excelRow++;continue}
      const size=norm(row[c.size]),location=norm(row[c.location]),bancale=norm(row[c.bancale]),master_note=text(row[c.note]).trim(),controlDate=text(row[c.controlDate]).trim();
      for(const [idx,state] of [[c.nuovo,'NUOVO'],[c.scaricato,'SCARICATO'],[c.usato,'USATO']]){
        const quantity=parseQty(row[idx]);if(quantity<=0)continue;
        rows.push({article_base:article,size,quantity,state,fila_scaffale:location,fila:location,scaffale:'',bancale,master_note,data_controllo_quantita:controlDate,source_row:excelRow});
      }
      excelRow++;
    }
    return rows;
  }
  function readMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch{return {}}}
  function writeMeta(patch){try{localStorage.setItem(META_KEY,JSON.stringify({...readMeta(),...patch,version:3}))}catch{}}
  function excelRowCountV4(wb){try{const ws=wb.Sheets[db.master?.sheet||'MAGAZZINO']||wb.Sheets.MAGAZZINO||wb.Sheets[wb.SheetNames[0]],matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',blankrows:false}),hr=detectMasterHeader(matrix);return Math.max(0,matrix.length-hr-1)}catch{return 0}}
  function parseEmbeddedDbV4(wb){
    const ws=wb?.Sheets?.[DATA_SHEET];if(!ws)return null;const a=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
    if(text(a?.[0]?.[0])!=='SO_WAREHOUSE_APP_DATA_V3')return null;const chunks=[];for(let i=4;i<a.length;i++)if(a[i]?.[0])chunks.push(text(a[i][0]));if(!chunks.length)return null;
    try{const p=JSON.parse(chunks.join(''));return p?.db&&Array.isArray(p.db.movements)?p:null}catch(e){console.warn('APP_DATI V4 non leggibile',e);return null}
  }
  function restoreEmbeddedDbV4(payload,importedMaster){
    if(!payload?.db)return false;const saved=payload.db,base=blankDb();
    db={...base,...saved,master:importedMaster,counters:{...base.counters,...(saved.counters||{})},movements:Array.isArray(saved.movements)?saved.movements:[],documents:Array.isArray(saved.documents)?saved.documents:[],requests:Array.isArray(saved.requests)?saved.requests:[],audits:Array.isArray(saved.audits)?saved.audits:[],rectifications:Array.isArray(saved.rectifications)?saved.rectifications:[]};
    db.app_meta={...(saved.app_meta||{}),master_schema:'MASTER_V4'};saveDb();return true;
  }
  function resetHistoryV4(importedMaster){const base=blankDb();db={...base,master:importedMaster,rectifications:[],app_meta:{master_schema:'MASTER_V4'}};db.master_reset_at=null;saveDb()}
  function captureMasterFileV4(){
    const input=byId('masterInput');if(!input||input.dataset.msv4Capture==='1')return;input.dataset.msv4Capture='1';
    input.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;pendingMasterFileName=f.name;pendingMasterBytesPromise=f.arrayBuffer()},true);
  }
  async function commitImportedWorkbookV4(importedMaster){
    let bytes=null;try{bytes=await pendingMasterBytesPromise}catch(e){console.error('Lettura Master V4',e)}
    pendingMasterBytesPromise=null;pendingMasterFileName='';
    if(!bytes)throw new Error('Non riesco a conservare il file Excel originale. Seleziona nuovamente il Master.');
    const wb=XLSX.read(bytes,{type:'array',cellDates:true,cellStyles:true}),embedded=parseEmbeddedDbV4(wb);
    if(embedded)restoreEmbeddedDbV4(embedded,importedMaster);else resetHistoryV4(importedMaster);
    await idbPut(bytes);const at=db.master?.imported_at||nowIso();writeMeta({fileName:db.master?.filename||'',excelRows:excelRowCountV4(wb),importedAt:at,lastExportAt:at,lastExportName:'',sourceHasAppData:!!embedded});
    if(typeof renderMasterStatus==='function')renderMasterStatus();if(typeof renderRegistry==='function')renderRegistry();await window.LocalMaster?.renderPanel?.();
    if(typeof warehouseToast==='function')warehouseToast(embedded?'Master V4 importato con storico ripristinato.':'Master V4 importato: nuovo ciclo di lavoro.','success');
  }
  async function importMappedMasterV4(){
    if(!requireLogin())return;
    const headers=(masterMatrix[masterHeaderRow]||[]).map(v=>text(v).trim()),c=definitiveMasterColumnsV4(headers);
    if(!isDefinitiveMasterV4(c))return alert('Il file non corrisponde al Master V4 ufficiale. Controlla le 9 colonne A:I.');
    const rows=parseMasterRowsV4(masterMatrix,masterHeaderRow,headers);
    if(!rows.length)return alert('Non ho trovato giacenze positive valide nel Master V4.');
    if(!confirm(`Importare ${rows.length} giacenze dal Master V4? La giacenza master precedente verrà sostituita.`))return;
    const beforeDb=clone(db),before=clone(db.master||{}),at=nowIso(),importedMaster={rows,imported_at:at,filename:masterFileName,sheet:byId('masterSheet').value,operator:operatorName(),schema:'MASTER_V4',columns:['SCAFFALE / FILA','BANCALE','ARTICOLO','TAGLIA','NUOVO','SCARICATO','USATO','NOTE','DATA CONTROLLO QUANTITÀ']};
    try{db.master=importedMaster;db.master_reset_at=null;db.app_meta=db.app_meta||{};db.app_meta.master_schema='MASTER_V4';audit('MASTER_IMPORT','MASTER','MASTER',before,clone(db.master));saveDb();await commitImportedWorkbookV4(clone(importedMaster))}
    catch(e){db=beforeDb;saveDb();throw e}
    masterDialog.close();renderMasterStatus();renderRegistry();alert(`Master V4 importato: ${rows.length} giacenze.`);
  }

  function activeRectifications(source){
    const arr=Array.isArray(source)?source:(schemaExport?.active?schemaExport.savedRects:(Array.isArray(db?.rectifications)?db.rectifications:[]));
    const cut=db?.master?.imported_at?new Date(db.master.imported_at).getTime():0;
    return arr.filter(r=>!r.cancelled_at&&(!cut||new Date(r.registered_at||r.operation_at||r.at||0).getTime()>=cut)).sort((a,b)=>new Date(a.registered_at||a.operation_at||a.at||0)-new Date(b.registered_at||b.operation_at||b.at||0));
  }
  function mapApply(map,row,delta,mode='event'){
    if(!row||!Number(delta))return;
    const k=rowKey(row);let b=map.get(k);
    if(!b){b={article_base:normalizeArticleV4(row.article_base),size:norm(row.size),state:norm(row.state||'NON_CHIARO'),fila_scaffale:locOf(row),fila:locOf(row),scaffale:'',bancale:norm(row.bancale),quantity:0,master_note:'',data_controllo_quantita:row.data_controllo_quantita||''};map.set(k,b)}
    b.quantity+=Number(delta||0);
    if(mode==='master')b.master_note=mergeNote(b.master_note,masterNoteOf(row));
    if(mode==='rectAfter')b.master_note=masterNoteOf(row);
    if(row.data_controllo_quantita&&!b.data_controllo_quantita)b.data_controllo_quantita=row.data_controllo_quantita;
  }
  function stockBucketsV4(){
    const map=new Map();
    for(const r of (db?.master?.rows||[]))mapApply(map,r,Number(r.quantity||0),'master');
    const cutoff=db?.master?.imported_at?new Date(db.master.imported_at).getTime():(db?.master_reset_at?new Date(db.master_reset_at).getTime():0),events=[];
    for(const m of (db?.movements||[])){if(m.cancelled_at)continue;const t=new Date(m.registered_at||m.operation_at||0).getTime();if(cutoff&&t<cutoff)continue;events.push({t,kind:'M',v:m})}
    for(const r of activeRectifications())events.push({t:new Date(r.registered_at||r.operation_at||r.at||0).getTime(),kind:'R',v:r});
    events.sort((a,b)=>a.t-b.t||(a.kind==='M'?-1:1));
    for(const e of events){
      if(e.kind==='M')mapApply(map,e.v,(norm(e.v.movement_type)==='CARICA'?1:-1)*Number(e.v.quantity||0),'movement');
      else{if(e.v.before)mapApply(map,e.v.before,-Number(e.v.before.quantity||0),'rectBefore');if(e.v.after)mapApply(map,e.v.after,Number(e.v.after.quantity||0),'rectAfter')}
    }
    return [...map.values()].filter(x=>x.quantity>0.000001).sort((a,b)=>(articleCompareKey(a.article_base)+norm(a.size)+locOf(a)+norm(a.bancale)+norm(a.state)).localeCompare(articleCompareKey(b.article_base)+norm(b.size)+locOf(b)+norm(b.bancale)+norm(b.state)));
  }

  function normalizeStockRowV4(r){return {article_base:normalizeArticleV4(r?.article_base),size:norm(r?.size),quantity:Math.max(0,Number(r?.quantity)||0),state:VALID_STATES.includes(norm(r?.state))?norm(r.state):norm(r?.state||'NON_CHIARO'),fila_scaffale:locOf(r),fila:locOf(r),scaffale:'',bancale:norm(r?.bancale),master_note:masterNoteOf(r)}}
  function sameStockRow(a,b){if(!a||!b)return a===b;return rowKey(a)===rowKey(b)&&Math.abs(Number(a.quantity||0)-Number(b.quantity||0))<1e-9&&masterNoteOf(a)===masterNoteOf(b)}
  function describeRectV4(before,after){
    const p=[];if(!before&&after)return `RETTIFICA AGGIUNTA · ${after.quantity} pezzi`;if(before&&!after)return `RETTIFICA RIMOZIONE · ${before.quantity} pezzi`;if(!before||!after)return 'RETTIFICA';
    if(articleCompareKey(before.article_base)!==articleCompareKey(after.article_base))p.push(`Articolo: ${before.article_base||'—'} → ${after.article_base||'—'}`);
    if(norm(before.size)!==norm(after.size))p.push(`Taglia: ${norm(before.size)||'—'} → ${norm(after.size)||'—'}`);
    if(norm(before.state)!==norm(after.state))p.push(`Stato: ${norm(before.state)||'—'} → ${norm(after.state)||'—'}`);
    if(locOf(before)!==locOf(after))p.push(`Fila/Scaffale: ${locOf(before)||'NON ASSEGNATO'} → ${locOf(after)||'NON ASSEGNATO'}`);
    if(norm(before.bancale)!==norm(after.bancale))p.push(`Bancale/Carrello: ${norm(before.bancale)||'—'} → ${norm(after.bancale)||'—'}`);
    if(Number(before.quantity||0)!==Number(after.quantity||0))p.push(`Quantità: ${Number(before.quantity||0)} → ${Number(after.quantity||0)}`);
    if(masterNoteOf(before)!==masterNoteOf(after))p.push(`Note: ${masterNoteOf(before)||'—'} → ${masterNoteOf(after)||'—'}`);
    return 'RETTIFICA · '+(p.join(' · ')||'dati confermati');
  }
  function validateBeforeRows(changes){
    const available=new Map(stockBucketsV4().map(x=>[rowKey(x),Number(x.quantity||0)])),needed=new Map();
    for(const c of changes){if(!c.before)continue;const k=rowKey(c.before);needed.set(k,(needed.get(k)||0)+Number(c.before.quantity||0))}
    for(const [k,q] of needed){if((available.get(k)||0)+1e-9<q)return {ok:false,available:available.get(k)||0,needed:q}}
    return {ok:true};
  }

  function installFlexiblePositions(){
    const rewriteLabel=(input,label,placeholder,help)=>{if(!input)return;input.placeholder=placeholder;const l=input.closest('label');if(!l)return;for(const n of l.childNodes){if(n.nodeType===3&&n.textContent.trim()){n.textContent=label+' ';break}}let s=l.querySelector('.msv4PosHelp');if(!s){s=document.createElement('small');s.className='uxOptionalNote msv4PosHelp';l.appendChild(s)}s.textContent=help};
    rewriteLabel(byId('filaScaffale'),'Fila/Scaffale','Es. 23 · facoltativo se usi Bancale/Carrello','Compila almeno una posizione: Fila/Scaffale oppure Bancale/Carrello.');
    rewriteLabel(byId('bancale'),'Bancale / Carrello','Es. 38 · facoltativo se usi Fila/Scaffale','Compila almeno una posizione: Fila/Scaffale oppure Bancale/Carrello.');
    rewriteLabel(byId('stockEditLocation'),'Fila/Scaffale','Es. 23 · puoi cercare solo per fila','Per cercare basta Fila/Scaffale oppure Bancale/Carrello.');
    rewriteLabel(byId('stockEditPallet'),'Bancale / Carrello','Es. 38 · puoi cercare solo per bancale','Per cercare basta Fila/Scaffale oppure Bancale/Carrello.');
    window.validateLocation=function(){const loc=norm(byId('filaScaffale')?.value),pal=norm(byId('bancale')?.value);if(!positionValid(loc,pal)){alert('Inserisci almeno Fila/Scaffale oppure Bancale/Carrello.');byId('filaScaffale')?.focus();return false}return true};
  }

  function stockEditRowsAtSourceV4(){
    const loc=norm(stockEditSource?.fila_scaffale),pal=norm(stockEditSource?.bancale),all=stockBucketsV4();
    if(stockEditSource?.unassignedOnly)return all.filter(s=>!locOf(s)&&!norm(s.bancale)&&(!stockEditSource.article_base||articleCompareKey(s.article_base)===articleCompareKey(stockEditSource.article_base))&&(!stockEditSource.size||norm(s.size)===norm(stockEditSource.size))&&(!stockEditSource.state||norm(s.state)===norm(stockEditSource.state)));
    return all.filter(s=>(!loc||locOf(s)===loc)&&(!pal||norm(s.bancale)===pal));
  }
  function stockEditBuildDraftV4(rows){stockEditRowsDraft=(rows||[]).map(s=>({edit_id:uid(),original:clone(s),deleted:false,article_base:s.article_base,size:s.size||'',quantity:Number(s.quantity)||0,state:s.state||'NON_CHIARO',fila_scaffale:locOf(s),bancale:s.bancale||'',master_note:masterNoteOf(s)}))}
  function stockEditNormalizeV4(r){return normalizeStockRowV4(r)}
  function editStockDraftV4(id,key,value){const r=stockEditRowsDraft.find(x=>x.edit_id===id);if(!r)return;if(key==='quantity')r[key]=Math.max(0,Number(value)||0);else if(key==='article_base')r[key]=normalizeArticleV4(value);else if(key==='size'||key==='fila_scaffale'||key==='bancale')r[key]=norm(value);else if(key==='master_note')r[key]=text(value);else r[key]=value}
  function stockEditRowHtmlV4(r,i){
    const disabled=r.deleted?'disabled':'',origin=r.original?`Prima: ${html(r.original.article_base)}${r.original.size?` · ${html(r.original.size)}`:''} · Qtà ${Number(r.original.quantity)||0} · ${html(r.original.state)} · ${html(locOf(r.original)||'—')} / ${html(r.original.bancale||'—')}${masterNoteOf(r.original)?` · Note: ${html(masterNoteOf(r.original))}`:''}`:'Nuova riga';
    return `<div class="stockEditRow ${r.deleted?'deleted':''}"><div class="stockEditHead"><b>Riga ${i+1}</b><button class="mini ${r.deleted?'':'danger'}" onclick="toggleStockEditDelete('${r.edit_id}')">${r.deleted?'RIPRISTINA':'ELIMINA'}</button></div><div class="stockEditOrigin">${origin}</div><label>Articolo<input class="field" ${disabled} value="${html(r.article_base)}" oninput="editStockDraft('${r.edit_id}','article_base',this.value)"></label><div class="twoCols"><label>Taglia<input class="field" ${disabled} value="${html(r.size)}" oninput="editStockDraft('${r.edit_id}','size',this.value)"></label><label>Quantità<input class="field" ${disabled} type="number" min="0" value="${Number(r.quantity)||0}" oninput="editStockDraft('${r.edit_id}','quantity',this.value)"></label></div><label>Stato<select class="field" ${disabled} onchange="editStockDraft('${r.edit_id}','state',this.value)">${VALID_STATES.map(s=>`<option ${s===r.state?'selected':''}>${s}</option>`).join('')}</select></label><div class="twoCols"><label>Fila/Scaffale<input class="field" ${disabled} value="${html(r.fila_scaffale)}" oninput="editStockDraft('${r.edit_id}','fila_scaffale',this.value)"></label><label>Bancale / Carrello<input class="field" ${disabled} value="${html(r.bancale)}" oninput="editStockDraft('${r.edit_id}','bancale',this.value)"></label></div><label>Note Master<input class="field" ${disabled} value="${html(r.master_note||'')}" oninput="editStockDraft('${r.edit_id}','master_note',this.value)"></label></div>`;
  }
  function renderStockEditRowsV4(){const active=stockEditRowsDraft.filter(r=>!r.deleted).length,loc=norm(stockEditSource?.fila_scaffale),pal=norm(stockEditSource?.bancale);if(byId('stockEditSummary'))byId('stockEditSummary').textContent=[loc?`Fila/Scaffale ${loc}`:'',pal?`Bancale/Carrello ${pal}`:'',stockEditSource?.unassignedOnly?'POSIZIONE NON ASSEGNATA':'',`${active} righe attive`].filter(Boolean).join(' · ');if(byId('stockEditRows'))byId('stockEditRows').innerHTML=stockEditRowsDraft.map(stockEditRowHtmlV4).join('')}
  function loadStockPalletV4(){
    if(!requireLogin())return;const loc=norm(byId('stockEditLocation')?.value),pal=norm(byId('stockEditPallet')?.value);if(!positionValid(loc,pal)){alert('Inserisci almeno Fila/Scaffale oppure Bancale/Carrello.');byId('stockEditLocation')?.focus();return}
    stockEditSource={fila_scaffale:loc,bancale:pal};const rows=stockEditRowsAtSourceV4();if(!rows.length){stockEditRowsDraft=[];byId('stockEditEditor')?.classList.add('hidden');setStatus('stockEditSearchStatus',`Nessuna giacenza trovata${loc?' in Fila/Scaffale '+loc:''}${pal?' · Bancale/Carrello '+pal:''}.`,'error');return}
    stockEditBuildDraftV4(rows);setStatus('stockEditSearchStatus',`Trovate ${rows.length} righe di giacenza.`,'good');byId('stockEditEditor')?.classList.remove('hidden');renderStockEditRowsV4();
  }
  function addStockEditRowV4(){const loc=norm(stockEditSource?.fila_scaffale),pal=norm(stockEditSource?.bancale);if(!positionValid(loc,pal))return alert('Cerca prima una Fila/Scaffale o un Bancale/Carrello da modificare.');stockEditRowsDraft.push({edit_id:uid(),original:null,deleted:false,article_base:'',size:'',quantity:0,state:'NUOVO',fila_scaffale:loc,bancale:pal,master_note:''});renderStockEditRowsV4();setTimeout(()=>{const rows=document.querySelectorAll('#stockEditRows .stockEditRow');rows[rows.length-1]?.scrollIntoView({behavior:'smooth',block:'center'})},30)}
  function showRectUndoV4(batchId,count){rectUndoBatch=batchId;clearTimeout(rectUndoTimer);byId('uxSnackbar')?.remove();const s=document.createElement('div');s.id='uxSnackbar';s.className='uxSnackbar';s.innerHTML=`<span>${count} rettifiche salvate · Nessun CARICA/SCARICA creato.</span><button type="button">ANNULLA</button>`;document.body.appendChild(s);s.querySelector('button').onclick=()=>undoRectBatchV4(batchId);rectUndoTimer=setTimeout(()=>{s.classList.add('fade');setTimeout(()=>s.remove(),260);if(rectUndoBatch===batchId)rectUndoBatch=null},15000)}
  function undoRectBatchV4(batchId){if(!batchId||rectUndoBatch!==batchId)return;const at=nowIso(),items=(db.rectifications||[]).filter(r=>r.batch_id===batchId&&!r.cancelled_at);for(const r of items){const before=clone(r);r.cancelled_at=at;r.updated_at=at;audit('CANCEL','RECTIFICATION',r.id,before,clone(r))}if(items.length){saveDb();window.renderStock?.();window.renderRegistry?.();window.LocalMaster?.renderPanel?.();if(typeof warehouseToast==='function')warehouseToast('Rettifica annullata.','success')}rectUndoBatch=null;byId('uxSnackbar')?.remove()}

  function saveStockEditV4(){
    if(!requireLogin())return;if(!stockEditRowsDraft.length)return alert('Cerca prima una posizione da modificare.');
    const noteByOriginalIdentity=new Map();for(const d of stockEditRowsDraft){if(!d.original||d.deleted)continue;if(masterNoteOf(d)!==masterNoteOf(d.original))noteByOriginalIdentity.set(identityKey(d.original),masterNoteOf(d))}
    if(noteByOriginalIdentity.size)for(const d of stockEditRowsDraft){if(d.original&&!d.deleted&&noteByOriginalIdentity.has(identityKey(d.original)))d.master_note=noteByOriginalIdentity.get(identityKey(d.original))}
    const changes=[];
    for(const draft of stockEditRowsDraft){const before=draft.original?normalizeStockRowV4(draft.original):null,after=(!draft.deleted&&Number(draft.quantity)>0)?normalizeStockRowV4(draft):null;if(after){if(!after.article_base)return alert('Completa il codice articolo in tutte le righe attive.');if(!positionValid(after.fila_scaffale,after.bancale))return alert('Ogni riga attiva deve avere almeno Fila/Scaffale oppure Bancale/Carrello.')}if(sameStockRow(before,after)||(!before&&!after))continue;changes.push({before,after})}
    if(!changes.length)return alert('Nessuna modifica da salvare.');const check=validateBeforeRows(changes);if(!check.ok)return alert(`La giacenza è cambiata. Disponibili ${check.available}, attesi ${check.needed}. Cerca di nuovo la posizione e riprova.`);
    const lines=changes.map(c=>describeRectV4(c.before,c.after)).join('\n');if(!confirm(`Confermi ${changes.length} rettifiche?\n\n${lines}\n\nNon verrà creato alcun CARICA o SCARICA.`))return;
    db.rectifications=Array.isArray(db.rectifications)?db.rectifications:[];const batchId=uid(),at=nowIso();for(const c of changes){const rec={id:uid(),batch_id:batchId,type:'RETTIFICA',operator:operatorName(),registered_at:at,operation_at:at,updated_at:at,cancelled_at:null,before:c.before?clone(c.before):null,after:c.after?clone(c.after):null,note:describeRectV4(c.before,c.after)};db.rectifications.unshift(rec);audit('CREATE','RECTIFICATION',rec.id,null,clone(rec))}saveDb();
    const remaining=stockEditRowsAtSourceV4();if(remaining.length){stockEditBuildDraftV4(remaining);renderStockEditRowsV4();setStatus('stockEditSearchStatus',`Rettifiche salvate. Restano ${remaining.length} righe nella posizione di origine.`,'good')}else{stockEditRowsDraft=[];if(byId('stockEditRows'))byId('stockEditRows').innerHTML='';byId('stockEditEditor')?.classList.add('hidden');setStatus('stockEditSearchStatus','Rettifica salvata. La posizione di origine non contiene più giacenze.','good')}
    window.renderStock?.();window.renderRegistry?.();window.LocalMaster?.renderPanel?.();showRectUndoV4(batchId,changes.length);if(typeof warehouseToast==='function')warehouseToast('Rettifica salvata senza movimenti fittizi.','success');
  }
  function installStockEditorV4(){
    window.stockEditNormalize=stockEditNormalizeV4;window.stockEditRowsAtSource=stockEditRowsAtSourceV4;window.stockEditBuildDraft=stockEditBuildDraftV4;window.editStockDraft=editStockDraftV4;window.stockEditRowHtml=stockEditRowHtmlV4;window.renderStockEditRows=renderStockEditRowsV4;window.loadStockPallet=loadStockPalletV4;window.addStockEditRow=addStockEditRowV4;window.saveStockEdit=saveStockEditV4;
    window.uxQuickEdit=function(payload){let s;try{s=JSON.parse(decodeURIComponent(payload))}catch{return}window.openStockEdit();setTimeout(()=>{const loc=norm(s.fila_scaffale),pal=norm(s.bancale);if(byId('stockEditLocation'))byId('stockEditLocation').value=loc;if(byId('stockEditPallet'))byId('stockEditPallet').value=pal;if(positionValid(loc,pal))return loadStockPalletV4();stockEditSource={fila_scaffale:'',bancale:'',unassignedOnly:true,article_base:s.article_base||'',size:s.size||'',state:s.state||''};const rows=stockEditRowsAtSourceV4();if(!rows.length)return setStatus('stockEditSearchStatus','Nessuna giacenza non assegnata trovata.','error');stockEditBuildDraftV4(rows);byId('stockEditEditor')?.classList.remove('hidden');setStatus('stockEditSearchStatus','Giacenza senza posizione trovata: assegna Fila/Scaffale oppure Bancale/Carrello.','warn');renderStockEditRowsV4()},0)};
  }

  function canonicalQuery(q){return norm(q).replace(/\s*-\s*/g,'-').replace(/\s+/g,' ').trim()}
  function buildSearchContext(rows,q){
    const query=canonicalQuery(q),exactMap=new Map(),articles=new Map(),sizes=new Set();
    for(const r of rows||[]){const article=articleCompareKey(r.article_base),size=norm(r.size);if(article&&!articles.has(canonicalQuery(article)))articles.set(canonicalQuery(article),article);if(size)sizes.add(canonicalQuery(size));if(!article||!size)continue;exactMap.set(canonicalQuery(`${article}-${size}`),{article,size});exactMap.set(canonicalQuery(`${article} ${size}`),{article,size})}
    const exact=exactMap.get(query)||null,articleExact=!exact?(articles.get(query)||null):null,sizeOnly=!exact&&!articleExact&&sizes.has(query)?query:null,tokens=exact||articleExact||sizeOnly?[]:query.replace(/-/g,' ').split(/\s+/).filter(Boolean);return {query,exact,articleExact,sizeOnly,tokens};
  }
  function rowMatchesSearchV4(row,ctx){if(!ctx?.query)return true;if(ctx.exact)return articleCompareKey(row.article_base)===ctx.exact.article&&norm(row.size)===ctx.exact.size;if(ctx.articleExact)return articleCompareKey(row.article_base)===ctx.articleExact;if(ctx.sizeOnly)return canonicalQuery(row.size)===ctx.sizeOnly;const hay=[row.article_base,row.size,row.state,locOf(row),row.bancale,masterNoteOf(row)].map(norm).join(' ').replace(/-/g,' ');return ctx.tokens.every(t=>hay.includes(t))}
  function groupSearchRows(rows){const map=new Map();for(const r of rows||[]){const article=normalizeArticleV4(r.article_base),size=norm(r.size),k=`${article}\u0001${size}`;if(!map.has(k))map.set(k,{article,size,total:0,rows:[]});const g=map.get(k);g.total+=Number(r.quantity||0);g.rows.push(r)}return [...map.values()].sort((a,b)=>(articleCompareKey(a.article)+a.size).localeCompare(articleCompareKey(b.article)+b.size))}
  function availabilityHtml(r){const loc=locOf(r),pal=norm(r.bancale),payload=encodeURIComponent(JSON.stringify({article_base:r.article_base,size:r.size||'',state:r.state||'NUOVO',fila_scaffale:loc,bancale:pal}));return `<div class="msv4Avail"><div class="msv4AvailTop"><div><b>${Number(r.quantity||0).toLocaleString('it-IT')} pz</b><span>${html(norm(r.state)||'—')}</span></div></div><div class="meta">${loc?`<span>Fila/Scaffale ${html(loc)}</span>`:''}${pal?`<span>Bancale/Carrello ${html(pal)}</span>`:''}${!loc&&!pal?'<span>POSIZIONE NON ASSEGNATA</span>':''}</div>${masterNoteOf(r)?`<div class="msv4Note">📝 ${html(masterNoteOf(r))}</div>`:''}<div class="uxQuickActions"><button type="button" class="uxQuickOut" onclick="uxQuickOperation('SCARICA','${payload}')">SCARICA</button><button type="button" class="uxQuickIn" onclick="uxQuickOperation('CARICA','${payload}')">CARICA</button><button type="button" class="uxQuickEdit" onclick="uxQuickEdit('${payload}')">MODIFICA</button></div></div>`}
  function ensureSearchToolsV4(){
    const input=byId('searchInput');if(!input)return;const card=input.closest?.('.card');if(!card||byId('uxSearchTools'))return;const box=document.createElement('div');box.id='uxSearchTools';box.innerHTML='<div class="uxSearchTools"><select id="uxSearchState" class="field"><option value="">TUTTI GLI STATI</option><option>NUOVO</option><option>SCARICATO</option><option>USATO</option></select><button type="button" id="uxBarcodeBtn" class="uxScanBtn">▦ SCANSIONA</button></div><div class="uxSearchSummary" id="uxSearchSummary">Cerca per articolo, taglia, fila, bancale o nota.</div>';card.appendChild(box);byId('uxSearchState').onchange=()=>window.renderStock();byId('uxBarcodeBtn').onclick=()=>window.startBarcodeScanner?.();
  }

  function renderStockV4(){
    ensureSearchToolsV4();const input=byId('searchInput'),list=byId('stockList');if(!input||!list)return;const all=stockBucketsV4(),q=input.value||'',state=norm(byId('uxSearchState')?.value),ctx=buildSearchContext(all,q);
    if(!ctx.query&&!state){const summary=byId('uxSearchSummary');if(summary)summary.textContent='Scrivi un articolo; puoi aggiungere la taglia, la fila, il bancale o una nota.';list.innerHTML='<div class="msv4Empty">Esempi: <b>I00215</b>, <b>I00215-S</b>, <b>I00215 S</b> oppure <b>I00215 - S</b>.</div>';return}
    const filtered=all.filter(r=>rowMatchesSearchV4(r,ctx)&&(!state||norm(r.state)===state)),groups=groupSearchRows(filtered),total=filtered.reduce((a,r)=>a+Number(r.quantity||0),0),summary=byId('uxSearchSummary');if(summary)summary.textContent=`${groups.length} articolo/taglia · ${filtered.length} disponibilità · ${total.toLocaleString('it-IT')} pezzi`;
    if(!groups.length){list.innerHTML='<p>Nessuna giacenza trovata.</p>';return}
    list.innerHTML=groups.slice(0,140).map(g=>`<details class="msv4Group"><summary><div class="msv4GroupHead"><div><div class="sku">${html(g.article)}${g.size?` · ${html(g.size)}`:''}</div><div class="msv4GroupHint">${g.rows.length} disponibilità · mostra posizioni e stati</div></div><div class="bigQty">${Number(g.total||0).toLocaleString('it-IT')}</div></div></summary><div class="msv4AvailList">${g.rows.slice().sort((a,b)=>(locOf(a)+norm(a.bancale)+norm(a.state)).localeCompare(locOf(b)+norm(b.bancale)+norm(b.state))).map(availabilityHtml).join('')}</div></details>`).join('');
    if(groups.length>140)list.insertAdjacentHTML('beforeend',`<div class="status warn">Mostro i primi 140 gruppi su ${groups.length}. Restringi la ricerca.</div>`);
  }

  function installOperationStateGuard(){
    const original=window.confirmOperation;if(typeof original==='function'&&!original.__msv4Wrapped){const wrapped=function(){for(const p of (importedPhotos||[]))for(const g of (p.groups||[]))for(const v of (g.variants||[])){if(Number(v.quantity)>0&&!VALID_STATES.includes(norm(v.state)))return alert('Nel Master V4 lo stato deve essere NUOVO, SCARICATO oppure USATO. Correggi le righe con stato '+(v.state||'NON_CHIARO')+' prima di confermare.')}return original.apply(this,arguments)};wrapped.__msv4Wrapped=true;window.confirmOperation=wrapped}
    const saveMovement=window.saveMovementEdit;if(typeof saveMovement==='function'&&!saveMovement.__msv4Wrapped){const wrappedEdit=function(){const state=norm(byId('editState')?.value);if(!VALID_STATES.includes(state))return alert('Nel Master V4 un movimento può avere solo stato NUOVO, SCARICATO oppure USATO.');return saveMovement.apply(this,arguments)};wrappedEdit.__msv4Wrapped=true;window.saveMovementEdit=wrappedEdit}
  }

  function uniqueSourceRows(rows){const s=new Set();for(const r of rows)s.add(Number(r.source_row)||rowKey(r));return s.size}
  function integrityReportV4(){
    const rows=db?.master?.rows||[],source=new Map();for(const r of rows){const sr=Number(r.source_row)||rowKey(r);if(!source.has(sr))source.set(sr,[]);source.get(sr).push(r)}
    let missingArticle=0,missingSize=0,missingPosition=0,invalidState=0,invalidQty=0;const identitySources=new Map();
    for(const [sr,arr] of source){const r=arr[0]||{};if(!normalizeArticleV4(r.article_base))missingArticle++;if(!norm(r.size))missingSize++;if(!positionValid(locOf(r),r.bancale))missingPosition++;for(const x of arr){if(!VALID_STATES.includes(norm(x.state)))invalidState++;if(!Number.isFinite(Number(x.quantity))||Number(x.quantity)<0)invalidQty++}const k=identityKey(r);if(!identitySources.has(k))identitySources.set(k,new Set());identitySources.get(k).add(sr)}
    let duplicateRows=0;for(const set of identitySources.values())if(set.size>1)duplicateRows+=set.size-1;const blocking=missingArticle+missingSize+invalidState+invalidQty;return {excelRows:source.size,stockRows:rows.length,missingArticle,missingSize,missingPosition,invalidState,invalidQty,duplicateRows,blocking,ok:blocking===0};
  }
  function patchDashboardIntegrity(){
    const rep=integrityReportV4(),dash=byId('uxMasterDashboard');if(dash){for(const metric of dash.querySelectorAll('.uxMetric')){const span=metric.querySelector('span'),b=metric.querySelector('b');if(!span||!b)continue;if(span.textContent.trim()==='INTEGRITÀ MASTER'){b.textContent=rep.ok?'OK':String(rep.blocking);metric.classList.toggle('good',rep.ok);metric.classList.toggle('error',!rep.ok)}if(span.textContent.trim()==='SENZA FILA/SCAFFALE'||span.textContent.trim()==='SENZA POSIZIONE'){span.textContent='SENZA POSIZIONE';b.textContent=String(rep.missingPosition);metric.classList.toggle('good',!rep.missingPosition);metric.classList.toggle('warn',!!rep.missingPosition)}}}
    const btn=byId('uxIntegrityBtn');if(btn)btn.onclick=()=>alert(`CONTROLLO MASTER V4\n\nRighe Excel operative: ${rep.excelRows}\nGiacenze importate: ${rep.stockRows}\nArticoli mancanti: ${rep.missingArticle}\nTaglie mancanti: ${rep.missingSize}\nSenza posizione (né Fila/Scaffale né Bancale): ${rep.missingPosition}\nStato non valido: ${rep.invalidState}\nQuantità non valida: ${rep.invalidQty}\nRighe duplicate stessa identità: ${rep.duplicateRows}\n\n${rep.ok?'Master V4 utilizzabile.':'Sono presenti anomalie bloccanti da verificare.'}`);
  }
  function installDashboardPatch(){if(!window.LocalMaster)return;priorRenderPanel=LocalMaster.renderPanel;LocalMaster.renderPanel=async function(){const out=await priorRenderPanel.apply(this,arguments);setTimeout(patchDashboardIntegrity,60);return out};setTimeout(patchDashboardIntegrity,120)}

  function injectStyles(){if(byId('msv4Styles'))return;const s=document.createElement('style');s.id='msv4Styles';s.textContent=`.msv4Group{background:#fff;border:1px solid #dae5ee;border-radius:21px;margin:10px 0;box-shadow:0 7px 21px #15395810;overflow:hidden}.msv4Group>summary{list-style:none;cursor:pointer;padding:15px}.msv4Group>summary::-webkit-details-marker{display:none}.msv4GroupHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.msv4GroupHint{margin-top:7px;color:#65788c;font-size:12px;font-weight:800}.msv4GroupHint:before{content:'⌄';font-size:18px;color:#2c60aa;margin-right:6px}.msv4Group[open] .msv4GroupHint:before{content:'⌃'}.msv4AvailList{padding:0 12px 12px;border-top:1px solid #e5edf3}.msv4Avail{background:#f7fafc;border:1px solid #dce6ee;border-radius:16px;padding:12px;margin-top:10px}.msv4AvailTop>div{display:flex;justify-content:space-between;gap:10px;align-items:center}.msv4AvailTop b{font-size:21px;color:#2c60aa}.msv4AvailTop span{font-size:12px;font-weight:950;border-radius:999px;background:#e9f0f5;padding:5px 8px}.msv4Note{margin-top:8px;padding:8px 10px;background:#fff6dc;border-radius:11px;font-size:12px;font-weight:800;color:#73520d}.msv4Empty{background:#fff;border:1px solid #dce6ef;border-radius:20px;padding:16px;color:#65788c}.msv4PosHelp{display:block;margin-top:4px}`;document.head.appendChild(s)}

  function openDb(){return new Promise((ok,no)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(DB_STORE))r.result.createObjectStore(DB_STORE)};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
  async function idbGet(){const d=await openDb();return new Promise((ok,no)=>{const tx=d.transaction(DB_STORE,'readonly'),r=tx.objectStore(DB_STORE).get(DB_ACTIVE);r.onsuccess=()=>{const v=r.result;d.close();ok(v)};r.onerror=()=>{const e=r.error;d.close();no(e)}})}
  async function idbPut(v){const d=await openDb();return new Promise((ok,no)=>{const tx=d.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(v,DB_ACTIVE);tx.oncomplete=()=>{d.close();ok()};tx.onerror=()=>{const e=tx.error;d.close();no(e)}})}

  function parseXml(s){const d=parser.parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror')[0])throw new Error('XML Excel non valido');return d}
  function xmlText(d){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+serializer.serializeToString(d.documentElement)}
  function local(n){return n?.localName||n?.nodeName?.split(':').pop()||''}
  function kids(n,name){return [...(n?.childNodes||[])].filter(x=>x.nodeType===1&&(!name||local(x)===name))}
  function first(n,name){return kids(n,name)[0]||null}
  function dir(p){const i=p.lastIndexOf('/');return i<0?'':p.slice(0,i)}
  function joinPath(base,target){if(!target)return '';if(target.startsWith('/'))return target.slice(1);const out=[];for(const x of `${base}/${target}`.split('/')){if(!x||x==='.')continue;if(x==='..')out.pop();else out.push(x)}return out.join('/')}
  function colName(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
  function colIndex(ref){const m=text(ref).match(/^([A-Z]+)\d+$/i);if(!m)return -1;let n=0;for(const c of m[1].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1}
  function sheetPath(workbook,rels,name){const relMap=new Map(kids(rels.documentElement,'Relationship').map(r=>[r.getAttribute('Id'),joinPath('xl',r.getAttribute('Target'))]));const sheets=first(workbook.documentElement,'sheets'),s=kids(sheets,'sheet').find(x=>x.getAttribute('name')===name);if(!s)return '';const id=s.getAttributeNS(DOCREL,'id')||s.getAttribute('r:id');return relMap.get(id)||''}
  function findCell(row,col){return kids(row,'c').find(c=>colIndex(c.getAttribute('r'))===col)||null}
  function clearCell(c){for(const ch of [...c.childNodes])if(ch.nodeType===1&&['v','f','is'].includes(local(ch)))c.removeChild(ch);c.removeAttribute('t')}
  function setInline(doc,row,col,rowNum,value){let c=findCell(row,col);if(!c){c=doc.createElementNS(MAIN,'c');c.setAttribute('r',`${colName(col)}${rowNum}`);const next=kids(row,'c').find(x=>colIndex(x.getAttribute('r'))>col);if(next)row.insertBefore(c,next);else row.appendChild(c)}clearCell(c);c.setAttribute('r',`${colName(col)}${rowNum}`);c.setAttribute('t','inlineStr');const is=doc.createElementNS(MAIN,'is'),t=doc.createElementNS(MAIN,'t'),v=text(value);if(/^\s|\s$/.test(v))t.setAttributeNS(XMLNS,'xml:space','preserve');t.textContent=v;is.appendChild(t);c.appendChild(is)}
  function sharedStrings(doc){if(!doc)return [];return kids(doc.documentElement,'si').map(si=>{let out='';const walk=n=>{for(const ch of n.childNodes||[]){if(ch.nodeType===1){if(local(ch)==='t')out+=ch.textContent||'';else walk(ch)}}};walk(si);return out})}
  function cellText(row,col,shared){const c=findCell(row,col);if(!c)return '';const t=c.getAttribute('t')||'';if(t==='inlineStr')return first(c,'is')?.textContent||'';const v=first(c,'v')?.textContent||'';if(t==='s')return shared[Number(v)]??'';return v}
  function resolveStateIdentity(start,rects){let cur=normalizeStockRowV4(start),touched=false,deleted=false;for(const r of rects){if(!r.before||rowKey(cur)!==rowKey(r.before))continue;touched=true;if(!r.after){deleted=true;break}cur=normalizeStockRowV4(r.after)}return {cur,touched,deleted}}

  async function buildCompatibilitySource(bytes,rects){
    const zip=await JSZip.loadAsync(bytes),wbTxt=await zip.file('xl/workbook.xml')?.async('string'),relTxt=await zip.file('xl/_rels/workbook.xml.rels')?.async('string');if(!wbTxt||!relTxt)throw new Error('Workbook Excel non valido.');const wbDoc=parseXml(wbTxt),relDoc=parseXml(relTxt),book=XLSX.read(bytes,{type:'array',cellDates:true}),sheetName=db.master?.sheet&&book.Sheets[db.master.sheet]?db.master.sheet:(book.Sheets.MAGAZZINO?'MAGAZZINO':book.SheetNames[0]),ws=book.Sheets[sheetName];if(!ws)throw new Error('Foglio MAGAZZINO non trovato.');
    const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:true}),hr=detectMasterHeader(matrix),headers=(matrix[hr]||[]).map(v=>text(v).trim()),c=definitiveMasterColumnsV4(headers);if(!isDefinitiveMasterV4(c))throw new Error('Il Master non rispetta lo schema V4 A:I.');const path=sheetPath(wbDoc,relDoc,sheetName),sf=zip.file(path);if(!path||!sf)throw new Error('XML del foglio MAGAZZINO non trovato.');const originalSheetXml=await sf.async('string'),doc=parseXml(originalSheetXml),data=first(doc.documentElement,'sheetData'),rows=new Map(kids(data,'row').map(r=>[Number(r.getAttribute('r')||0),r])),originalIdentityByRow=new Map();
    for(let i=hr+1;i<matrix.length;i++){
      const raw=matrix[i]||[],article=normalizeArticleV4(raw[c.article]);if(!article)continue;const size=norm(raw[c.size]),loc=norm(raw[c.location]),pal=norm(raw[c.bancale]),note=text(raw[c.note]).trim(),row=rows.get(i+1);if(!row)continue;originalIdentityByRow.set(i+1,[articleCompareKey(article),size,loc,pal].join('|'));const states=[];
      for(const [state,ci] of [['NUOVO',c.nuovo],['SCARICATO',c.scaricato],['USATO',c.usato]]){const q=parseQty(raw[ci]);if(q>0)states.push(resolveStateIdentity({article_base:article,size,state,quantity:q,fila_scaffale:loc,bancale:pal,master_note:note},rects))}
      const affected=states.some(x=>x.touched),alive=states.filter(x=>!x.deleted);let target={article_base:article,size,fila_scaffale:loc,bancale:pal,master_note:note};
      if(alive.length&&alive.length===states.length){const ids=alive.map(x=>identityKey(x.cur));if(ids.every(x=>x===ids[0]))target=alive[0].cur}
      setInline(doc,row,c.article,i+1,compatArticle(target.article_base,target.size));setInline(doc,row,c.size,i+1,norm(target.size));if(affected){setInline(doc,row,c.location,i+1,locOf(target));setInline(doc,row,c.bancale,i+1,norm(target.bancale));setInline(doc,row,c.note,i+1,masterNoteOf(target));setInline(doc,row,c.controlDate,i+1,new Date().toLocaleDateString('it-IT'))}
    }
    zip.file(path,xmlText(doc));schemaInternalZip=true;const saved=db.rectifications;db.rectifications=[];try{const compatBytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}});return {bytes:compatBytes,sheetName,headerRow:hr,columns:c,originalSheetXml,originalIdentityByRow}}finally{db.rectifications=saved;schemaInternalZip=false}
  }

  function touchedIdentityKeys(){const set=new Set(),cut=db?.master?.imported_at?new Date(db.master.imported_at).getTime():0;for(const m of (db.movements||[])){if(m.cancelled_at)continue;const t=new Date(m.updated_at||m.registered_at||m.operation_at||0).getTime();if(cut&&t<cut)continue;set.add(identityKey(m))}for(const r of activeRectifications(schemaExport?.savedRects||[])){if(r.before)set.add(identityKey(r.before));if(r.after)set.add(identityKey(r.after))}return set}
  function quantityOrIdentityTouchedKeys(){const set=new Set(),cut=db?.master?.imported_at?new Date(db.master.imported_at).getTime():0;for(const m of (db.movements||[])){if(m.cancelled_at)continue;const t=new Date(m.updated_at||m.registered_at||m.operation_at||0).getTime();if(cut&&t<cut)continue;set.add(identityKey(m))}for(const r of activeRectifications(schemaExport?.savedRects||[])){const b=r.before,a=r.after;if(!b||!a){if(b)set.add(identityKey(b));if(a)set.add(identityKey(a));continue}const qtyChanged=Number(b.quantity||0)!==Number(a.quantity||0),stateChanged=norm(b.state)!==norm(a.state);if(qtyChanged||stateChanged){set.add(identityKey(b));set.add(identityKey(a))}}return set}
  function insertCellSorted(row,cell,col){const next=kids(row,'c').find(x=>colIndex(x.getAttribute('r'))>col);if(next)row.insertBefore(cell,next);else row.appendChild(cell)}
  function copyOriginalCell(doc,finalRow,originalRow,col,rowNum){const cur=findCell(finalRow,col);if(cur)finalRow.removeChild(cur);const src=findCell(originalRow,col);if(!src)return;const copy=doc.importNode?doc.importNode(src,true):src.cloneNode(true);copy.setAttribute('r',`${colName(col)}${rowNum}`);insertCellSorted(finalRow,copy,col)}

  function currentIdentityMeta(){const map=new Map();for(const s of stockBucketsV4()){const k=identityKey(s);if(!map.has(k))map.set(k,{article:normalizeArticleV4(s.article_base),size:norm(s.size),location:locOf(s),pallet:norm(s.bancale),master_note:masterNoteOf(s)});else map.get(k).master_note=mergeNote(map.get(k).master_note,masterNoteOf(s))}return map}
  async function finalizeMainSheet(zip){
    const wbFile=zip.file('xl/workbook.xml'),relFile=zip.file('xl/_rels/workbook.xml.rels');if(!wbFile||!relFile)return;const wbDoc=parseXml(await wbFile.async('string')),relDoc=parseXml(await relFile.async('string')),path=sheetPath(wbDoc,relDoc,schemaExport.sheetName),sf=zip.file(path);if(!path||!sf)return;const doc=parseXml(await sf.async('string')),data=first(doc.documentElement,'sheetData');if(!data)return;let shared=[];const ss=zip.file('xl/sharedStrings.xml');if(ss)shared=sharedStrings(parseXml(await ss.async('string')));const meta=currentIdentityMeta(),c=schemaExport.columns,headerNum=schemaExport.headerRow+1,touched=touchedIdentityKeys(),qtyTouched=quantityOrIdentityTouchedKeys(),origDoc=parseXml(schemaExport.originalSheetXml),origData=first(origDoc.documentElement,'sheetData'),origRows=new Map(kids(origData,'row').map(r=>[Number(r.getAttribute('r')||0),r]));
    for(const row of kids(data,'row')){const rn=Number(row.getAttribute('r')||0);if(rn<=headerNum)continue;const originalKey=schemaExport.originalIdentityByRow?.get(rn),or=originalKey?origRows.get(rn):null;if(originalKey&&!qtyTouched.has(originalKey)&&or)for(const col of [c.nuovo,c.scaricato,c.usato])copyOriginalCell(doc,row,or,col,rn);if(originalKey&&!touched.has(originalKey)&&or)for(const col of [c.note,c.controlDate])copyOriginalCell(doc,row,or,col,rn);const combined=cellText(row,c.article,shared);if(!combined)continue;const p=splitCompatArticle(combined);setInline(doc,row,c.article,rn,p.article);setInline(doc,row,c.size,rn,p.size);const loc=norm(cellText(row,c.location,shared)),pal=norm(cellText(row,c.bancale,shared)),k=[articleCompareKey(p.article),norm(p.size),loc,pal].join('|');if(meta.has(k)&&(!originalKey||touched.has(originalKey)))setInline(doc,row,c.note,rn,meta.get(k).master_note||'')}
    zip.file(path,xmlText(doc));
  }
  function rawSheetXml(rows,widths){const maxCols=Math.max(1,...rows.map(r=>r.length)),last=Math.max(1,rows.length),end=colName(maxCols-1),cols=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join(''),rowXml=rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{if(v===''||v===null||v===undefined)return '';const ref=`${colName(ci)}${ri+1}`;if(typeof v==='number')return `<c r="${ref}"><v>${Number(v)||0}</v></c>`;const s=text(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');return `<c r="${ref}" t="inlineStr"><is><t>${s}</t></is></c>`}).join('')}</row>`).join('');return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${MAIN}" xmlns:r="${DOCREL}"><dimension ref="A1:${end}${last}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rowXml}</sheetData></worksheet>`}
  async function patchAppData(zip){const wbFile=zip.file('xl/workbook.xml'),relFile=zip.file('xl/_rels/workbook.xml.rels');if(!wbFile||!relFile)return;const wbDoc=parseXml(await wbFile.async('string')),relDoc=parseXml(await relFile.async('string')),path=sheetPath(wbDoc,relDoc,DATA_SHEET);if(!path)return;const exported=nowIso(),payload=JSON.stringify({schema:4,exported_at:exported,db:clone(db)}),chunk=30000,rows=[['SO_WAREHOUSE_APP_DATA_V3'],['SCHEMA',4],['ESPORTATO_IL',exported],['JSON_CHUNKS',Math.ceil(payload.length/chunk)]];for(let i=0;i<payload.length;i+=chunk)rows.push([payload.slice(i,i+chunk)]);zip.file(path,rawSheetXml(rows,[34,120]))}

  function installExportBridge(){
    if(!window.LocalMaster||!window.JSZip||!window.XLSX||!parser||!serializer)return;priorGenerate=JSZip.prototype.generateAsync;priorExport=LocalMaster.exportUpdatedMaster;
    JSZip.prototype.generateAsync=async function(options,onUpdate){
      if(schemaInternalZip||!schemaExport?.active)return priorGenerate.call(this,options,onUpdate);
      if(!schemaExport.finalized){db.rectifications=schemaExport.originalRects;await finalizeMainSheet(this);await patchAppData(this);schemaExport.finalized=true}
      return priorGenerate.call(this,options,onUpdate);
    };
    JSZip.prototype.generateAsync.__warehouseMasterSchemaV4=true;
    LocalMaster.exportUpdatedMaster=async function(){
      if(!LocalMaster.requireMaster())return false;const original=await idbGet();if(!original)return priorExport.apply(this,arguments);const originalRects=Array.isArray(db.rectifications)?db.rectifications:[],savedRects=clone(originalRects),rects=activeRectifications(savedRects);let replaced=false;
      try{const compat=await buildCompatibilitySource(original,rects);await idbPut(compat.bytes);replaced=true;schemaExport={active:true,finalized:false,originalRects,savedRects,sheetName:compat.sheetName,headerRow:compat.headerRow,columns:compat.columns,originalSheetXml:compat.originalSheetXml,originalIdentityByRow:compat.originalIdentityByRow};compatibilityMode=true;const result=await priorExport.apply(this,arguments);return result}
      finally{compatibilityMode=false;db.rectifications=originalRects;schemaExport=null;if(replaced)try{await idbPut(original)}catch(e){console.error('Ripristino Master V4',e)}}
    };
  }

  function rebindMasterConfirm(){
    const dlg=byId('masterDialog'),old=dlg?.querySelector('.btn.success');if(!old)return;const fresh=old.cloneNode(true);delete fresh.dataset.hardImportBound;fresh.removeAttribute('onclick');fresh.onclick=null;old.replaceWith(fresh);window.WarehouseUIHealth?.hardenMasterConfirm?.();
  }

  function install(){
    exposeBaseOverrides();captureMasterFileV4();window.prepareMasterSheet=prepareMasterSheetV4;window.importMappedMaster=importMappedMasterV4;rebindMasterConfirm();window.stockBuckets=stockBucketsV4;injectStyles();installFlexiblePositions();installStockEditorV4();installOperationStateGuard();ensureSearchToolsV4();window.renderStock=renderStockV4;window.undoRectificationBatch=undoRectBatchV4;installDashboardPatch();installExportBridge();
    if(byId('searchInput'))byId('searchInput').placeholder='Articolo, articolo-taglia, fila, bancale o nota…';
    setTimeout(()=>{installFlexiblePositions();patchDashboardIntegrity()},100);
  }

  window.WarehouseMasterSchemaV4={version:VERSION,normalizeArticle:normalizeArticleV4,positionValid,definitiveMasterColumns:definitiveMasterColumnsV4,isDefinitiveMaster:isDefinitiveMasterV4,parseMasterRows:parseMasterRowsV4,compatArticle,splitCompatArticle,buildSearchContext,rowMatchesSearch:rowMatchesSearchV4,groupSearchRows,integrityReport:integrityReportV4,stockBuckets:stockBucketsV4,install};
  if(typeof document!=='undefined')install();
})();
