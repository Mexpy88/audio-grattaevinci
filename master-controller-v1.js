/* Warehouse Master Controller V1
   Single authoritative import path for REMOTO V1.
   No wrapper chains: file -> Generation Guard -> Master V4 parser -> DB/IndexedDB -> UI.
*/
(function installWarehouseMasterControllerV1(){
  'use strict';
  if(window.WarehouseMasterControllerV1)return;

  const VERSION='2026.08.28-master-controller1';
  const DB_NAME='so_warehouse_files_v1',DB_STORE='files',DB_ACTIVE='active-master-xlsx';
  const META_KEY='so_local_master_meta_v3',GUARD_KEY='so_master_generation_guard_v1';
  const DATA_SHEET='APP_DATI',MARKER='SO_WAREHOUSE_APP_DATA_V3';
  const $=id=>document.getElementById(id);
  const now=()=>new Date().toISOString();
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const text=v=>String(v??'');
  let selectedPromise=null,selected=null,boundButton=null,observer=null,scheduled=false;

  function loaded(){try{return Array.isArray(db?.master?.rows)&&db.master.rows.length>0}catch{return false}}
  function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}}
  function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value));return value}
  function dirtyCount(){
    if(!loaded())return 0;
    try{const m=readJson(META_KEY),base=m.lastExportAt||m.importedAt;if(!base)return(db?.audits||[]).length;const t=new Date(base).getTime();return(db?.audits||[]).filter(a=>new Date(a.at||0).getTime()>t).length}catch{return 0}
  }
  function toast(message,type='success'){try{if(typeof warehouseToast==='function')warehouseToast(message,type);else console.log('[MASTER]',message)}catch{}}
  function setInfo(message,type='error'){
    const info=$('masterPreviewInfo');if(info){info.className='status '+type;info.textContent=message}
  }

  function openDb(){return new Promise((ok,no)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(DB_STORE))r.result.createObjectStore(DB_STORE)};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
  async function idbPut(bytes){const d=await openDb();return new Promise((ok,no)=>{const tx=d.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(bytes,DB_ACTIVE);tx.oncomplete=()=>{d.close();ok()};tx.onerror=()=>{const e=tx.error;d.close();no(e)}})}
  async function idbGet(){const d=await openDb();return new Promise((ok,no)=>{const tx=d.transaction(DB_STORE,'readonly'),r=tx.objectStore(DB_STORE).get(DB_ACTIVE);r.onsuccess=()=>{const v=r.result;d.close();ok(v)};r.onerror=()=>{const e=r.error;d.close();no(e)}})}

  function ensurePrompt(){
    let d=$('masterControllerPromptV1');if(d)return d;
    d=document.createElement('dialog');d.id='masterControllerPromptV1';d.className='rdMasterDialog';
    d.innerHTML='<div class="rdDialogHead"><h2 id="mcpTitleV1">Master Excel</h2><button type="button" id="mcpCloseV1">×</button></div><div id="mcpBodyV1" class="rdDialogBody"></div><div id="mcpActionsV1" class="rdDialogActions"></div>';
    document.body.appendChild(d);$('mcpCloseV1').onclick=()=>d.close();return d;
  }
  function prompt({title,body,actions}){
    return new Promise(resolve=>{
      const d=ensurePrompt();$('mcpTitleV1').textContent=title;$('mcpBodyV1').innerHTML=body;$('mcpActionsV1').innerHTML='';
      let done=false;const finish=v=>{if(done)return;done=true;try{d.close()}catch{}resolve(v)};
      for(const a of actions){const b=document.createElement('button');b.type='button';b.className=a.kind||'soft';b.textContent=a.label;b.onclick=()=>finish(a.value);$('mcpActionsV1').appendChild(b)}
      d.oncancel=e=>{e.preventDefault();finish('cancel')};try{d.showModal()}catch{resolve('cancel')}
    });
  }

  async function chooseImport(){
    try{if(!currentUser){openLogin();return false}}catch{return false}
    if(loaded()&&dirtyCount()>0){
      const n=dirtyCount(),choice=await prompt({title:'Modifiche non ancora esportate',body:`<p>Ci sono <b>${n}</b> modifiche successive all’ultimo export.</p><p>Prima di sostituire il Master è consigliato esportare il file aggiornato.</p>`,actions:[{label:'ANNULLA',value:'cancel',kind:'soft'},{label:'ESPORTA PRIMA',value:'export',kind:'success'},{label:'CONTINUA',value:'continue',kind:'danger'}]});
      if(choice==='cancel')return false;if(choice==='export'){await window.LocalMaster?.exportUpdatedMaster?.();return false}if(choice!=='continue')return false;
    }
    const input=$('masterInput');if(!input){toast('Selettore Master Excel non disponibile.','error');return false}
    input.value='';input.click();return true;
  }

  function prepareSelected(file,bytes){
    const wb=XLSX.read(bytes,{type:'array',cellDates:true,cellStyles:true}),sheet=$('masterSheet');
    selected={file,bytes,wb};
    try{masterWorkbook=wb;masterFileName=file.name}catch{}
    if(sheet){sheet.innerHTML=wb.SheetNames.map(n=>`<option value="${text(n).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">${text(n)}</option>`).join('');sheet.value=wb.SheetNames.includes('MAGAZZINO')?'MAGAZZINO':wb.SheetNames[0]}
    try{if(typeof prepareMasterSheet==='function')prepareMasterSheet()}catch(e){console.warn('Preview Master V4',e)}
    const dlg=$('masterDialog');if(dlg&&!dlg.open){try{dlg.showModal()}catch{}}
    decorateImportDialog();return selected;
  }

  function captureFile(){
    const input=$('masterInput');if(!input||input.dataset.masterControllerCapture==='1')return false;
    input.dataset.masterControllerCapture='1';
    input.addEventListener('change',e=>{
      const file=e.target.files?.[0];if(!file)return;
      if(!/\.xlsx$/i.test(file.name)){selected=null;selectedPromise=null;setInfo('Seleziona un file Excel .xlsx valido.','error');return}
      selectedPromise=file.arrayBuffer().then(bytes=>prepareSelected(file,bytes)).catch(err=>{selected=null;setInfo('Impossibile leggere il file Excel: '+(err?.message||err),'error');throw err});
    },true);return true;
  }

  function parseEmbeddedDb(wb){
    const ws=wb?.Sheets?.[DATA_SHEET];if(!ws)return null;const a=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});if(text(a?.[0]?.[0])!==MARKER)return null;
    const chunks=[];for(let i=4;i<a.length;i++)if(a[i]?.[0])chunks.push(text(a[i][0]));if(!chunks.length)return null;
    try{const p=JSON.parse(chunks.join(''));return p?.db?p:null}catch(e){console.warn('APP_DATI non leggibile',e);return null}
  }
  function restoreEmbedded(payload,importedMaster){
    const base=typeof blankDb==='function'?blankDb():{version:3,master:{rows:[]},movements:[],documents:[],requests:[],audits:[],counters:{scarico:0,request:0}};
    const saved=payload.db||{};
    db={...base,...saved,master:importedMaster,counters:{...(base.counters||{}),...(saved.counters||{})},movements:Array.isArray(saved.movements)?saved.movements:[],documents:Array.isArray(saved.documents)?saved.documents:[],requests:Array.isArray(saved.requests)?saved.requests:[],audits:Array.isArray(saved.audits)?saved.audits:[],rectifications:Array.isArray(saved.rectifications)?saved.rectifications:[]};
    db.app_meta={...(saved.app_meta||{}),master_schema:'MASTER_V4'};
  }
  function resetForNewMaster(importedMaster){
    const base=typeof blankDb==='function'?blankDb():{version:3,master:{rows:[]},movements:[],documents:[],requests:[],audits:[],counters:{scarico:0,request:0}};
    db={...base,master:importedMaster,rectifications:[],app_meta:{master_schema:'MASTER_V4'}};db.master_reset_at=null;
  }

  function rememberProtectedImport(inspection,fileName){
    if(!inspection?.protected)return;
    const g=readJson(GUARD_KEY),oldMax=Math.max(0,Math.floor(Number(g.maxGeneration)||0)),newMax=Math.max(oldMax,inspection.generation);
    writeJson(GUARD_KEY,{...g,lineageId:inspection.lineage,maxGeneration:newMax,maxHash:inspection.generation>=oldMax?inspection.stateHash:g.maxHash,lastKnownAt:inspection.exportedAt||now(),lastKnownName:fileName||g.lastKnownName||'',version:1});
    const m=readJson(META_KEY);writeJson(META_KEY,{...m,sourceGeneration:inspection.generation,sourceLineage:inspection.lineage,sourceStateHash:inspection.stateHash,version:3});
  }

  async function validateGuard(bytes){
    const guard=window.WarehouseMasterGenerationGuard;
    if(!guard?.inspectWorkbookBytes||!guard?.validateInspection)throw new Error('Protezione Master non disponibile. Ricarica la pagina prima di importare.');
    const inspection=guard.inspectWorkbookBytes(bytes),verdict=guard.validateInspection(inspection);
    if(!verdict.ok){
      await prompt({title:verdict.title||'Master non importabile',body:verdict.body||'<p>Il file non supera i controlli di sicurezza.</p>',actions:[{label:'CHIUDI',value:'close',kind:'primary'}]});
      return null;
    }
    return inspection;
  }

  function parseV4(wb){
    const api=window.WarehouseMasterSchemaV4;if(!api?.parseMasterRows||!api?.definitiveMasterColumns||!api?.isDefinitiveMaster)throw new Error('Parser Master V4 non disponibile.');
    const sheetName=$('masterSheet')?.value|| (wb.SheetNames.includes('MAGAZZINO')?'MAGAZZINO':wb.SheetNames[0]),ws=wb.Sheets[sheetName];if(!ws)throw new Error('Foglio Excel non trovato.');
    const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,blankrows:false}),hr=typeof detectMasterHeader==='function'?detectMasterHeader(matrix):0,headers=(matrix[hr]||[]).map(v=>text(v).trim()),cols=api.definitiveMasterColumns(headers);
    if(!api.isDefinitiveMaster(cols))throw new Error('Struttura Master non valida. Servono le colonne ufficiali A:I: SCAFFALE / FILA, BANCALE, ARTICOLO, TAGLIA, NUOVO, SCARICATO, USATO, NOTE, DATA CONTROLLO QUANTITÀ.');
    const rows=api.parseMasterRows(matrix,hr,headers);if(!rows.length)throw new Error('Non sono state trovate giacenze positive valide nel Master.');
    return {rows,sheetName,excelRows:Math.max(0,matrix.length-hr-1)};
  }

  function setRunning(running){
    const btn=boundButton||$('masterDialog')?.querySelector('.btn.success'),dlg=$('masterDialog'),cancel=dlg?.querySelector('.lmMasterCancel'),close=dlg?.querySelector('.dialogHead button');
    if(btn){btn.disabled=running;btn.textContent=running?'⏳ IMPORTAZIONE IN CORSO…':'CONFERMA IMPORTAZIONE'}if(cancel)cancel.disabled=running;if(close)close.disabled=running;
  }

  async function confirmImport(event){
    if(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
    if(boundButton?.dataset.running==='1')return false;
    if(boundButton)boundButton.dataset.running='1';setRunning(true);setInfo('Verifica e importazione del Master in corso…','warn');
    let before=null;
    try{
      if(selectedPromise)await selectedPromise;
      if(!selected?.file||!selected?.bytes||!selected?.wb)throw new Error('Seleziona prima il file Master Excel.');
      const inspection=await validateGuard(selected.bytes);if(!inspection){setInfo('Importazione annullata: il Master non supera i controlli di sicurezza.','error');return false}
      const parsed=parseV4(selected.wb),at=now(),importedMaster={rows:parsed.rows,imported_at:at,filename:selected.file.name,sheet:parsed.sheetName,operator:typeof operatorName==='function'?operatorName():'',schema:'MASTER_V4',columns:['SCAFFALE / FILA','BANCALE','ARTICOLO','TAGLIA','NUOVO','SCARICATO','USATO','NOTE','DATA CONTROLLO QUANTITÀ']};
      before=clone(db);
      const embedded=parseEmbeddedDb(selected.wb);if(embedded)restoreEmbedded(embedded,importedMaster);else resetForNewMaster(importedMaster);
      saveDb();await idbPut(selected.bytes.slice(0));
      const meta=readJson(META_KEY);writeJson(META_KEY,{...meta,fileName:selected.file.name,excelRows:parsed.excelRows,importedAt:at,lastExportAt:at,lastExportName:'',sourceHasAppData:!!embedded,version:3});rememberProtectedImport(inspection,selected.file.name);
      try{if(typeof renderMasterStatus==='function')renderMasterStatus()}catch{}
      try{window.WarehouseRoleDashboardV1?.renderDashboard?.()}catch{}
      try{window.WarehousePremiumDashboardV2?.install?.()}catch{}
      try{await safeLegacyRenderPanel()}catch{}
      try{$('masterDialog')?.close()}catch{}
      selected=null;selectedPromise=null;const input=$('masterInput');if(input)input.value='';
      toast(`✓ MASTER IMPORTATO · ${parsed.rows.length.toLocaleString('it-IT')} GIACENZE`,'success');
      decorateDashboard();return true;
    }catch(err){
      console.error('[MASTER CONTROLLER]',err);
      if(before){try{db=before;saveDb()}catch(rollbackErr){console.error('Rollback Master fallito',rollbackErr)}}
      const msg=text(err?.message||err||'Errore sconosciuto');setInfo('Importazione non riuscita: '+msg,'error');toast('Importazione Master non riuscita.','error');return false;
    }finally{
      if(boundButton)delete boundButton.dataset.running;setRunning(false);decorateImportDialog();
    }
  }

  async function safeLegacyRenderPanel(){
    const panel=$('localMasterPanel'),isLoaded=loaded();document.body.classList.toggle('lmNoMaster',!isLoaded);if(!panel)return true;
    const title=$('lmTitle'),state=$('lmState'),sub=$('lmSub'),stats=$('lmStats'),pending=$('lmPending'),imp=$('lmImportBtn'),exp=$('lmExportBtn'),manage=$('lmManageBtn');if(!title)return true;
    if(!isLoaded){title.textContent='Nessun master caricato';if(state){state.className='lmPill offline';state.textContent='NON CARICATO'}if(sub)sub.textContent='';stats?.classList.add('hidden');pending?.classList.add('hidden');if(imp)imp.textContent='CARICA MASTER';exp?.classList.add('hidden');manage?.classList.add('hidden');return true}
    const meta=readJson(META_KEY),dirty=dirtyCount();title.textContent=db.master?.filename||'Master Excel';if(state){state.className='lmPill online';state.textContent='PRONTO'}if(sub)sub.textContent=`${db.master.rows.length.toLocaleString('it-IT')} giacenze`;if(pending){pending.classList.remove('hidden');pending.className=`lmPending ${dirty?'warn':'ok'}`;pending.textContent=dirty?`${dirty} modifiche dall’ultimo export`:'Nessuna modifica in attesa di export'}if(imp)imp.textContent='SOSTITUISCI / REIMPORTA';try{const hasBytes=!!(await idbGet());exp?.classList.toggle('hidden',!hasBytes)}catch{exp?.classList.add('hidden')}manage?.classList.remove('hidden');return true;
  }

  function bindConfirm(){
    const dlg=$('masterDialog'),old=dlg?.querySelector('.btn.success');if(!old)return false;
    if(old.dataset.masterControllerV1==='1'){boundButton=old;return true}
    const fresh=old.cloneNode(true);fresh.type='button';fresh.dataset.masterControllerV1='1';fresh.dataset.hardImportBound='controller';fresh.removeAttribute('onclick');fresh.onclick=null;old.replaceWith(fresh);boundButton=fresh;fresh.addEventListener('click',confirmImport,true);
    if(!dlg.querySelector('.lmMasterCancel')){const cancel=document.createElement('button');cancel.type='button';cancel.className='btn soft lmMasterCancel';cancel.textContent='ANNULLA';cancel.onclick=()=>{if(!fresh.disabled)dlg.close()};fresh.insertAdjacentElement('beforebegin',cancel)}
    return true;
  }

  function decorateImportDialog(){
    const dlg=$('masterDialog');if(!dlg)return;
    const warning=[...dlg.querySelectorAll('.status.warn')].find(el=>/sostituisce|MASTER ATTUALMENTE CARICATO/i.test(el.textContent||''));if(warning){warning.classList.toggle('hidden',!loaded());if(loaded())warning.textContent='ATTENZIONE: IL MASTER ATTUALMENTE CARICATO VERRÀ SOSTITUITO.'}
  }

  function injectCss(){
    if($('masterControllerV1Css'))return;const s=document.createElement('style');s.id='masterControllerV1Css';s.textContent=`
      @media(max-width:899px){body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdNoMaster .rdMasterDetails{width:52px!important;min-width:52px!important;height:52px!important;padding:0!important;border-radius:50%!important;font-size:0!important;display:grid!important;place-items:center!important}body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdNoMaster .rdMasterDetails:before{content:'+';font-size:32px;line-height:1;font-weight:700;color:#285fa8}body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdNoMaster .rdMasterFile{display:none!important}}
    `;document.head.appendChild(s);
  }

  function decorateDashboard(){
    const card=document.querySelector('#rdDashboardV1 .rdMaster');if(!card)return false;const noMaster=!loaded();card.classList.toggle('rdNoMaster',noMaster);
    const ready=card.querySelector('.rdReady'),details=card.querySelector('.rdMasterDetails'),state=card.querySelector('.rdMasterState b');
    if(noMaster){if(ready)ready.textContent='DA CARICARE';if(state)state.textContent='Master non caricato';if(details){details.textContent='CARICA MASTER EXCEL';details.setAttribute('onclick','WarehouseMasterControllerV1.chooseImport()');details.setAttribute('aria-label','Carica Master Excel');details.title='Carica Master Excel'}}
    else if(details&&details.getAttribute('onclick')?.includes('WarehouseMasterControllerV1')){details.textContent='DETTAGLI';details.setAttribute('onclick','openMasterDetailsV1()');details.setAttribute('aria-label','Dettagli Master Excel');details.title='Dettagli Master Excel'}
    return true;
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;bindConfirm();captureFile();decorateImportDialog();decorateDashboard()})}
  function install(){
    injectCss();captureFile();bindConfirm();decorateImportDialog();decorateDashboard();
    if(window.LocalMaster)window.LocalMaster.renderPanel=safeLegacyRenderPanel;
    /* Compatibility global: every legacy call now lands on the same direct controller. */
    window.importMappedMaster=confirmImport;
    if(!observer){observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true})}
    return true;
  }

  window.WarehouseMasterControllerV1={version:VERSION,install,chooseImport,confirmImport,loaded,dirtyCount,safeLegacyRenderPanel,decorateDashboard};
  install();
})();
