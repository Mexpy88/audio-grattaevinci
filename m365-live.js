/* MAGAZZINO APP LIVE — Microsoft 365 / OneDrive integration.
   Experimental branch only. Keeps the REMOTO build untouched.
   Authentication uses MSAL Browser (public SPA client, PKCE); passwords are never collected by this app. */
(function installWarehouseM365Live(){
  'use strict';
  if(window.WarehouseM365Live)return;

  const VERSION='2026.08.24-m365-live-v1';
  const CONFIG_KEY='so_m365_live_config_v1';
  const STATE_KEY='so_m365_live_state_v1';
  const META_KEY='so_local_master_meta_v3';
  const GRAPH='https://graph.microsoft.com/v1.0';
  const MSAL_ESM='https://cdn.jsdelivr.net/npm/@azure/msal-browser@4.30.0/+esm';
  const CALLBACK_URI='https://raw.githack.com/Mexpy88/audio-grattaevinci/warehouse-app-live/auth-callback.html';
  const SCOPES=['User.Read','Files.ReadWrite'];
  const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  let msalModule=null,msalApp=null,activeAccount=null,installed=false,saveRunning=false;
  let baseRenderPanel=null,baseExport=null,baseSaveDb=null;

  const text=v=>String(v??'');
  const html=v=>text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const byId=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const nowIso=()=>new Date().toISOString();
  const isXlsxName=name=>/\.xlsx$/i.test(text(name).trim())&&!/^~\$/i.test(text(name).trim());
  function readJson(key,fallback={}){try{return {...fallback,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{return {...fallback}}}
  function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value));return value}
  function readConfig(){return readJson(CONFIG_KEY,{clientId:'',tenant:'organizations'})}
  function readState(){return readJson(STATE_KEY,{account:null,file:null,lastSavedAt:null,lastDownloadedAt:null})}
  function writeState(patch){return writeJson(STATE_KEY,{...readState(),...patch})}
  function readMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch{return {}}}
  function writeMeta(patch){try{localStorage.setItem(META_KEY,JSON.stringify({...readMeta(),...patch,version:3}))}catch{}}
  function toast(message,type='success'){if(typeof window.warehouseToast==='function')window.warehouseToast(message,type);else console.log('[M365 LIVE]',message)}
  function masterLoaded(){try{return typeof db!=='undefined'&&Array.isArray(db?.master?.rows)&&db.master.rows.length>0}catch{return false}}
  function fmtWhen(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
  function graphItemUrl(file,suffix=''){if(!file?.driveId||!file?.itemId)throw new Error('File Excel cloud non configurato.');return `${GRAPH}/drives/${encodeURIComponent(file.driveId)}/items/${encodeURIComponent(file.itemId)}${suffix}`}

  function ensureLiveDialog(){
    if(typeof document==='undefined')return null;
    let dlg=byId('m365LiveDialog');if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='m365LiveDialog';dlg.className='m365LiveDialog';
    dlg.innerHTML='<div class="m365Head"><h2 id="m365DialogTitle">Microsoft 365</h2><button type="button" id="m365DialogClose" aria-label="Chiudi">×</button></div><div id="m365DialogBody"></div><div id="m365DialogActions" class="m365Actions"></div>';
    document.body.appendChild(dlg);byId('m365DialogClose').onclick=()=>dlg.close();return dlg;
  }
  function liveModal({title,body,actions=[{label:'CHIUDI',value:'close',kind:'soft'}]}){
    return new Promise(resolve=>{
      const dlg=ensureLiveDialog();if(!dlg)return resolve('close');
      byId('m365DialogTitle').textContent=title;byId('m365DialogBody').innerHTML=body;const box=byId('m365DialogActions');box.innerHTML='';let done=false;
      const finish=v=>{if(done)return;done=true;try{dlg.close()}catch{}resolve(v)};
      for(const a of actions){const b=document.createElement('button');b.type='button';b.className=`m365Btn ${a.kind||'soft'}`;b.textContent=a.label;b.onclick=()=>finish(a.value);box.appendChild(b)}
      dlg.oncancel=e=>{e.preventDefault();finish('close')};dlg.showModal();
    });
  }

  async function openConfiguration(){
    const cfg=readConfig(),dlg=ensureLiveDialog();if(!dlg)return false;
    byId('m365DialogTitle').textContent='Configura Microsoft 365';
    byId('m365DialogBody').innerHTML=`<div class="m365Form"><label>CLIENT ID<input id="m365ClientId" class="field" value="${html(cfg.clientId)}" autocomplete="off"></label><label>TENANT ID / DOMINIO<input id="m365Tenant" class="field" value="${html(cfg.tenant||'organizations')}" autocomplete="off"></label><div class="m365Callback"><b>REDIRECT URI DA REGISTRARE</b><code>${html(CALLBACK_URI)}</code><button type="button" id="m365CopyRedirect" class="m365Mini">COPIA</button></div><p class="m365Note">La password aziendale non viene mai inserita nell'app. Il login avviene nella pagina ufficiale Microsoft.</p></div>`;
    const actions=byId('m365DialogActions');actions.innerHTML='<button type="button" class="m365Btn soft" id="m365CfgCancel">ANNULLA</button><button type="button" class="m365Btn primary" id="m365CfgSave">SALVA CONFIGURAZIONE</button>';
    byId('m365CopyRedirect').onclick=async()=>{try{await navigator.clipboard.writeText(CALLBACK_URI);toast('Redirect URI copiato.','success')}catch{}};
    return new Promise(resolve=>{
      const finish=v=>{try{dlg.close()}catch{}resolve(v)};
      byId('m365CfgCancel').onclick=()=>finish(false);
      byId('m365CfgSave').onclick=()=>{const clientId=text(byId('m365ClientId').value).trim(),tenant=text(byId('m365Tenant').value).trim()||'organizations';if(!clientId){toast('Inserisci il Client ID dell’app Microsoft Entra.','error');byId('m365ClientId').focus();return}writeJson(CONFIG_KEY,{clientId,tenant});msalApp=null;activeAccount=null;finish(true);decorateLivePanel()};
      dlg.oncancel=e=>{e.preventDefault();finish(false)};dlg.showModal();
    });
  }

  async function loadMsal(){if(msalModule)return msalModule;msalModule=await import(MSAL_ESM);return msalModule}
  async function getMsal(){
    const cfg=readConfig();if(!cfg.clientId)throw new Error('Microsoft 365 non configurato: manca il Client ID.');
    if(msalApp)return msalApp;const mod=await loadMsal();
    msalApp=new mod.PublicClientApplication({auth:{clientId:cfg.clientId,authority:`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenant||'organizations')}`,redirectUri:CALLBACK_URI,postLogoutRedirectUri:CALLBACK_URI},cache:{cacheLocation:'localStorage',storeAuthStateInCookie:false}});
    if(typeof msalApp.initialize==='function')await msalApp.initialize();
    const accounts=msalApp.getAllAccounts?.()||[];activeAccount=accounts[0]||null;if(activeAccount)writeState({account:{name:activeAccount.name||'',username:activeAccount.username||'',homeAccountId:activeAccount.homeAccountId||''}});return msalApp;
  }
  async function connectAccount(){
    const cfg=readConfig();if(!cfg.clientId){const saved=await openConfiguration();if(!saved)return false}
    try{const app=await getMsal();const result=await app.loginPopup({scopes:SCOPES,prompt:'select_account',redirectUri:CALLBACK_URI});activeAccount=result.account||app.getAllAccounts?.()[0]||null;if(!activeAccount)throw new Error('Microsoft non ha restituito un account.');writeState({account:{name:activeAccount.name||'',username:activeAccount.username||'',homeAccountId:activeAccount.homeAccountId||''}});toast('Account Microsoft collegato.','success');await decorateLivePanel();return true}catch(e){console.error('Microsoft login',e);toast('Collegamento Microsoft non riuscito: '+(e.message||e),'error');return false}
  }
  async function ensureAccount(){const app=await getMsal();if(!activeAccount){activeAccount=(app.getAllAccounts?.()||[])[0]||null}if(!activeAccount){const ok=await connectAccount();if(!ok)throw new Error('Account Microsoft non collegato.')}return activeAccount}
  async function accessToken(){
    const app=await getMsal(),account=await ensureAccount();try{return (await app.acquireTokenSilent({account,scopes:SCOPES})).accessToken}catch(e){const r=await app.acquireTokenPopup({account,scopes:SCOPES,redirectUri:CALLBACK_URI});return r.accessToken}
  }
  async function graphFetch(url,options={}){
    const token=await accessToken(),headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${token}`);const res=await fetch(url,{...options,headers});if(!res.ok){let detail='';try{const j=await res.json();detail=j?.error?.message||JSON.stringify(j)}catch{detail=await res.text().catch(()=> '')}const err=new Error(`Microsoft Graph ${res.status}: ${detail||res.statusText}`);err.status=res.status;throw err}return res
  }
  async function graphJson(url,options={}){const res=await graphFetch(url,options);return res.status===204?{}:res.json()}

  async function listExcelFiles(){
    await ensureAccount();let url=`${GRAPH}/me/drive/root/search(q='.xlsx')?$select=id,name,size,lastModifiedDateTime,parentReference,webUrl,file,eTag&$top=100`,out=[],pages=0;
    while(url&&pages<3){const j=await graphJson(url);out.push(...(j.value||[]));url=j['@odata.nextLink']||'';pages++}
    return out.filter(x=>isXlsxName(x.name)&&x.file).sort((a,b)=>new Date(b.lastModifiedDateTime||0)-new Date(a.lastModifiedDateTime||0));
  }
  function fileDescriptor(item){return {itemId:item.id,driveId:item.parentReference?.driveId||'',name:item.name||'',webUrl:item.webUrl||'',eTag:item.eTag||'',lastModifiedDateTime:item.lastModifiedDateTime||'',size:Number(item.size)||0,parentPath:item.parentReference?.path||''}}
  async function chooseExcelFile(){
    try{const files=await listExcelFiles();if(!files.length){await liveModal({title:'Nessun file Excel',body:'<p>Non ho trovato file .xlsx nel tuo OneDrive.</p>'});return false}const dlg=ensureLiveDialog();byId('m365DialogTitle').textContent='Seleziona file Excel';byId('m365DialogBody').innerHTML=`<input id="m365FileSearch" class="field" placeholder="CERCA FILE"><div id="m365FileList" class="m365FileList"></div>`;byId('m365DialogActions').innerHTML='<button type="button" class="m365Btn soft" id="m365FileCancel">ANNULLA</button>';
      return await new Promise(resolve=>{const render=()=>{const q=text(byId('m365FileSearch').value).trim().toUpperCase(),rows=files.filter(f=>!q||text(f.name).toUpperCase().includes(q)).slice(0,100);byId('m365FileList').innerHTML=rows.map((f,i)=>`<button type="button" class="m365File" data-index="${files.indexOf(f)}"><b>${html(f.name)}</b><span>${html(fmtWhen(f.lastModifiedDateTime))}</span></button>`).join('')||'<p>Nessun file trovato.</p>';byId('m365FileList').querySelectorAll('.m365File').forEach(b=>b.onclick=async()=>{const item=files[Number(b.dataset.index)],desc=fileDescriptor(item);writeState({file:desc,lastDownloadedAt:null,lastSavedAt:null});try{dlg.close()}catch{}resolve(desc);await downloadSelectedFile(desc)})};byId('m365FileSearch').oninput=render;render();byId('m365FileCancel').onclick=()=>{dlg.close();resolve(false)};dlg.oncancel=e=>{e.preventDefault();dlg.close();resolve(false)};dlg.showModal()})
    }catch(e){console.error(e);toast('Impossibile leggere i file OneDrive: '+(e.message||e),'error');return false}
  }

  async function downloadSelectedFile(file=readState().file){
    if(!file?.itemId)return chooseExcelFile();try{toast('Scarico il file Excel da Microsoft 365…','success');const res=await graphFetch(graphItemUrl(file,'/content'));const buf=await res.arrayBuffer();const input=byId('masterInput');if(!input)throw new Error('Selettore Master non disponibile nell’app.');const f=new File([buf],file.name,{type:XLSX_MIME,lastModified:Date.now()}),dt=new DataTransfer();dt.items.add(f);input.files=dt.files;writeState({file:{...file},lastDownloadedAt:nowIso()});input.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(decorateLivePanel,80);return true}catch(e){console.error(e);toast('Download Excel non riuscito: '+(e.message||e),'error');return false}
  }

  function captureExportBlob(exportFn){
    return new Promise(async(resolve,reject)=>{
      let captured=null,capturedUrl='',ok=false;const nativeCreate=URL.createObjectURL.bind(URL),nativeClick=HTMLAnchorElement.prototype.click,nativeShow=HTMLDialogElement.prototype.showModal,nativeToast=window.warehouseToast,metaBefore=localStorage.getItem(META_KEY);
      URL.createObjectURL=function(obj){const u=nativeCreate(obj);if(obj instanceof Blob&&(/spreadsheetml|octet-stream/i.test(obj.type)||obj.size>1024)){captured=obj;capturedUrl=u}return u};
      HTMLAnchorElement.prototype.click=function(){if(captured&&this.download&&this.href===capturedUrl)return;return nativeClick.call(this)};
      HTMLDialogElement.prototype.showModal=function(){if(this.id==='lmDialog'&&text(byId('lmDialogTitle')?.textContent).toUpperCase().includes('EXPORT COMPLETATO'))return;return nativeShow.call(this)};
      if(typeof nativeToast==='function')window.warehouseToast=function(message,type){if(/Master Excel esportato|Export completato/i.test(text(message)))return;return nativeToast(message,type)};
      try{ok=await exportFn();if(!ok||!captured)throw new Error('Non sono riuscito a generare il file Excel aggiornato.');resolve({blob:captured,metaBefore})}catch(e){if(metaBefore===null)localStorage.removeItem(META_KEY);else localStorage.setItem(META_KEY,metaBefore);reject(e)}finally{URL.createObjectURL=nativeCreate;HTMLAnchorElement.prototype.click=nativeClick;HTMLDialogElement.prototype.showModal=nativeShow;if(typeof nativeToast==='function')window.warehouseToast=nativeToast}
    })
  }
  async function verifyRemoteVersion(file){const j=await graphJson(graphItemUrl(file,'?$select=id,name,eTag,lastModifiedDateTime,size'));if(file.eTag&&j.eTag&&file.eTag!==j.eTag){const e=new Error('Il file Excel è stato modificato su Microsoft 365 dopo l’ultimo caricamento. Ricaricalo prima di salvare per evitare di sovrascrivere modifiche esterne.');e.code='REMOTE_CHANGED';throw e}return j}
  async function saveToMicrosoft365(){
    if(saveRunning)return false;const state=readState(),file=state.file;if(!file?.itemId){toast('Prima seleziona il file Excel su Microsoft 365.','error');return false}if(!masterLoaded()){toast('Prima carica il file Excel selezionato.','error');return false}if(typeof baseExport!=='function')throw new Error('Motore export Excel non disponibile.');saveRunning=true;const btn=byId('lmExportBtn'),dirty=byId('uxDirtyExport');const oldBtn=btn?.textContent,oldDirty=dirty?.textContent,metaBefore=localStorage.getItem(META_KEY);if(btn){btn.disabled=true;btn.textContent='⏳ SALVATAGGIO…'}if(dirty){dirty.disabled=true;dirty.textContent='SALVATAGGIO…'}
    try{await verifyRemoteVersion(file);const built=await captureExportBlob(()=>baseExport());const remote=await graphJson(graphItemUrl(file,'/content'),{method:'PUT',headers:{'Content-Type':XLSX_MIME,...(file.eTag?{'If-Match':file.eTag}:{})},body:built.blob});const updated={...file,eTag:remote.eTag||file.eTag,lastModifiedDateTime:remote.lastModifiedDateTime||nowIso(),size:Number(remote.size)||built.blob.size};const at=nowIso();writeState({file:updated,lastSavedAt:at});writeMeta({lastExportAt:at,lastExportName:updated.name,cloudSavedAt:at,cloudDriveId:updated.driveId,cloudItemId:updated.itemId});toast('✓ EXCEL SALVATO SU MICROSOFT 365','success');await decorateLivePanel();return true}catch(e){console.error('Salvataggio Microsoft 365',e);if(metaBefore===null)localStorage.removeItem(META_KEY);else localStorage.setItem(META_KEY,metaBefore);if(e.code==='REMOTE_CHANGED')await liveModal({title:'File modificato nel cloud',body:`<p>${html(e.message)}</p>`,actions:[{label:'CHIUDI',value:'close',kind:'soft'},{label:'RICARICA DA EXCEL',value:'reload',kind:'primary'}]}).then(v=>{if(v==='reload')downloadSelectedFile(file)});else toast('Salvataggio non riuscito: '+(e.message||e),'error');return false}finally{saveRunning=false;if(btn){btn.disabled=false;btn.textContent=oldBtn||'💾 SALVA MODIFICHE'}if(dirty){dirty.disabled=false;dirty.textContent=oldDirty||'SALVA ORA'}}
  }

  async function disconnectAccount(){
    try{const app=await getMsal();if(typeof app.clearCache==='function')await app.clearCache({account:activeAccount||undefined})}catch(e){console.warn('Pulizia cache Microsoft',e)}activeAccount=null;writeState({account:null,file:null,lastSavedAt:null,lastDownloadedAt:null});toast('Account Microsoft scollegato.','success');await decorateLivePanel()
  }
  async function manageLive(){
    const cfg=readConfig(),st=readState(),account=st.account,choice=await liveModal({title:'Excel Magazzino',body:`<p><b>ACCOUNT:</b> ${html(account?.username||'NON COLLEGATO')}<br><b>FILE:</b> ${html(st.file?.name||'NON SELEZIONATO')}<br><b>ULTIMO SALVATAGGIO:</b> ${html(fmtWhen(st.lastSavedAt))}</p><p class="m365Small">Redirect URI: ${html(CALLBACK_URI)}</p>`,actions:[{label:'CHIUDI',value:'close',kind:'soft'},{label:'CONFIGURA',value:'config',kind:'soft'},{label:'CAMBIA FILE',value:'file',kind:'primary'},{label:'SCOLLEGA',value:'disconnect',kind:'danger'}]});if(choice==='config')return openConfiguration();if(choice==='file')return chooseExcelFile();if(choice==='disconnect')return disconnectAccount();return false
  }

  function accountLabel(st){return st.account?.name||st.account?.username||''}
  function decorateDirtyBar(){const t=byId('uxDirtyText'),b=byId('uxDirtyExport');if(t)t.innerHTML=t.innerHTML.replace(/da esportare/gi,'da salvare').replace(/Ultimo export/gi,'Ultimo salvataggio');if(b){b.textContent=b.disabled?'SALVATAGGIO…':'SALVA ORA';b.onclick=()=>saveToMicrosoft365()}}
  async function decorateLivePanel(){
    if(typeof document==='undefined')return false;const panel=byId('localMasterPanel');if(!panel)return false;const cfg=readConfig(),st=readState(),loaded=masterLoaded(),connected=!!st.account,selected=!!st.file?.itemId;const eye=panel.querySelector('.lmEyebrow');if(eye)eye.textContent='EXCEL MAGAZZINO';
    const title=byId('lmTitle'),state=byId('lmState'),sub=byId('lmSub'),imp=byId('lmImportBtn'),exp=byId('lmExportBtn'),manage=byId('lmManageBtn'),pending=byId('lmPending');
    if(!cfg.clientId){if(title)title.textContent='Microsoft 365 non configurato';if(state){state.className='lmPill offline';state.textContent='NON CONFIGURATO'}if(sub){sub.classList.remove('hidden');sub.textContent=''}if(imp){imp.classList.remove('hidden');imp.textContent='⚙ CONFIGURA MICROSOFT 365';imp.onclick=()=>openConfiguration()}if(exp)exp.classList.add('hidden');if(manage)manage.classList.add('hidden')}
    else if(!connected){if(title)title.textContent='Account Microsoft non collegato';if(state){state.className='lmPill offline';state.textContent='NON COLLEGATO'}if(sub){sub.classList.remove('hidden');sub.textContent=''}if(imp){imp.classList.remove('hidden');imp.textContent='☁ COLLEGA ACCOUNT MICROSOFT';imp.onclick=()=>connectAccount()}if(exp)exp.classList.add('hidden');if(manage){manage.classList.remove('hidden');manage.textContent='⚙ CONFIGURA';manage.onclick=()=>openConfiguration()}}
    else if(!selected){if(title)title.textContent=accountLabel(st)||'Account Microsoft collegato';if(state){state.className='lmPill online';state.textContent='COLLEGATO'}if(sub){sub.classList.remove('hidden');sub.textContent=st.account?.username||''}if(imp){imp.classList.remove('hidden');imp.textContent='📄 SELEZIONA FILE EXCEL';imp.onclick=()=>chooseExcelFile()}if(exp)exp.classList.add('hidden');if(manage){manage.classList.remove('hidden');manage.textContent='⚙ ACCOUNT';manage.onclick=()=>manageLive()}}
    else {if(title)title.textContent=st.file.name;if(state){state.className=`lmPill ${loaded?'online':'warn'}`;state.textContent=loaded?'PRONTO':'DA CARICARE'}if(sub){sub.classList.remove('hidden');sub.textContent=`${st.account?.username||''}${st.lastSavedAt?` · Salvato ${fmtWhen(st.lastSavedAt)}`:st.lastDownloadedAt?` · Scaricato ${fmtWhen(st.lastDownloadedAt)}`:''}`}if(imp){imp.classList.remove('hidden');imp.textContent=loaded?'↻ RICARICA / CAMBIA FILE':'↻ CARICA FILE SELEZIONATO';imp.onclick=()=>loaded?chooseExcelFile():downloadSelectedFile(st.file)}if(exp){exp.classList.toggle('hidden',!loaded);exp.textContent='💾 SALVA MODIFICHE';exp.onclick=()=>saveToMicrosoft365()}if(manage){manage.classList.remove('hidden');manage.textContent='⚙ ACCOUNT / FILE';manage.onclick=()=>manageLive()}}
    if(pending&&!pending.classList.contains('hidden'))pending.innerHTML=pending.innerHTML.replace(/export/gi,'salvataggio');decorateDirtyBar();return true
  }

  function blockWithoutCloud(fnName){const base=window[fnName];if(typeof base!=='function'||base.__m365LiveWrapped)return;const wrapped=function(...args){const st=readState();if(!readConfig().clientId){openConfiguration();return}if(!st.account){connectAccount();return}if(!st.file?.itemId){chooseExcelFile();return}if(!masterLoaded()){downloadSelectedFile(st.file);return}return base.apply(this,args)};wrapped.__m365LiveWrapped=true;window[fnName]=wrapped}
  function wrapSaveDb(){if(typeof window.saveDb!=='function'||window.saveDb.__m365LiveWrapped)return;baseSaveDb=window.saveDb;const w=function(){const r=baseSaveDb.apply(this,arguments);setTimeout(()=>{decorateLivePanel();decorateDirtyBar()},60);return r};w.__m365LiveWrapped=true;window.saveDb=w}

  async function restoreAccountFromCache(){if(!readConfig().clientId)return false;try{const app=await getMsal(),a=(app.getAllAccounts?.()||[])[0];if(a){activeAccount=a;writeState({account:{name:a.name||'',username:a.username||'',homeAccountId:a.homeAccountId||''}});await decorateLivePanel();return true}}catch(e){console.warn('Ripristino account Microsoft',e)}return false}
  function injectBrand(){if(typeof document==='undefined')return;document.title='Magazzino App Live';document.documentElement.dataset.appMode='live'}
  function install(){
    if(installed||typeof document==='undefined'||!window.LocalMaster)return false;installed=true;injectBrand();baseRenderPanel=LocalMaster.renderPanel;baseExport=LocalMaster.exportUpdatedMaster;
    LocalMaster.renderPanel=async function(){const r=await baseRenderPanel.apply(this,arguments);await decorateLivePanel();return r};
    LocalMaster.exportUpdatedMaster=saveToMicrosoft365;LocalMaster.chooseImport=async()=>{const st=readState();if(!readConfig().clientId)return openConfiguration();if(!st.account){const ok=await connectAccount();if(!ok)return false}return st.file?.itemId?downloadSelectedFile(st.file):chooseExcelFile()};LocalMaster.manage=manageLive;
    for(const fn of ['openOperation','openSearch','openStockEdit','openRequests','openRegistry'])blockWithoutCloud(fn);wrapSaveDb();decorateLivePanel();restoreAccountFromCache();setTimeout(()=>{decorateLivePanel();decorateDirtyBar()},150);return true
  }

  window.WarehouseM365Live={version:VERSION,callbackUri:CALLBACK_URI,scopes:[...SCOPES],isXlsxName,graphItemUrl,fileDescriptor,readConfig,readState,openConfiguration,connectAccount,chooseExcelFile,downloadSelectedFile,saveToMicrosoft365,disconnectAccount,decorateLivePanel,install};
  if(typeof document!=='undefined')install();
})();
