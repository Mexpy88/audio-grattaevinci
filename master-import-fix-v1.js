/* Master Import Fix V1
   Surgical hardening for the current REMOTO V1 build:
   - prevents recursive LocalMaster.renderPanel chains
   - keeps the Master import confirm button bound once
   - suppresses duplicate native error alerts
   - gives the empty Master state one clear action: CARICA MASTER EXCEL
   - never reports pending export work when no Master is loaded
*/
(function installWarehouseMasterImportFixV1(){
  'use strict';
  if(window.WarehouseMasterImportFixV1)return;

  const VERSION='2026.08.27-master-import-fix1';
  const META_KEY='so_local_master_meta_v3';
  const $=id=>document.getElementById(id);
  let installed=false,observer=null,timer=null,baseOpenDetails=null,schemaInstallNeutralized=false;

  function loaded(){try{return Array.isArray(db?.master?.rows)&&db.master.rows.length>0}catch{return false}}
  function canMaster(){return window.WarehouseRoleDashboardV1?.can?.('MASTER')??true}
  function readMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')||{}}catch{return {}}}
  function fmt(v){if(!v)return'—';try{return new Date(v).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return'—'}}
  function dirtyCount(){
    if(!loaded())return 0;
    try{const m=readMeta(),base=m.lastExportAt||m.importedAt;if(!base)return Array.isArray(db?.audits)?db.audits.length:0;const t=new Date(base).getTime();return(db?.audits||[]).filter(a=>new Date(a.at||0).getTime()>t).length}catch{return 0}
  }
  function setText(el,value){const v=String(value??'');if(el&&el.textContent!==v)el.textContent=v}
  function setHidden(el,hidden){if(el&&el.classList.contains('hidden')!==!!hidden)el.classList.toggle('hidden',!!hidden)}

  /* LocalMaster.renderPanel has accumulated several historical wrappers.  The current
     dashboard no longer depends on that legacy panel, but the V4 importer still awaits
     it after persisting a workbook.  Use one small non-recursive renderer instead. */
  async function safeRenderPanel(){
    const panel=$('localMasterPanel');
    const isLoaded=loaded();
    document.body.classList.toggle('lmNoMaster',!isLoaded);
    if(!panel)return true;
    const title=$('lmTitle'),state=$('lmState'),sub=$('lmSub'),stats=$('lmStats'),pending=$('lmPending'),imp=$('lmImportBtn'),exp=$('lmExportBtn'),manage=$('lmManageBtn');
    if(!title)return true;
    if(!isLoaded){
      setText(title,'Nessun master caricato');
      if(state){state.className='lmPill offline';setText(state,'NON CARICATO')}
      setText(sub,'Importa il file .xlsx ufficiale prima di iniziare le operazioni.');
      setHidden(stats,true);setHidden(pending,true);
      setText(imp,'📥 CARICA MASTER EXCEL');setHidden(exp,true);setHidden(manage,true);
      try{window.WarehouseMasterPanelMinimizeV2?.setMinimized?.(false,false)}catch{}
      return true;
    }
    const m=readMeta(),dirty=dirtyCount(),moves=(db?.movements||[]).length,docs=(db?.documents||[]).length,reqs=(db?.requests||[]).length;
    setText(title,db.master?.filename||'Master Excel');
    if(state){state.className='lmPill online';setText(state,'PRONTO')}
    setText(sub,`Importato ${fmt(db.master?.imported_at)} · ${m.excelRows||db.master.rows.length} righe Excel`);
    if(stats){setHidden(stats,false);stats.innerHTML=`<div><b>${moves}</b><span>Movimenti</span></div><div><b>${docs}</b><span>Scarichi</span></div><div><b>${reqs}</b><span>Richieste</span></div>`}
    if(pending){setHidden(pending,false);pending.className=`lmPending ${dirty?'warn':'ok'}`;pending.innerHTML=dirty?`<b>${dirty}</b> modifiche dall’ultimo export`:'✓ Nessuna modifica in attesa di export'}
    setText(imp,'↻ SOSTITUISCI / REIMPORTA');setHidden(exp,false);setHidden(manage,false);
    try{window.WarehouseMasterPanelMinimizeV2?.refresh?.()}catch{}
    return true;
  }

  function installSafePanelRenderer(){
    if(!window.LocalMaster)return false;
    if(window.LocalMaster.renderPanel!==safeRenderPanel)window.LocalMaster.renderPanel=safeRenderPanel;
    return true;
  }

  /* Schema V4 installs itself when loaded. Re-running install later can re-wrap functions
     already wrapped by older modules. All required V4 hooks are present by the time this
     final patch loads, so later install() calls must be idempotent no-ops. */
  function neutralizeLateSchemaReinstall(){
    const api=window.WarehouseMasterSchemaV4;
    if(!api||schemaInstallNeutralized)return false;
    schemaInstallNeutralized=true;
    const original=api.install;
    api.__masterImportFixOriginalInstall=original;
    api.install=function(){return true};
    return true;
  }

  function importWarning(){
    const dlg=$('masterDialog');if(!dlg)return;
    const warn=[...dlg.querySelectorAll('.status.warn')].find(el=>/MASTER ATTUALMENTE CARICATO|L['’]importazione sostituisce/i.test(el.textContent||''));
    if(!warn)return;
    const replacing=window.__masterImportHadMasterV1===true||(window.__masterImportHadMasterV1===undefined&&loaded());
    setHidden(warn,!replacing);
    if(replacing)setText(warn,'ATTENZIONE: IL MASTER ATTUALMENTE CARICATO VERRÀ SOSTITUITO.');
  }

  function showInlineError(message){
    const info=$('masterPreviewInfo');if(info){info.className='status error';setText(info,'Importazione non riuscita: '+message)}
    try{if(typeof warehouseToast==='function')warehouseToast('Importazione Master non riuscita.','error')}catch{}
  }

  async function runImport(event,btn){
    if(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
    if(btn.dataset.running==='1')return;
    const engine=window.importMappedMaster;
    if(typeof engine!=='function'){showInlineError('Motore di importazione non disponibile.');return}
    const dlg=$('masterDialog'),info=$('masterPreviewInfo'),cancel=dlg?.querySelector('.lmMasterCancel'),close=dlg?.querySelector('.dialogHead button');
    const beforeAt=(()=>{try{return db?.master?.imported_at||''}catch{return''}})(),beforeLoaded=loaded(),oldText=btn.textContent||'CONFERMA IMPORTAZIONE';
    window.__masterImportHadMasterV1=beforeLoaded;
    btn.dataset.running='1';btn.disabled=true;setText(btn,'⏳ IMPORTAZIONE IN CORSO…');if(cancel)cancel.disabled=true;if(close)close.disabled=true;
    if(info){info.className='status warn';setText(info,'Importazione del Master in corso. Non chiudere questa schermata…')}
    importWarning();

    const previousAlert=window.alert;
    let swallowedError='';
    window.alert=function(message){
      const text=String(message||'');
      if(/^Importazione non riuscita:/i.test(text)){swallowedError=text.replace(/^Importazione non riuscita:\s*/i,'').trim();return}
      return previousAlert.apply(this,arguments);
    };
    try{
      const result=engine.call(window);if(result&&typeof result.then==='function')await result;
      const afterAt=(()=>{try{return db?.master?.imported_at||''}catch{return''}})();
      if(!loaded()||(!beforeLoaded&&afterAt===beforeAt)){
        const existing=(info?.textContent||'').replace(/^Importazione non riuscita:\s*/i,'').trim();
        const msg=swallowedError||(/Maximum call stack/i.test(existing)?existing:'Il Master non è stato salvato. Riprova a selezionare il file.');
        showInlineError(msg);
        return false;
      }
      window.__masterImportHadMasterV1=undefined;
      installSafePanelRenderer();await safeRenderPanel();
      try{window.WarehouseRoleDashboardV1?.renderDashboard?.()}catch{}
      return result;
    }catch(err){
      console.error('[MASTER IMPORT FIX]',err);
      showInlineError(String(err?.message||err||'Errore sconosciuto'));
      return false;
    }finally{
      window.alert=previousAlert;
      btn.disabled=false;setText(btn,oldText);delete btn.dataset.running;
      if(cancel)cancel.disabled=false;if(close)close.disabled=false;
      importWarning();
    }
  }

  function bindImportConfirm(){
    const dlg=$('masterDialog'),btn=dlg?.querySelector('.btn.success');if(!btn)return false;
    if(btn.dataset.masterImportFixV1==='1')return true;
    const fresh=btn.cloneNode(true);
    fresh.dataset.masterImportFixV1='1';
    /* Prevent ui-hardening's MutationObserver from attaching its historical wrapper again. */
    fresh.dataset.hardImportBound='1';
    fresh.removeAttribute('onclick');fresh.onclick=null;
    btn.replaceWith(fresh);
    fresh.addEventListener('click',e=>runImport(e,fresh),true);
    return true;
  }

  function patchMasterDetails(){
    if(typeof window.openMasterDetailsV1==='function'&&!window.openMasterDetailsV1.__masterImportFixV1){
      baseOpenDetails=window.openMasterDetailsV1;
      const f=function(){if(!loaded()){if(!canMaster())return window.WarehouseRoleDashboardV1?.deny?.('Gestione Master');return window.triggerMasterImportV1?.()}return baseOpenDetails.apply(this,arguments)};
      f.__masterImportFixV1=true;f.__previous=baseOpenDetails;window.openMasterDetailsV1=f;
    }
    const card=document.querySelector('#rdDashboardV1 .rdMaster');if(!card)return;
    const isLoaded=loaded(),ready=card.querySelector('.rdReady'),state=card.querySelector('.rdMasterState b'),details=card.querySelector('.rdMasterDetails');
    if(!isLoaded){
      setText(ready,'DA CARICARE');setText(state,'Master non caricato');
      const metrics=card.querySelectorAll('.rdMasterMetric');if(metrics[0])setText(metrics[0].querySelector('b'),'0');if(metrics[1])setText(metrics[1].querySelector('b'),'—');
      if(details){setText(details,'CARICA MASTER EXCEL');details.onclick=()=>window.triggerMasterImportV1?.();details.setAttribute('aria-label','Carica Master Excel')}
    }else if(details){
      if(details.textContent.trim()!=='DETTAGLI')setText(details,'DETTAGLI');details.onclick=()=>window.openMasterDetailsV1?.();details.setAttribute('aria-label','Dettagli Master Excel');
    }
  }

  function patchOpenDialogIfNeeded(){
    const d=$('rdMasterDialog');if(!d?.open)return;
    const body=$('rdMasterDialogBody');if(!body)return;
    if(!loaded()){
      const html='<div class="rdMasterInfoGrid"><div class="rdInfoCell"><span>Stato</span><b>Nessun Master importato</b></div><div class="rdInfoCell"><span>Righe</span><b>0</b></div></div><div class="rdDialogActions"><button class="primary full" type="button" id="masterFixLoadBtnV1">CARICA MASTER EXCEL</button></div>';
      if(body.dataset.masterEmptyFixV1!=='1'){body.dataset.masterEmptyFixV1='1';body.innerHTML=html;$('masterFixLoadBtnV1').onclick=()=>{d.close();window.triggerMasterImportV1?.()}}
    }else delete body.dataset.masterEmptyFixV1;
  }

  function capturePreImportState(){
    const input=$('masterInput');if(!input||input.dataset.masterImportFixCapture==='1')return;
    input.dataset.masterImportFixCapture='1';
    input.addEventListener('change',()=>{window.__masterImportHadMasterV1=loaded();setTimeout(importWarning,0)},true);
  }

  function decorate(){
    installSafePanelRenderer();neutralizeLateSchemaReinstall();bindImportConfirm();capturePreImportState();importWarning();patchMasterDetails();patchOpenDialogIfNeeded();
  }
  function schedule(){requestAnimationFrame(decorate)}
  function install(){
    if(installed){decorate();return true}
    installed=true;decorate();
    if(!observer){observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true})}
    if(!timer)timer=setInterval(decorate,900);
    window.addEventListener('resize',decorate,{passive:true});
    return true;
  }

  window.WarehouseMasterImportFixV1={version:VERSION,install,decorate,loaded,dirtyCount,safeRenderPanel,runImport};
  install();
})();
