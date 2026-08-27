/* Master Controller V2 — single authoritative import path for REMOTO V1.
   Goals:
   - one click handler, one direct V4 importer, no wrapper chain
   - Super UX version preflight + generation/high-water validation preserved
   - no native browser alert/confirm during import
   - no Registry/legacy-panel render during the critical transaction
   - compact MASTER_IMPORT audit after the transaction
   - clean no-Master dashboard UX (+ on smartphone)

   This controller MUST load immediately after warehouse-master-schema-v4.js and
   before master-generation-guard-v2.js. It captures the direct V4 importer before
   any legacy guard can wrap the global function. */
(function installWarehouseMasterControllerV2(){
  'use strict';
  if(window.WarehouseMasterControllerV2)return;

  const VERSION='2026.08.27-master-controller-v2.1';
  const GUARD_KEY='so_master_generation_guard_v1';
  const META_KEY='so_local_master_meta_v3';
  const $=id=>document.getElementById(id);
  const directImportV4=typeof window.importMappedMaster==='function'?window.importMappedMaster:null;
  let selectedFile=null,selectedBytesPromise=null,hadMasterAtSelection=false,running=false,installed=false,observer=null,refreshTimer=null;

  function text(v){return String(v??'')}
  function masterLoaded(){try{return Array.isArray(db?.master?.rows)&&db.master.rows.length>0}catch{return false}}
  function canMaster(){return window.WarehouseRoleDashboardV1?.can?.('MASTER')??true}
  function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}}
  function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value));return value}
  function patchMeta(patch){return writeJson(META_KEY,{...readJson(META_KEY),...patch,version:3})}
  function compactMaster(m){return {filename:m?.filename||'',sheet:m?.sheet||'',imported_at:m?.imported_at||null,operator:m?.operator||'',schema:m?.schema||'',rows_count:Array.isArray(m?.rows)?m.rows.length:0}}
  function toast(message,type='success'){try{if(typeof warehouseToast==='function')warehouseToast(message,type);else console.log('[MASTER V2]',message)}catch{}}
  function stripHtml(value){const d=document.createElement('div');d.innerHTML=text(value);return d.textContent||d.innerText||''}

  function setInfo(message,type='error',allowHtml=false){
    const info=$('masterPreviewInfo');if(!info)return;
    info.className=`status ${type}`;
    if(allowHtml)info.innerHTML=message;else info.textContent=message;
    info.classList.remove('hidden');
  }

  function rememberProtectedImport(inspection,fileName){
    if(!inspection?.protected)return;
    const g=readJson(GUARD_KEY),oldMax=Number(g.maxGeneration)||0,newMax=Math.max(oldMax,Number(inspection.generation)||0);
    writeJson(GUARD_KEY,{...g,lineageId:inspection.lineage,maxGeneration:newMax,maxHash:Number(inspection.generation)>=oldMax?inspection.stateHash:g.maxHash,lastKnownAt:inspection.exportedAt||new Date().toISOString(),lastKnownName:fileName||g.lastKnownName||'',version:1});
    patchMeta({sourceGeneration:Number(inspection.generation)||0,sourceLineage:inspection.lineage||'',sourceStateHash:inspection.stateHash||''});
  }

  async function uxPreflight(){
    const preflight=window.WarehouseUX?.beforeMasterImport;
    if(typeof preflight!=='function')return true;
    try{
      const allowed=await preflight();
      if(allowed===false){setInfo('Importazione annullata. Il Master attuale non è stato modificato.','');return false}
      return true;
    }catch(err){
      console.error('[MASTER V2] preflight',err);
      setInfo('Non è stato possibile completare il controllo preliminare del Master. Riprova.','error');
      return false;
    }
  }

  async function generationCheck(){
    if(!selectedFile||!selectedBytesPromise)return {ok:true,inspection:null};
    const api=window.WarehouseMasterGenerationGuard;
    /* The generation guard loads after this controller. At actual user interaction
       it is normally present; if not, fail closed only when a previous high-water
       generation exists. */
    const high=Number(readJson(GUARD_KEY).maxGeneration)||0;
    if(!api?.inspectWorkbookBytes||!api?.validateInspection){
      if(high>0){setInfo('Controllo sicurezza Master non disponibile. Ricarica la pagina prima di importare.','error');return {ok:false}}
      return {ok:true,inspection:null};
    }
    let bytes;try{bytes=await selectedBytesPromise}catch(err){setInfo('Non riesco a leggere il file selezionato. Selezionalo di nuovo.','error');return {ok:false,error:err}}
    let inspection;try{inspection=api.inspectWorkbookBytes(bytes)}catch(err){setInfo('Il file Excel non può essere verificato. Nessun dato è stato modificato.','error');return {ok:false,error:err}}
    const verdict=api.validateInspection(inspection);
    if(!verdict?.ok){
      const body=verdict?.body?stripHtml(verdict.body):'Importazione bloccata per sicurezza.';
      setInfo(`<b>${text(verdict?.title||'Master non importabile')}</b><br>${text(body)}`,'error',true);
      toast(verdict?.title||'Importazione Master bloccata.','error');
      return {ok:false,inspection,verdict};
    }
    return {ok:true,inspection};
  }

  function appendCompactImportAudit(beforeMaster,afterMaster){
    try{
      if(!Array.isArray(db.audits))db.audits=[];
      db.audits.unshift({id:typeof uid==='function'?uid():`${Date.now()}-MASTER`,action:'MASTER_IMPORT',entityType:'MASTER',entityId:'MASTER',operator:typeof operatorName==='function'?operatorName():'',at:new Date().toISOString(),before:compactMaster(beforeMaster),after:compactMaster(afterMaster)});
      saveDb();
    }catch(err){console.warn('[MASTER V2] audit compatto non salvato',err)}
  }

  function captureFile(event){
    const input=event.target;if(!input||input.id!=='masterInput')return;
    const f=input.files?.[0]||null;
    selectedFile=f&&/\.xlsx$/i.test(f.name)?f:null;
    selectedBytesPromise=selectedFile?selectedFile.arrayBuffer():null;
    hadMasterAtSelection=masterLoaded();
    setTimeout(()=>{decorateImportDialog();bindConfirmButton()},0);
  }

  function decorateImportDialog(){
    const dlg=$('masterDialog');if(!dlg)return;
    const warning=[...dlg.querySelectorAll('.status.warn')].find(el=>/sostituit|sostituisce|master attualmente caricato/i.test(el.textContent||''));
    if(warning){
      warning.classList.toggle('hidden',!hadMasterAtSelection);
      if(hadMasterAtSelection)warning.textContent='ATTENZIONE: IL MASTER ATTUALMENTE CARICATO VERRÀ SOSTITUITO.';
    }
    let cancel=dlg.querySelector('.lmMasterCancel');
    const confirm=dlg.querySelector('.btn.success');
    if(confirm&&!cancel){cancel=document.createElement('button');cancel.type='button';cancel.className='btn soft lmMasterCancel';cancel.textContent='ANNULLA';cancel.onclick=()=>{if(!running)dlg.close()};confirm.insertAdjacentElement('beforebegin',cancel)}
  }

  /* Keep one global import implementation too. The Generation Guard still wraps export,
     but its historical import wrapper is not needed when this controller is active. */
  function normalizeGlobalImport(){
    if(directImportV4&&window.importMappedMaster!==directImportV4)window.importMappedMaster=directImportV4;
  }

  async function executeImport(event,button){
    if(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
    if(running)return false;
    if(typeof directImportV4!=='function'){setInfo('Motore Master V4 non disponibile. Ricarica la pagina.','error');return false}
    if(!selectedFile){setInfo('Seleziona nuovamente il file Master Excel prima di confermare.','error');return false}

    running=true;
    const dlg=$('masterDialog'),cancel=dlg?.querySelector('.lmMasterCancel'),close=dlg?.querySelector('.dialogHead button'),oldText=button?.textContent||'CONFERMA IMPORTAZIONE';
    const beforeMaster=(()=>{try{return structuredClone(db?.master||{})}catch{return {...(db?.master||{})}}})();
    const beforeAt=db?.master?.imported_at||'';
    if(button){button.disabled=true;button.textContent='IMPORTAZIONE IN CORSO…'}if(cancel)cancel.disabled=true;if(close)close.disabled=true;
    setInfo('Verifica preliminare del Master…','warn');

    let inspection=null;
    try{
      if(!await uxPreflight())return false;
      const guard=await generationCheck();if(!guard.ok)return false;inspection=guard.inspection;
      setInfo('Importazione del Master in corso. Non chiudere questa schermata…','warn');

      /* Isolate the transaction from historical UI wrappers. The importer mutates/persists
         the warehouse data, while rendering is performed once after successful commit. */
      const savedConfirm=window.confirm,savedAlert=window.alert,savedAudit=window.audit,savedRenderRegistry=window.renderRegistry;
      const savedPanel=window.LocalMaster?.renderPanel;
      const messages=[];
      window.confirm=()=>true;
      window.alert=msg=>{messages.push(text(msg))};
      if(typeof savedAudit==='function')window.audit=function(action){if(action==='MASTER_IMPORT')return;return savedAudit.apply(this,arguments)};
      if(typeof savedRenderRegistry==='function')window.renderRegistry=function(){return true};
      if(window.LocalMaster&&typeof savedPanel==='function')window.LocalMaster.renderPanel=async function(){return true};

      let result;
      try{result=directImportV4.call(window);if(result&&typeof result.then==='function')result=await result}
      finally{
        window.confirm=savedConfirm;window.alert=savedAlert;if(typeof savedAudit==='function')window.audit=savedAudit;if(typeof savedRenderRegistry==='function')window.renderRegistry=savedRenderRegistry;if(window.LocalMaster&&typeof savedPanel==='function')window.LocalMaster.renderPanel=savedPanel;
      }

      const afterAt=db?.master?.imported_at||'',ok=masterLoaded()&&afterAt&&afterAt!==beforeAt;
      if(!ok){
        const failure=messages.find(m=>!/Master V4 importato:/i.test(m))||'Il Master non è stato salvato. Seleziona nuovamente il file e riprova.';
        setInfo(failure,'error');toast('Importazione Master non riuscita.','error');return false;
      }

      appendCompactImportAudit(beforeMaster,db.master);
      rememberProtectedImport(inspection,selectedFile.name);
      selectedFile=null;selectedBytesPromise=null;hadMasterAtSelection=false;
      try{dlg?.close()}catch{}
      try{if(typeof renderMasterStatus==='function')renderMasterStatus()}catch(err){console.warn('[MASTER V2] renderMasterStatus',err)}
      try{window.WarehouseRoleDashboardV1?.renderDashboard?.()}catch(err){console.warn('[MASTER V2] dashboard',err)}
      try{window.WarehouseMasterPanelMinimizeV2?.refresh?.()}catch{}
      decorateDashboardMaster();
      toast(`Master Excel caricato · ${(db.master?.rows||[]).length.toLocaleString('it-IT')} giacenze`,'success');
      return result??true;
    }catch(err){
      console.error('[MASTER V2] importazione fallita',err);
      setInfo('Importazione non riuscita: '+text(err?.message||err||'Errore sconosciuto'),'error');
      toast('Importazione Master non riuscita.','error');
      return false;
    }finally{
      running=false;
      if(button){button.disabled=false;button.textContent=oldText}
      if(cancel)cancel.disabled=false;if(close)close.disabled=false;
      normalizeGlobalImport();decorateImportDialog();
    }
  }

  function bindConfirmButton(){
    const dlg=$('masterDialog'),old=dlg?.querySelector('.btn.success');if(!old)return false;
    if(old.dataset.masterControllerV2==='1')return true;
    const button=old.cloneNode(true);button.dataset.masterControllerV2='1';button.dataset.hardImportBound='1';button.removeAttribute('onclick');button.onclick=null;old.replaceWith(button);
    button.addEventListener('click',event=>executeImport(event,button),true);
    decorateImportDialog();return true;
  }

  function chooseImport(){
    if(!canMaster()){window.WarehouseRoleDashboardV1?.deny?.('Importazione Master');return false}
    try{$('rdMasterDialog')?.close()}catch{}
    if(window.LocalMaster?.chooseImport)return window.LocalMaster.chooseImport();
    const input=$('masterInput');if(input){input.click();return true}return false;
  }

  function installTrigger(){
    const current=window.triggerMasterImportV1;
    if(typeof current==='function'&&!current.__masterControllerV2){
      const f=function(){return chooseImport()};f.__masterControllerV2=true;f.__previous=current;window.triggerMasterImportV1=f;
    }
  }

  function decorateDashboardMaster(){
    installTrigger();
    const card=document.querySelector('#rdDashboardV1 .rdMaster');if(!card)return false;
    const loaded=masterLoaded(),ready=card.querySelector('.rdReady'),details=card.querySelector('.rdMasterDetails');
    card.classList.toggle('rdMasterEmptyV2',!loaded);
    if(!loaded){
      if(ready)ready.textContent='DA CARICARE';
      const state=card.querySelector('.rdMasterState b');if(state)state.textContent='Master non caricato';
      const metrics=card.querySelectorAll('.rdMasterMetric');if(metrics[0])metrics[0].querySelector('b').textContent='0';if(metrics[1])metrics[1].querySelector('b').textContent='—';
      if(details){
        if(canMaster()){
          details.classList.add('rdMasterAddV2');details.innerHTML='<span class="rdMasterAddPlusV2">+</span><span class="rdMasterAddTextV2">CARICA MASTER EXCEL</span>';details.onclick=chooseImport;details.setAttribute('aria-label','Carica Master Excel');details.title='Carica Master Excel';
        }else{details.classList.remove('rdMasterAddV2');details.textContent='';details.style.display='none'}
      }
    }else if(details){
      details.style.removeProperty('display');details.classList.remove('rdMasterAddV2');details.textContent='DETTAGLI';details.onclick=()=>window.openMasterDetailsV1?.();details.setAttribute('aria-label','Dettagli Master Excel');details.title='Dettagli Master Excel';
    }
    return true;
  }

  function patchNoMasterDetails(){
    const dialog=$('rdMasterDialog'),body=$('rdMasterDialogBody');if(!dialog?.open||!body||masterLoaded())return;
    body.innerHTML='<div class="rdMasterInfoGrid"><div class="rdInfoCell"><span>Stato</span><b>Nessun Master importato</b></div><div class="rdInfoCell"><span>Righe</span><b>0</b></div></div>'+(canMaster()?'<div class="rdDialogActions"><button id="rdMasterAddDialogV2" class="primary full" type="button">CARICA MASTER EXCEL</button></div>':'');
    const b=$('rdMasterAddDialogV2');if(b)b.onclick=chooseImport;
  }

  function ensureCss(){
    if($('masterControllerV2Css'))return;
    const style=document.createElement('style');style.id='masterControllerV2Css';style.textContent=`
      #rdDashboardV1 .rdMasterDetails.rdMasterAddV2{display:inline-flex;align-items:center;justify-content:center;gap:8px}
      #rdDashboardV1 .rdMasterAddPlusV2{font-size:22px;line-height:1;font-weight:700}
      @media(max-width:899px){
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2{grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center!important;min-height:92px!important;padding:14px 16px!important;gap:10px!important}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdMasterMetric{display:none!important}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdMasterDetails.rdMasterAddV2{width:48px!important;height:48px!important;min-width:48px!important;padding:0!important;border-radius:50%!important;font-size:28px!important;justify-self:end!important}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdMasterAddTextV2{display:none!important}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdMasterAddPlusV2{font-size:30px!important;font-weight:500!important;transform:translateY(-1px)}
        body:not(.desktopMode) #rdDashboardV1 .rdMaster.rdMasterEmptyV2 .rdMasterMain{min-width:0!important}
      }
    `;document.head.appendChild(style);
  }

  function decorate(){normalizeGlobalImport();bindConfirmButton();decorateImportDialog();decorateDashboardMaster();patchNoMasterDetails()}
  function schedule(){requestAnimationFrame(decorate)}
  function install(){
    if(installed){decorate();return true}
    installed=true;ensureCss();document.addEventListener('change',captureFile,true);decorate();
    observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
    refreshTimer=setInterval(decorate,800);
    window.addEventListener('resize',decorate,{passive:true});
    return true;
  }

  window.WarehouseMasterControllerV2={version:VERSION,install,executeImport,chooseImport,decorate,masterLoaded,directImportV4,uxPreflight};
  install();
})();
