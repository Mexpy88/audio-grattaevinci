/* Master generation / rollback guard for REMOTO V1.
   Adds an independent high-water mark that survives LocalMaster.removeMaster(),
   embeds lineage + generation + SHA-256 state fingerprint into APP_DATI at export,
   blocks obsolete/unprotected imports before they can replace the active master,
   and gives exported files a clear chronological name. */
(function installMasterGenerationGuard(){
  'use strict';

  const VERSION='2026.08.26-master-generation1';
  const GUARD_KEY='so_master_generation_guard_v1';
  const LOCAL_META_KEY='so_local_master_meta_v3';
  const DATA_SHEET='APP_DATI';
  const MARKER='SO_WAREHOUSE_APP_DATA_V3';
  let installed=false;
  let pendingFile=null;
  let pendingInspection=null;
  let exportContext=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const padGen=n=>String(Math.max(0,Math.floor(Number(n)||0))).padStart(4,'0');
  const readJson=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}};
  const writeJson=(key,value)=>{localStorage.setItem(key,JSON.stringify(value));return value};
  const readGuard=()=>readJson(GUARD_KEY);
  const readLocalMeta=()=>readJson(LOCAL_META_KEY);
  const patchLocalMeta=patch=>writeJson(LOCAL_META_KEY,{...readLocalMeta(),...patch});
  const writeGuard=patch=>writeJson(GUARD_KEY,{...readGuard(),...patch,version:1});
  const fmtWhen=v=>{try{return new Date(v).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return '—'}};
  const randomLineage=()=>{
    const a=new Uint8Array(8);try{crypto.getRandomValues(a)}catch{for(let i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256)}
    return 'SO-'+Array.from(a,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  };

  // Compact synchronous SHA-256 implementation (UTF-8 -> lowercase hex).
  function sha256(text){
    const bytes=new TextEncoder().encode(String(text));
    const K=new Uint32Array([
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ]);
    const bitLen=bytes.length*8;
    const total=((bytes.length+9+63)>>6)<<6;
    const data=new Uint8Array(total);data.set(bytes);data[bytes.length]=0x80;
    const dv=new DataView(data.buffer);
    const hi=Math.floor(bitLen/0x100000000),lo=bitLen>>>0;
    dv.setUint32(total-8,hi,false);dv.setUint32(total-4,lo,false);
    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    const w=new Uint32Array(64),rotr=(x,n)=>(x>>>n)|(x<<(32-n));
    for(let off=0;off<total;off+=64){
      for(let i=0;i<16;i++)w[i]=dv.getUint32(off+i*4,false);
      for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2],s0=(rotr(x,7)^rotr(x,18)^(x>>>3))>>>0,s1=(rotr(y,17)^rotr(y,19)^(y>>>10))>>>0;w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0}
      let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
      for(let i=0;i<64;i++){
        const S1=(rotr(e,6)^rotr(e,11)^rotr(e,25))>>>0,ch=((e&f)^((~e)&g))>>>0,t1=(h+S1+ch+K[i]+w[i])>>>0;
        const S0=(rotr(a,2)^rotr(a,13)^rotr(a,22))>>>0,maj=((a&b)^(a&c)^(b&c))>>>0,t2=(S0+maj)>>>0;
        h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
      }
      h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
    }
    return [h0,h1,h2,h3,h4,h5,h6,h7].map(x=>x.toString(16).padStart(8,'0')).join('');
  }

  function hashMaterial(payload){
    return JSON.stringify({
      schema:Number(payload?.schema||3),
      exported_at:String(payload?.exported_at||''),
      lineage_id:String(payload?.lineage_id||''),
      generation:Math.max(0,Math.floor(Number(payload?.generation)||0)),
      parent_generation:Math.max(0,Math.floor(Number(payload?.parent_generation)||0)),
      db:payload?.db||null
    });
  }

  function parseAppPayload(wb){
    const ws=wb?.Sheets?.[DATA_SHEET];if(!ws||!window.XLSX)return null;
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
    if(String(rows?.[0]?.[0]||'')!==MARKER)return null;
    const chunks=[];for(let i=4;i<rows.length;i++)if(rows[i]?.[0])chunks.push(String(rows[i][0]));
    if(!chunks.length)return null;
    try{const p=JSON.parse(chunks.join(''));return p?.db?p:null}catch{return null}
  }

  function rewriteAppPayload(wb,payload){
    const json=JSON.stringify(payload),chunk=30000;
    const rows=[[MARKER],['SCHEMA',payload.schema||3],['ESPORTATO_IL',payload.exported_at||''],['JSON_CHUNKS',Math.ceil(json.length/chunk)]];
    for(let i=0;i<json.length;i+=chunk)rows.push([json.slice(i,i+chunk)]);
    wb.Sheets[DATA_SHEET]=XLSX.utils.aoa_to_sheet(rows);
  }

  function protectedInfo(payload){
    const generation=Math.max(0,Math.floor(Number(payload?.generation)||0));
    const lineage=String(payload?.lineage_id||'').trim();
    const stateHash=String(payload?.state_hash||'').trim().toLowerCase();
    return {protected:!!(generation&&lineage&&stateHash),generation,lineage,stateHash,exportedAt:String(payload?.exported_at||'')};
  }

  function inspectWorkbookBytes(bytes){
    const wb=XLSX.read(bytes,{type:'array',cellDates:true,cellStyles:true});
    const payload=parseAppPayload(wb),info=protectedInfo(payload);
    let integrity=true,calculated='';
    if(info.protected){calculated=sha256(hashMaterial(payload));integrity=calculated===info.stateHash}
    return {wb,payload,...info,integrity,calculated};
  }

  function generationFileName(generation,when){
    const d=new Date(when||Date.now()),z=n=>String(n).padStart(2,'0');
    return `MAGAZZINO_SO_MASTER_G${padGen(generation)}_${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}_${z(d.getHours())}-${z(d.getMinutes())}.xlsx`;
  }

  function ensureDialog(){
    let d=document.getElementById('masterGenerationDialog');if(d)return d;
    d=document.createElement('dialog');d.id='masterGenerationDialog';
    d.style.cssText='max-width:520px;width:calc(100% - 28px);border:0;border-radius:20px;padding:22px;box-shadow:0 18px 55px rgba(0,0,0,.25);font-family:inherit;color:#17314d';
    d.innerHTML='<div id="masterGenerationIcon" style="font-size:34px;margin-bottom:8px"></div><h2 id="masterGenerationTitle" style="margin:0 0 10px"></h2><div id="masterGenerationBody" style="line-height:1.5"></div><button id="masterGenerationClose" type="button" style="width:100%;min-height:48px;margin-top:18px;border:0;border-radius:13px;background:#285fa8;color:white;font-weight:900">CHIUDI</button>';
    document.body.appendChild(d);d.querySelector('#masterGenerationClose').onclick=()=>d.close();d.oncancel=()=>{};return d;
  }
  function blockDialog(title,body,icon='⛔'){
    const d=ensureDialog();d.querySelector('#masterGenerationIcon').textContent=icon;d.querySelector('#masterGenerationTitle').textContent=title;d.querySelector('#masterGenerationBody').innerHTML=body;
    try{d.showModal()}catch{alert(title+'\n\n'+d.querySelector('#masterGenerationBody').textContent)}
  }
  function toast(msg,type='error'){if(typeof warehouseToast==='function')warehouseToast(msg,type);else console.log('[MASTER GENERATION]',msg)}

  function validateInspection(i){
    const g=readGuard(),max=Math.max(0,Math.floor(Number(g.maxGeneration)||0));
    if(i.protected&&!i.integrity)return {ok:false,title:'Master non valido',body:'<p>La firma SHA-256 dello stato interno non corrisponde. Il file potrebbe essere stato alterato o danneggiato.</p><p><b>Importazione annullata.</b></p>'};
    if(max>0&&!i.protected)return {ok:false,title:'Master obsoleto / non protetto',body:`<p>Questo file non contiene una generazione verificabile.</p><p>L’ultima generazione conosciuta da questo dispositivo è <b>G${padGen(max)}</b>${g.lastExportAt?`, esportata il <b>${esc(fmtWhen(g.lastExportAt))}</b>`:''}.</p><p>Per evitare di ripristinare dati vecchi, il file <b>non può essere importato</b>.</p>`};
    if(i.protected&&g.lineageId&&i.lineage!==g.lineageId)return {ok:false,title:'Master di un’altra catena',body:`<p>Il file appartiene a una catena Master diversa da quella già registrata su questo dispositivo.</p><p>Attesa: <b>${esc(g.lineageId)}</b><br>Trovata: <b>${esc(i.lineage)}</b></p><p>Importazione annullata per evitare la sovrascrittura del magazzino.</p>`};
    if(i.protected&&i.generation<max)return {ok:false,title:'Master obsoleto',body:`<p>Hai selezionato la generazione <b>G${padGen(i.generation)}</b>, ma l’ultima generazione conosciuta è <b>G${padGen(max)}</b>.</p>${g.lastExportAt?`<p>Ultimo export conosciuto: <b>${esc(fmtWhen(g.lastExportAt))}</b>.</p>`:''}<p>Un Master più vecchio non può essere caricato perché potrebbe far perdere movimenti e giacenze successive.</p>`};
    if(i.protected&&i.generation===max&&g.maxHash&&i.stateHash!==String(g.maxHash).toLowerCase())return {ok:false,title:'Conflitto sulla stessa generazione',body:`<p>Il file dichiara <b>G${padGen(i.generation)}</b>, ma il contenuto non coincide con la copia già conosciuta per quella generazione.</p><p>Importazione bloccata per sicurezza.</p>`};
    return {ok:true};
  }

  async function inspectPendingFile(){
    if(!pendingFile)return null;
    if(!pendingInspection){pendingInspection=pendingFile.arrayBuffer().then(inspectWorkbookBytes)}
    try{return await pendingInspection}catch(e){console.error(e);return {error:e}}
  }

  function rememberImported(i,fileName){
    if(!i?.protected)return;
    const g=readGuard(),newMax=Math.max(Number(g.maxGeneration)||0,i.generation);
    writeGuard({lineageId:i.lineage,maxGeneration:newMax,maxHash:i.generation>=Number(g.maxGeneration||0)?i.stateHash:g.maxHash,lastKnownAt:i.exportedAt||new Date().toISOString(),lastKnownName:fileName||g.lastKnownName||''});
    patchLocalMeta({sourceGeneration:i.generation,sourceLineage:i.lineage,sourceStateHash:i.stateHash});
  }

  function captureFile(e){
    const input=e.target;if(!input||input.id!=='masterInput')return;
    const f=input.files?.[0]||null;pendingFile=f;pendingInspection=null;
    if(f&&!/\.xlsx$/i.test(f.name)){pendingFile=null;pendingInspection=null}
  }

  function wrapImport(){
    const current=window.importMappedMaster;if(typeof current!=='function'||current.__masterGenerationWrapped)return;
    const wrapped=async function(...args){
      const file=pendingFile;
      if(file){
        const inspection=await inspectPendingFile();
        if(inspection?.error){toast('Impossibile verificare il Master selezionato.','error');blockDialog('Master non verificabile','<p>Non è stato possibile leggere il file Excel. Nessun dato è stato importato.</p>');const input=document.getElementById('masterInput');if(input)input.value='';pendingFile=null;pendingInspection=null;return false}
        const verdict=validateInspection(inspection);
        if(!verdict.ok){toast(verdict.title,'error');blockDialog(verdict.title,verdict.body);const input=document.getElementById('masterInput');if(input)input.value='';pendingFile=null;pendingInspection=null;return false}
        const before=window.db?.master?.imported_at||'';
        const result=await current.apply(this,args);
        const after=window.db?.master?.imported_at||'';
        if(after&&after!==before)rememberImported(inspection,file.name);
        pendingFile=null;pendingInspection=null;decoratePanel();return result;
      }
      return current.apply(this,args);
    };
    wrapped.__masterGenerationWrapped=true;wrapped.__masterGenerationBase=current;window.importMappedMaster=wrapped;
  }

  function prepareExportContext(){
    const guard=readGuard(),meta=readLocalMeta();
    const max=Math.max(Number(guard.maxGeneration)||0,Number(meta.sourceGeneration)||0);
    return {generation:max+1,parentGeneration:max,lineage:String(guard.lineageId||meta.sourceLineage||randomLineage()),exportedAt:'',stateHash:'',fileName:''};
  }

  function patchWorkbookForGeneration(wb){
    const payload=parseAppPayload(wb);if(!payload||!exportContext)return;
    payload.lineage_id=exportContext.lineage;
    payload.generation=exportContext.generation;
    payload.parent_generation=exportContext.parentGeneration;
    exportContext.exportedAt=String(payload.exported_at||new Date().toISOString());
    payload.state_hash=sha256(hashMaterial(payload));
    exportContext.stateHash=payload.state_hash;
    exportContext.fileName=generationFileName(exportContext.generation,exportContext.exportedAt);
    rewriteAppPayload(wb,payload);
  }

  function rememberExportNow(){
    if(!exportContext?.stateHash)return;
    const ctx=exportContext;
    writeGuard({lineageId:ctx.lineage,maxGeneration:ctx.generation,maxHash:ctx.stateHash,lastExportAt:ctx.exportedAt,lastExportName:ctx.fileName,lastKnownAt:ctx.exportedAt,lastKnownName:ctx.fileName});
    patchLocalMeta({sourceGeneration:ctx.generation,sourceLineage:ctx.lineage,sourceStateHash:ctx.stateHash,lastExportAt:ctx.exportedAt,lastExportName:ctx.fileName});
    decoratePanel();
  }

  function decorateExportModal(){
    if(!exportContext?.fileName)return;
    const f=document.querySelector('#lmDialog .lmFilename');if(f)f.textContent=exportContext.fileName;
  }

  function wrapExport(){
    if(!window.LocalMaster||typeof LocalMaster.exportUpdatedMaster!=='function'||LocalMaster.exportUpdatedMaster.__masterGenerationWrapped)return;
    const current=LocalMaster.exportUpdatedMaster;
    const wrapped=async function(...args){
      exportContext=prepareExportContext();
      const originalWrite=XLSX.write;
      const originalClick=HTMLAnchorElement.prototype.click;
      const observer=new MutationObserver(()=>decorateExportModal());observer.observe(document.body,{childList:true,subtree:true});
      XLSX.write=function(wb,opts){patchWorkbookForGeneration(wb);return originalWrite.call(this,wb,opts)};
      HTMLAnchorElement.prototype.click=function(){
        if(this.download&&/\.xlsx$/i.test(this.download)&&exportContext?.fileName){this.download=exportContext.fileName;rememberExportNow();setTimeout(decorateExportModal,0)}
        return originalClick.call(this);
      };
      try{return await current.apply(this,args)}finally{
        XLSX.write=originalWrite;HTMLAnchorElement.prototype.click=originalClick;observer.disconnect();
        if(exportContext?.stateHash)rememberExportNow();exportContext=null;
      }
    };
    wrapped.__masterGenerationWrapped=true;wrapped.__masterGenerationBase=current;LocalMaster.exportUpdatedMaster=wrapped;
  }

  function decoratePanel(){
    const meta=readLocalMeta(),guard=readGuard();
    const gen=Math.max(Number(meta.sourceGeneration)||0,0);
    const sub=document.getElementById('lmSub');if(sub){sub.querySelectorAll?.('.masterGenerationInline')?.forEach?.(x=>x.remove());if(gen>0){const s=document.createElement('span');s.className='masterGenerationInline';s.style.cssText='font-weight:900;color:#285fa8';s.textContent=` · G${padGen(gen)}`;sub.appendChild(s)}}
    const pending=document.getElementById('lmPending');if(pending&&Number(guard.maxGeneration)>gen&&gen===0){pending.title=`Ultima generazione protetta conosciuta: G${padGen(guard.maxGeneration)}`}
  }

  function install(){
    if(installed)return true;
    if(!window.XLSX||!window.LocalMaster||typeof window.importMappedMaster!=='function')return false;
    installed=true;
    document.addEventListener('change',captureFile,true);
    wrapImport();wrapExport();decoratePanel();
    const observer=new MutationObserver(()=>decoratePanel());observer.observe(document.body,{childList:true,subtree:true});
    window.WarehouseMasterGenerationGuard={version:VERSION,readGuard,validateInspection,generationFileName,sha256,install,inspectWorkbookBytes,hashMaterial};
    console.log('[MASTER GENERATION] installed',VERSION);
    return true;
  }

  window.WarehouseMasterGenerationGuard={version:VERSION,readGuard,validateInspection,generationFileName,sha256,install,inspectWorkbookBytes,hashMaterial};
  if(!install()){let tries=0;const t=setInterval(()=>{if(install()||++tries>30)clearInterval(t)},100)}
})();
