import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('master-import-ui-cleanup.js','utf8');
for(const forbidden of ['touchstart','touchmove','touchend','window.show=','window.show =']){
  if(source.includes(forbidden))throw new Error(`Forbidden navigation hook: ${forbidden}`);
}
if(!source.includes('body.lmNoMaster #lmSub{display:none!important}'))throw new Error('No-master helper line is not hidden');
if(!source.includes('ATTENZIONE: IL MASTER ATTUALMENTE CARICATO VERRÀ SOSTITUITO.'))throw new Error('Replacement-only warning missing');

const nativeConfirms=[];
const nativeAlerts=[];
const toasts=[];
const context={
  window:null,
  console,
  document:undefined,
  confirm:m=>{nativeConfirms.push(String(m));return false},
  alert:m=>nativeAlerts.push(String(m)),
  warehouseToast:(m,t)=>toasts.push([String(m),String(t||'')])
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'master-import-ui-cleanup.js'});

const api=context.WarehouseMasterImportUiCleanup;
if(!api)throw new Error('Cleanup API missing');
if(!api.isV4ImportConfirm('Importare 6508 giacenze dal Master V4? La giacenza master precedente verrà sostituita.'))throw new Error('V4 native confirmation not recognized');
if(api.isV4ImportConfirm('Eliminare davvero il Master?'))throw new Error('Unrelated confirmation must not be suppressed');
if(api.v4SuccessCount('Master V4 importato: 6508 giacenze.')!==6508)throw new Error('Success count parser failed');
if(!api.isGenericV4SuccessToast('Master V4 importato: nuovo ciclo di lavoro.'))throw new Error('Generic success toast not recognized');

if(context.confirm('Importare 6508 giacenze dal Master V4? La giacenza master precedente verrà sostituita.')!==true)throw new Error('Redundant V4 confirm should auto-accept');
if(nativeConfirms.length!==0)throw new Error('Redundant V4 confirm reached native browser UI');
context.confirm('Conferma eliminazione');
if(nativeConfirms.length!==1)throw new Error('Unrelated confirm must reach native browser UI');

context.warehouseToast('Master V4 importato: nuovo ciclo di lavoro.','success');
if(toasts.length!==0)throw new Error('Generic V4 success toast should be suppressed');
context.alert('Master V4 importato: 6508 giacenze.');
if(nativeAlerts.length!==0)throw new Error('V4 success alert should not reach native browser UI');
if(toasts.length!==1||toasts[0][0]!=='✓ MASTER IMPORTATO · 6508 GIACENZE'||toasts[0][1]!=='success')throw new Error('Compact success toast is wrong');
context.alert('Errore reale');
if(nativeAlerts.length!==1||nativeAlerts[0]!=='Errore reale')throw new Error('Error alerts must remain visible');

const info={textContent:'MASTER V4 riconosciuto. 8456 righe Excel. ARTICOLO, TAGLIA e NOTE resteranno separati; NUOVO, SCARICATO e USATO verranno letti dalle rispettive colonne.',className:'status good'};
const classes=new Set();
const warning={textContent:"L'importazione sostituisce la giacenza master attuale. I movimenti registrati dopo l'importazione continueranno ad aggiornare la giacenza.",classList:{toggle:(name,on)=>{if(on)classes.add(name);else classes.delete(name)}}};
const dlg={querySelectorAll:sel=>sel==='.status.warn'?[warning]:[]};
context.document={getElementById:id=>id==='masterDialog'?dlg:id==='masterPreviewInfo'?info:null};
context.db={master:{rows:[]}};
api.cleanImportDialog();
if(info.textContent!=='MASTER V4 RICONOSCIUTO · 8456 RIGHE EXCEL')throw new Error('Preview was not simplified');
if(!classes.has('hidden'))throw new Error('Replacement warning should be hidden on first import');
context.db={master:{rows:[{article_base:'I00215'}]}};
api.cleanImportDialog();
if(classes.has('hidden'))throw new Error('Replacement warning should show when a Master is already loaded');
if(warning.textContent!=='ATTENZIONE: IL MASTER ATTUALMENTE CARICATO VERRÀ SOSTITUITO.')throw new Error('Replacement warning text is not compact');

console.log('Master import UX cleanup OK: one confirmation, compact success toast, clean preview, no-master helper hidden.');
