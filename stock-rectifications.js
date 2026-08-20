/* Rettifiche giacenza: MODIFICA aggiorna la situazione logica senza creare CARICA/SCARICA fittizi.
   Le rettifiche restano tracciate nello storico, gli ID restano interni e l'export aggiorna la riga Excel originale quando possibile. */
(function installStockRectifications(){
  'use strict';
  if(!window.LocalMaster||!window.JSZip||!window.XLSX)return;
  if(window.WarehouseStockRectifications)return;

  const VERSION='2026.08.20-rect1';
  const DB_NAME='so_warehouse_files_v1',STORE='files',ACTIVE='active-master-xlsx';
  const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const DOCREL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const VALID_STATES=['NUOVO','SCARICATO','USATO'];
  const parser=new DOMParser(),serializer=new XMLSerializer();
  const baseGenerate=JSZip.prototype.generateAsync;
  const baseExport=LocalMaster.exportUpdatedMaster;
  const baseRenderRegistry=window.renderRegistry;
  const baseRenderPanel=LocalMaster.renderPanel;
  let internalZipBuild=false,undoBatch=null,undoTimer=null;

  const norm=v=>String(v??'').trim().toUpperCase();
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const artOf=r=>typeof normalizeArticle==='function'?normalizeArticle(r?.article_base||''):norm(r?.article_base||'');
  const rowKey=r=>[artOf(r),norm(r?.size),norm(r?.state||'NON_CHIARO'),locOf(r),norm(r?.bancale)].join('|');
  const identityKey=r=>[artOf(r),norm(r?.size),locOf(r),norm(r?.bancale)].join('|');
  const nowIso=()=>new Date().toISOString();
  const html=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const dateText=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})};

  function ensureStore(){if(!Array.isArray(db.rectifications))db.rectifications=[];return db.rectifications}
  function normalizeStockRow(r){const state=VALID_STATES.includes(norm(r?.state))?norm(r.state):norm(r?.state||'NON_CHIARO');return {article_base:artOf(r),size:norm(r?.size),quantity:Math.max(0,Number(r?.quantity)||0),state,fila_scaffale:locOf(r),fila:locOf(r),scaffale:'',bancale:norm(r?.bancale)}}
  function sameRow(a,b){if(!a||!b)return a===b;return rowKey(a)===rowKey(b)&&Math.abs(Number(a.quantity||0)-Number(b.quantity||0))<1e-9}
  function activeRectifications(){const cut=db.master?.imported_at?new Date(db.master.imported_at).getTime():0;return ensureStore().filter(r=>!r.cancelled_at&&(!cut||new Date(r.registered_at||r.at||0).getTime()>=cut)).sort((a,b)=>new Date(a.registered_at||a.at||0)-new Date(b.registered_at||b.at||0))}

  function mapApply(map,row,delta){if(!row||!delta)return;const k=rowKey(row);if(!map.has(k))map.set(k,{article_base:artOf(row),size:norm(row.size),state:norm(row.state||'NON_CHIARO'),fila_scaffale:locOf(row),fila:locOf(row),scaffale:'',bancale:norm(row.bancale),quantity:0});map.get(k).quantity+=Number(delta||0)}
  function rectifiedStockBuckets(){
    const map=new Map();
    (db.master?.rows||[]).forEach(r=>mapApply(map,r,Number(r.quantity||0)));
    const cutoff=db.master?.imported_at?new Date(db.master.imported_at).getTime():(db.master_reset_at?new Date(db.master_reset_at).getTime():0);
    const events=[];
    for(const m of (db.movements||[])){if(m.cancelled_at)continue;const t=new Date(m.registered_at||m.operation_at||0).getTime();if(cutoff&&t<cutoff)continue;events.push({t,kind:'M',v:m})}
    for(const r of activeRectifications()){events.push({t:new Date(r.registered_at||r.at||0).getTime(),kind:'R',v:r})}
    events.sort((a,b)=>a.t-b.t||(a.kind==='M'?-1:1));
    for(const e of events){
      if(e.kind==='M'){
        const type=norm(e.v.movement_type);if(type==='CARICA')mapApply(map,e.v,Number(e.v.quantity||0));else if(type==='SCARICA')mapApply(map,e.v,-Number(e.v.quantity||0));
      }else{
        if(e.v.before)mapApply(map,e.v.before,-Number(e.v.before.quantity||0));
        if(e.v.after)mapApply(map,e.v.after,Number(e.v.after.quantity||0));
      }
    }
    return [...map.values()].filter(x=>x.quantity>0.000001).sort((a,b)=>(a.article_base+a.size+locOf(a)+a.bancale+a.state).localeCompare(b.article_base+b.size+locOf(b)+b.bancale+b.state));
  }
  window.stockBuckets=rectifiedStockBuckets;

  function describeRect(before,after){
    const parts=[];
    if(!before&&after)return `RETTIFICA AGGIUNTA · ${after.quantity} pezzi`;
    if(before&&!after)return `RETTIFICA RIMOZIONE · ${before.quantity} pezzi`;
    if(!before||!after)return 'RETTIFICA';
    if(artOf(before)!==artOf(after))parts.push(`Articolo: ${artOf(before)||'—'} → ${artOf(after)||'—'}`);
    if(norm(before.size)!==norm(after.size))parts.push(`Taglia: ${norm(before.size)||'—'} → ${norm(after.size)||'—'}`);
    if(norm(before.state)!==norm(after.state))parts.push(`Stato: ${norm(before.state)||'—'} → ${norm(after.state)||'—'}`);
    if(locOf(before)!==locOf(after))parts.push(`Fila/Scaffale: ${locOf(before)||'NON ASSEGNATO'} → ${locOf(after)||'NON ASSEGNATO'}`);
    if(norm(before.bancale)!==norm(after.bancale))parts.push(`Bancale/Carrello: ${norm(before.bancale)||'—'} → ${norm(after.bancale)||'—'}`);
    if(Number(before.quantity||0)!==Number(after.quantity||0))parts.push(`Quantità: ${Number(before.quantity||0)} → ${Number(after.quantity||0)}`);
    return 'RETTIFICA · '+(parts.join(' · ')||'dati confermati');
  }

  function validateBeforeRows(changes){
    const available=new Map(rectifiedStockBuckets().map(x=>[rowKey(x),Number(x.quantity||0)])),needed=new Map();
    for(const c of changes){if(!c.before)continue;const k=rowKey(c.before);needed.set(k,(needed.get(k)||0)+Number(c.before.quantity||0))}
    for(const [k,q] of needed){if((available.get(k)||0)+1e-9<q)return {ok:false,available:available.get(k)||0,needed:q}}
    return {ok:true};
  }

  function showRectUndo(batchId,count){
    undoBatch=batchId;clearTimeout(undoTimer);document.getElementById('uxSnackbar')?.remove();
    const s=document.createElement('div');s.id='uxSnackbar';s.className='uxSnackbar';s.innerHTML=`<span>${count} rettifiche salvate · Nessun CARICA/SCARICA creato · Puoi annullare per 15 secondi.</span><button type="button">ANNULLA</button>`;document.body.appendChild(s);
    s.querySelector('button').onclick=()=>undoRectificationBatch(batchId);
    undoTimer=setTimeout(()=>{s.classList.add('fade');setTimeout(()=>s.remove(),260);if(undoBatch===batchId)undoBatch=null},15000);
  }
  function undoRectificationBatch(batchId){
    if(!batchId||undoBatch!==batchId)return;const at=nowIso(),items=ensureStore().filter(r=>r.batch_id===batchId&&!r.cancelled_at);if(!items.length)return;
    for(const r of items){const before=clone(r);r.cancelled_at=at;r.updated_at=at;if(typeof audit==='function')audit('CANCEL','RECTIFICATION',r.id,before,clone(r))}
    saveDb();undoBatch=null;document.getElementById('uxSnackbar')?.remove();window.renderStock?.();window.renderRegistry?.();LocalMaster.renderPanel?.();if(typeof warehouseToast==='function')warehouseToast('Rettifica annullata. La giacenza è stata ripristinata.','success');
  }
  window.undoRectificationBatch=undoRectificationBatch;

  window.saveStockEdit=function(){
    if(!requireLogin())return;if(!stockEditRowsDraft.length)return alert('Cerca prima un bancale/carrello da modificare.');
    const changes=[];
    for(const draft of stockEditRowsDraft){
      const before=draft.original?normalizeStockRow(draft.original):null;
      const after=(!draft.deleted&&Number(draft.quantity)>0)?normalizeStockRow(draft):null;
      if(after){if(!after.article_base)return alert('Completa il codice articolo in tutte le righe attive.');if(!after.bancale)return alert('Completa il Bancale / Carrello in tutte le righe attive. Fila/Scaffale può rimanere vuoto.')}
      if(sameRow(before,after))continue;
      if(!before&&!after)continue;
      changes.push({before,after});
    }
    if(!changes.length)return alert('Nessuna modifica da salvare.');
    const check=validateBeforeRows(changes);if(!check.ok)return alert(`La giacenza è cambiata. Disponibili ${check.available}, attesi ${check.needed}. Cerca di nuovo il bancale/carrello e riprova.`);
    const lines=changes.map(c=>describeRect(c.before,c.after)).join('\n');
    if(!confirm(`Confermi ${changes.length} rettifiche?\n\n${lines}\n\nNon verrà creato alcun CARICA o SCARICA.`))return;
    const batchId=uid(),at=nowIso();ensureStore();
    for(const c of changes){const rec={id:uid(),batch_id:batchId,type:'RETTIFICA',operator:operatorName(),registered_at:at,operation_at:at,updated_at:at,cancelled_at:null,before:c.before?clone(c.before):null,after:c.after?clone(c.after):null,note:describeRect(c.before,c.after)};db.rectifications.unshift(rec);if(typeof audit==='function')audit('CREATE','RECTIFICATION',rec.id,null,clone(rec))}
    saveDb();
    const remaining=window.stockEditRowsAtSource?window.stockEditRowsAtSource():[];
    if(remaining.length){stockEditBuildDraft(remaining);renderStockEditRows();setStatus('stockEditSearchStatus',`Rettifiche salvate. Restano ${remaining.length} righe nella posizione di origine.`,'good')}
    else{stockEditRowsDraft=[];document.getElementById('stockEditRows').innerHTML='';document.getElementById('stockEditEditor').classList.add('hidden');setStatus('stockEditSearchStatus','Rettifica salvata. La posizione di origine non contiene più giacenze.','good')}
    window.renderStock?.();window.renderRegistry?.();LocalMaster.renderPanel?.();showRectUndo(batchId,changes.length);if(typeof warehouseToast==='function')warehouseToast('Rettifica salvata senza creare movimenti fittizi.','success');
  };

  function rectTime(r){return r.registered_at||r.operation_at||r.at||''}
  function rectDisplay(r){const x=r.after||r.before||{};return {time:rectTime(r),article:artOf(x),size:norm(x.size),quantity:Number((r.after||r.before)?.quantity||0),state:norm(x.state),location:locOf(x),pallet:norm(x.bancale),operator:r.operator||'',note:r.note||describeRect(r.before,r.after),cancelled_at:r.cancelled_at||null}}
  function ensureRectFilter(){const sel=document.getElementById('uxRegType');if(sel&&![...sel.options].some(o=>o.value==='RETTIFICA')){const o=document.createElement('option');o.value='RETTIFICA';o.textContent='RETTIFICA';sel.appendChild(o)}}
  window.renderRegistry=function(){
    if(typeof baseRenderRegistry==='function')baseRenderRegistry.apply(this,arguments);ensureRectFilter();if(typeof registryTab!=='undefined'&&registryTab!=='MOVIMENTI')return;
    const list=document.getElementById('registryList');if(!list)return;
    const dest=document.getElementById('regDest')?.value||'',q=norm(document.getElementById('uxRegSearch')?.value),op=norm(document.getElementById('uxRegOperator')?.value),typ=norm(document.getElementById('uxRegType')?.value),state=norm(document.getElementById('uxRegState')?.value);
    const entries=[];
    for(const m of (db.movements||[])){if(!registryDateMatch(m.operation_at)||dest&&m.destination!==dest||op&&norm(m.operator)!==op||typ&&norm(m.movement_type)!==typ||state&&norm(m.state)!==state)continue;const hay=[m.article_base,m.size,m.state,m.movement_type,m.operator,m.document_id,locOf(m),m.bancale,m.destination,m.note].map(norm).join(' ');if(q&&!hay.includes(q))continue;entries.push({kind:'M',time:m.operation_at||m.registered_at||'',v:m})}
    if(!dest&&(!typ||typ==='RETTIFICA'))for(const r of ensureStore()){const d=rectDisplay(r);if(!registryDateMatch(d.time)||op&&norm(d.operator)!==op||state&&norm(d.state)!==state)continue;const hay=[d.article,d.size,d.state,'RETTIFICA',d.operator,d.location,d.pallet,d.note].map(norm).join(' ');if(q&&!hay.includes(q))continue;entries.push({kind:'R',time:d.time,v:r,d})}
    entries.sort((a,b)=>new Date(b.time)-new Date(a.time));
    const count=document.getElementById('uxRegCount');if(count)count.textContent=`${entries.length} registrazioni visualizzate`;
    list.innerHTML=entries.length?entries.map(e=>{if(e.kind==='M'){const m=e.v;return `<div class="movementCard ${m.cancelled_at?'cancelled':''}"><div class="movementTop"><div><div class="sku">${html(m.article_base)} ${m.size?`· ${html(m.size)}`:''}</div><div class="dateLine">${fmtDateTime(m.operation_at)}</div></div><div class="bigQty">${norm(m.movement_type)==='CARICA'?'+':'−'}${Number(m.quantity||0)}</div></div><div class="meta"><span>${html(m.movement_type)}</span><span>${html(m.state)}</span><span>Fila/Scaffale ${html(locOf(m)||'NON ASSEGNATO')}</span><span>Bancale/Carrello ${html(m.bancale||'—')}</span>${m.destination?`<span>${html(m.destination)}</span>`:''}<span>${html(m.operator)}</span>${m.document_id?`<span>${html(m.document_id)}</span>`:''}${m.cancelled_at?'<span>ANNULLATO</span>':''}</div>${m.note?`<p>${html(m.note)}</p>`:''}${!m.cancelled_at?`<div class="actions"><button class="mini" onclick="openMovementEdit('${m.id}')">MODIFICA</button><button class="mini danger" onclick="cancelMovement('${m.id}')">ANNULLA</button></div>`:''}</div>`}const r=e.v,d=e.d,bq=r.before&&r.after&&Number(r.before.quantity)!==Number(r.after.quantity)?`${Number(r.before.quantity)}→${Number(r.after.quantity)}`:`=${d.quantity}`;return `<div class="movementCard ${r.cancelled_at?'cancelled':''}"><div class="movementTop"><div><div class="sku">${html(d.article)} ${d.size?`· ${html(d.size)}`:''}</div><div class="dateLine">${fmtDateTime(d.time)}</div></div><div class="bigQty">${bq}</div></div><div class="meta"><span>RETTIFICA</span><span>${html(d.state||'—')}</span><span>Fila/Scaffale ${html(d.location||'NON ASSEGNATO')}</span><span>Bancale/Carrello ${html(d.pallet||'—')}</span><span>${html(d.operator)}</span>${r.cancelled_at?'<span>ANNULLATO</span>':''}</div><p>${html(d.note)}</p></div>`}).join(''):'<p>Nessuna registrazione trovata.</p>';
  };

  function patchMovementCounter(){const b=document.querySelector('#lmStats>div:first-child b');if(b)b.textContent=String((db.movements||[]).length+ensureStore().length)}
  LocalMaster.renderPanel=async function(){const out=await baseRenderPanel.apply(this,arguments);patchMovementCounter();return out};
  setTimeout(patchMovementCounter,100);

  function openDb(){return new Promise((ok,no)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
  async function idbGet(){const d=await openDb();return new Promise((ok,no)=>{const tx=d.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(ACTIVE);r.onsuccess=()=>{const v=r.result;d.close();ok(v)};r.onerror=()=>{const e=r.error;d.close();no(e)}})}
  async function idbPut(v){const d=await openDb();return new Promise((ok,no)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v,ACTIVE);tx.oncomplete=()=>{d.close();ok()};tx.onerror=()=>{const e=tx.error;d.close();no(e)}})}

  function xmlParse(s){const d=parser.parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror')[0])throw new Error('XML Excel non valido');return d}
  function xmlText(d){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+serializer.serializeToString(d.documentElement)}
  function local(n){return n?.localName||n?.nodeName?.split(':').pop()||''}
  function kids(n,name){return [...(n?.childNodes||[])].filter(x=>x.nodeType===1&&(!name||local(x)===name))}
  function first(n,name){return kids(n,name)[0]||null}
  function dir(p){const i=p.lastIndexOf('/');return i<0?'':p.slice(0,i)}
  function joinPath(base,target){if(target.startsWith('/'))return target.slice(1);const out=[];for(const x of `${base}/${target}`.split('/')){if(!x||x==='.')continue;if(x==='..')out.pop();else out.push(x)}return out.join('/')}
  function sheetPath(workbook,rels,name){const relMap=new Map(kids(rels.documentElement,'Relationship').map(r=>[r.getAttribute('Id'),joinPath('xl',r.getAttribute('Target'))]));const sheets=first(workbook.documentElement,'sheets');const s=kids(sheets,'sheet').find(x=>x.getAttribute('name')===name);if(!s)return '';const id=s.getAttributeNS(DOCREL,'id')||s.getAttribute('r:id');return relMap.get(id)||''}
  function colName(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
  function colIndex(ref){const m=String(ref||'').match(/^([A-Z]+)\d+$/i);if(!m)return -1;let n=0;for(const c of m[1].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1}
  function findCell(row,col){return kids(row,'c').find(c=>colIndex(c.getAttribute('r'))===col)||null}
  function setInline(doc,row,col,rowNum,value){let c=findCell(row,col);if(!c){c=doc.createElementNS(NS,'c');c.setAttribute('r',`${colName(col)}${rowNum}`);row.appendChild(c)}for(const ch of [...c.childNodes])c.removeChild(ch);c.setAttribute('r',`${colName(col)}${rowNum}`);c.setAttribute('t','inlineStr');const is=doc.createElementNS(NS,'is'),t=doc.createElementNS(NS,'t');t.textContent=String(value??'');is.appendChild(t);c.appendChild(is)}
  function resolveStateIdentity(start,rects){let cur={...start},touched=false,deleted=false;for(const r of rects){if(!r.before||rowKey(cur)!==rowKey(r.before))continue;touched=true;if(!r.after){deleted=true;break}cur={...normalizeStockRow(r.after)}}return {cur,touched,deleted}}

  async function patchSourceWorkbook(bytes){
    const rects=activeRectifications();if(!rects.length)return bytes;
    const zip=await JSZip.loadAsync(bytes),wbTxt=await zip.file('xl/workbook.xml')?.async('string'),relTxt=await zip.file('xl/_rels/workbook.xml.rels')?.async('string');if(!wbTxt||!relTxt)return bytes;
    const wbDoc=xmlParse(wbTxt),relDoc=xmlParse(relTxt),book=XLSX.read(bytes,{type:'array',cellDates:true}),sheetName=db.master?.sheet&&book.Sheets[db.master.sheet]?db.master.sheet:(book.Sheets.MAGAZZINO?'MAGAZZINO':book.SheetNames[0]),ws=book.Sheets[sheetName];if(!ws)return bytes;
    const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:true}),hr=detectMasterHeader(matrix),headers=(matrix[hr]||[]).map(x=>String(x||'').trim()),c=definitiveMasterColumns(headers),path=sheetPath(wbDoc,relDoc,sheetName),sf=zip.file(path);if(!path||!sf)return bytes;
    const doc=xmlParse(await sf.async('string')),data=first(doc.documentElement,'sheetData'),rowMap=new Map(kids(data,'row').map(r=>[Number(r.getAttribute('r')||0),r]));let changed=false;
    for(let i=hr+1;i<matrix.length;i++){
      const raw=matrix[i]||[],p=splitMasterArticleSize(raw[c.article]);if(!p.article)continue;const states=[];
      for(const [state,ci] of [['NUOVO',c.nuovo],['SCARICATO',c.scaricato],['USATO',c.usato]])if(ci>=0&&Number(raw[ci]||0)>0)states.push(state);
      if(!states.length)continue;const resolved=states.map(state=>resolveStateIdentity({article_base:p.article,size:p.size,state,quantity:Number(raw[state==='NUOVO'?c.nuovo:state==='SCARICATO'?c.scaricato:c.usato]||0),fila_scaffale:norm(raw[c.location]),bancale:norm(raw[c.bancale])},rects));
      const affected=resolved.some(x=>x.touched);if(!affected)continue;const row=rowMap.get(i+1);if(!row)continue;
      if(c.controlDate>=0)setInline(doc,row,c.controlDate,i+1,new Date().toLocaleDateString('it-IT'));
      if(resolved.every(x=>!x.deleted)){const ids=resolved.map(x=>identityKey(x.cur));if(ids.every(x=>x===ids[0])){const target=resolved[0].cur;setInline(doc,row,c.location,i+1,locOf(target));setInline(doc,row,c.bancale,i+1,norm(target.bancale));setInline(doc,row,c.article,i+1,norm(target.size)?`${artOf(target)}-${norm(target.size)}`:artOf(target));changed=true}}
    }
    if(!changed&&c.controlDate<0)return bytes;zip.file(path,xmlText(doc));internalZipBuild=true;try{return await baseGenerate.call(zip,{type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}})}finally{internalZipBuild=false}
  }

  function cellValue(doc,row,col,rowNum,value,style=''){
    const c=doc.createElementNS(NS,'c');c.setAttribute('r',`${colName(col)}${rowNum}`);if(style)c.setAttribute('s',style);
    if(typeof value==='number'){const v=doc.createElementNS(NS,'v');v.textContent=String(value);c.appendChild(v)}else{c.setAttribute('t','inlineStr');const is=doc.createElementNS(NS,'is'),t=doc.createElementNS(NS,'t');t.textContent=String(value??'');is.appendChild(t);c.appendChild(is)}return c;
  }
  function styleAt(row,col){return findCell(row,col)?.getAttribute('s')||''}
  function visibleRegistryRows(){
    const out=[];
    for(const m of (db.movements||[]))out.push({t:m.registered_at||m.operation_at||'',v:[dateText(m.registered_at||m.operation_at),m.operator||'',m.movement_type||'',m.article_base||'',m.size||'',Number(m.quantity||0),m.state||'',locOf(m),m.bancale||'',m.destination||'',m.document_id||'',m.source_request_id||'',m.note||'',m.cancelled_at?'ANNULLATO':'ATTIVO',m.cancelled_at?dateText(m.cancelled_at):'']});
    for(const r of ensureStore()){const d=rectDisplay(r);out.push({t:d.time,v:[dateText(d.time),d.operator||'','RETTIFICA',d.article||'',d.size||'',Number(d.quantity||0),d.state||'',d.location||'',d.pallet||'','','','',d.note||'',r.cancelled_at?'ANNULLATO':'ATTIVO',r.cancelled_at?dateText(r.cancelled_at):'']})}
    return out.sort((a,b)=>new Date(a.t)-new Date(b.t)).map(x=>x.v);
  }
  async function rewriteVisibleRegistry(zip){
    const wbFile=zip.file('xl/workbook.xml'),relFile=zip.file('xl/_rels/workbook.xml.rels');if(!wbFile||!relFile)return;
    const wbDoc=xmlParse(await wbFile.async('string')),relDoc=xmlParse(await relFile.async('string')),path=sheetPath(wbDoc,relDoc,'REGISTRO_MOVIMENTI'),sf=zip.file(path);if(!path||!sf)return;
    const doc=xmlParse(await sf.async('string')),data=first(doc.documentElement,'sheetData');if(!data)return;const oldRows=kids(data,'row'),oldHead=oldRows[0],oldBody=oldRows[1];
    const headers=['DATA / ORA','OPERATORE','OPERAZIONE','ARTICOLO','TAGLIA','QUANTITÀ','STATO','FILA / SCAFFALE','BANCALE','DESTINAZIONE','DOCUMENTO','RICHIESTA','NOTE','STATO MOVIMENTO','ANNULLATO IL'];
    const headStyles=headers.map((_,i)=>styleAt(oldHead,i===0?0:i+1)),bodyStyles=headers.map((_,i)=>styleAt(oldBody,i===0?0:i+1));
    for(const r of oldRows)data.removeChild(r);
    const all=[headers,...visibleRegistryRows()];all.forEach((vals,ri)=>{const row=doc.createElementNS(NS,'row'),rn=ri+1;row.setAttribute('r',String(rn));vals.forEach((v,ci)=>{if(v===''||v===null||v===undefined)return;row.appendChild(cellValue(doc,row,ci,rn,v,ri===0?headStyles[ci]:bodyStyles[ci]))});data.appendChild(row)});
    const last=Math.max(1,all.length),end=colName(headers.length-1),dim=first(doc.documentElement,'dimension'),af=first(doc.documentElement,'autoFilter');if(dim)dim.setAttribute('ref',`A1:${end}${last}`);if(af)af.setAttribute('ref',`A1:${end}${last}`);zip.file(path,xmlText(doc));
  }

  async function generateWithRectifications(options,onUpdate){if(!internalZipBuild)try{await rewriteVisibleRegistry(this)}catch(e){console.error('Registro rettifiche export',e);throw e}return baseGenerate.call(this,options,onUpdate)}
  generateWithRectifications.__warehouseRectifications=true;generateWithRectifications.__warehousePrevious=baseGenerate;JSZip.prototype.generateAsync=generateWithRectifications;

  LocalMaster.exportUpdatedMaster=async function(){
    const rects=activeRectifications();if(!rects.length)return baseExport.apply(this,arguments);
    const original=await idbGet();if(!original)return baseExport.apply(this,arguments);let replaced=false;
    try{const patched=await patchSourceWorkbook(original);await idbPut(patched);replaced=true;return await baseExport.apply(this,arguments)}finally{if(replaced)try{await idbPut(original)}catch(e){console.error('Ripristino sorgente master',e)}}
  };

  ensureStore();
  window.WarehouseStockRectifications={version:VERSION,stockBuckets:rectifiedStockBuckets,activeRectifications,describeRect,patchSourceWorkbook,rewriteVisibleRegistry};
})();
