/* REMOTO validation feedback sounds.
   Uses Web Audio for short UI confirmation/error cues. It never forces media playback,
   never changes navigator.audioSession to playback, and silently no-ops when audio is unavailable.
   On iOS this keeps the default ambient audio behavior so the hardware silent switch is respected. */
(function installWarehouseValidationSounds(){
  'use strict';
  if(window.WarehouseValidationSounds)return;

  const VERSION='2026.08.24-validation-sounds1';
  const PREF_KEY='so_validation_sounds_enabled';
  let installed=false;
  let ctx=null;
  let lastKind='';
  let lastAt=0;

  const byId=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const nowMs=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();

  function isEnabled(){
    try{return localStorage.getItem(PREF_KEY)!=='0'}catch{return true}
  }
  function setEnabled(value){
    try{localStorage.setItem(PREF_KEY,value?'1':'0')}catch{}
    return !!value;
  }
  function isVisible(){return typeof document==='undefined'||document.visibilityState!=='hidden'}
  function contextCtor(){return window.AudioContext||window.webkitAudioContext||null}
  function getContext(){
    if(ctx)return ctx;
    const C=contextCtor();if(!C)return null;
    try{ctx=new C({latencyHint:'interactive'});return ctx}catch{return null}
  }
  function unlock(){
    if(!isEnabled())return false;
    const c=getContext();if(!c)return false;
    try{
      if(c.state==='suspended'){const p=c.resume();if(p&&typeof p.catch==='function')p.catch(()=>{})}
      return true;
    }catch{return false}
  }
  function tone(c,freq,start,duration,level,type='sine'){
    const osc=c.createOscillator(),gain=c.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,start);
    gain.gain.setValueAtTime(0.0001,start);
    gain.gain.exponentialRampToValueAtTime(level,start+0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
    osc.connect(gain);gain.connect(c.destination);osc.start(start);osc.stop(start+duration+0.015);
  }
  function render(kind){
    if(!isEnabled()||!isVisible())return false;
    const c=getContext();if(!c||c.state!=='running')return false;
    const t=nowMs();if(kind===lastKind&&t-lastAt<180)return false;lastKind=kind;lastAt=t;
    try{
      const s=c.currentTime+0.006;
      if(kind==='success'){
        tone(c,659.25,s,0.075,0.055,'sine');
        tone(c,880,s+0.082,0.115,0.065,'sine');
      }else if(kind==='error'){
        tone(c,246.94,s,0.09,0.05,'triangle');
        tone(c,196,s+0.095,0.12,0.055,'triangle');
      }else return false;
      return true;
    }catch{return false}
  }
  function play(kind='success'){
    if(kind!=='success'&&kind!=='error')return false;
    if(!isEnabled()||!isVisible())return false;
    const c=getContext();if(!c)return false;
    if(c.state==='running')return render(kind);
    try{
      const p=c.resume();
      if(p&&typeof p.then==='function'){
        p.then(()=>{try{render(kind)}catch{}}).catch(()=>{});
        return true;
      }
    }catch{}
    return false;
  }

  function classifyMessage(message,explicitType=''){
    const type=String(explicitType||'').trim().toLowerCase();
    if(/error|danger|fail|invalid/.test(type))return 'error';
    if(/success|good|ok/.test(type))return 'success';
    const s=String(message||'').trim().toLowerCase();if(!s)return null;
    if(/errore|non corret|non valid|non disponibil|impossibil|insufficient|giacenza cambiata|non puoi|non può|nessun dato|nessuno scarico|nessuna giacenza|non ho trovato|non ci sono|non hai selezionato|manca |mancano |inserisci |completa |seleziona |aggiungi almeno/.test(s))return 'error';
    if(/registrat[oa]|importat[oa]|caricat[ae]|salvat[oa]|completat[oa]|confermat[oa]|eliminat[oa]|ripristinat[oa]|esportat[oa]|copiat[ae]|aggiornat[oa]/.test(s))return 'success';
    return null;
  }

  function wrapAlert(){
    const base=window.alert;if(typeof base!=='function'||base.__warehouseSoundWrapped)return false;
    const wrapped=function(message){const kind=classifyMessage(message);if(kind)play(kind);return base.apply(this,arguments)};
    wrapped.__warehouseSoundWrapped=true;wrapped.__warehouseSoundBase=base;window.alert=wrapped;return true;
  }
  function wrapSetStatus(){
    const base=window.setStatus;if(typeof base!=='function'||base.__warehouseSoundWrapped)return false;
    const wrapped=function(id,message,type){const out=base.apply(this,arguments);const kind=classifyMessage(message,type);if(kind)play(kind);return out};
    wrapped.__warehouseSoundWrapped=true;wrapped.__warehouseSoundBase=base;window.setStatus=wrapped;return true;
  }
  function wrapWarehouseToast(){
    const base=window.warehouseToast;if(typeof base!=='function'||base.__warehouseSoundWrapped)return false;
    const wrapped=function(message,type){const out=base.apply(this,arguments);const kind=classifyMessage(message,type);if(kind)play(kind);return out};
    wrapped.__warehouseSoundWrapped=true;wrapped.__warehouseSoundBase=base;window.warehouseToast=wrapped;return true;
  }

  function snapshot(){
    const data=typeof db!=='undefined'?db:null;
    const user=typeof currentUser!=='undefined'?String(currentUser||''):(()=>{try{return sessionStorage.getItem('so_current_user')||''}catch{return ''}})();
    return {
      user,
      moves:Array.isArray(data?.movements)?data.movements.length:0,
      docs:Array.isArray(data?.documents)?data.documents.length:0,
      requests:Array.isArray(data?.requests)?data.requests.length:0,
      audits:Array.isArray(data?.audits)?data.audits.length:0,
      masterRows:Array.isArray(data?.master?.rows)?data.master.rows.length:0,
      masterAt:String(data?.master?.imported_at||'')
    };
  }
  function finishResult(result,after){
    if(result&&typeof result.then==='function')return result.then(v=>{after();return v},e=>{after();throw e});
    after();return result;
  }
  function wrapChangedAction(name,changed){
    const base=window[name];if(typeof base!=='function'||base.__warehouseSoundWrapped)return false;
    const wrapped=function(){const before=snapshot(),result=base.apply(this,arguments);return finishResult(result,()=>{const after=snapshot();if(changed(before,after))play('success')})};
    wrapped.__warehouseSoundWrapped=true;wrapped.__warehouseSoundBase=base;window[name]=wrapped;return true;
  }
  function wrapSubmitLogin(){
    const base=window.submitLogin;if(typeof base!=='function'||base.__warehouseSoundWrapped)return false;
    const wrapped=function(){const before=snapshot(),result=base.apply(this,arguments);return finishResult(result,()=>{const after=snapshot();if(!before.user&&after.user)play('success');else{const err=byId('loginError');if(err&&!err.classList.contains('hidden'))play('error')}})};
    wrapped.__warehouseSoundWrapped=true;wrapped.__warehouseSoundBase=base;window.submitLogin=wrapped;return true;
  }
  function wrapDeleteMasterPin(){
    const base=window.confirmDeleteMaster;if(typeof base!=='function'||base.__warehouseSoundPinWrapped)return false;
    const wrapped=function(){const result=base.apply(this,arguments);return finishResult(result,()=>{const err=byId('deleteMasterError');if(err&&!err.classList.contains('hidden'))play('error')})};
    wrapped.__warehouseSoundPinWrapped=true;wrapped.__warehouseSoundBase=base;window.confirmDeleteMaster=wrapped;return true;
  }
  function installActionHooks(){
    wrapSubmitLogin();wrapDeleteMasterPin();
    wrapChangedAction('saveMovementEdit',(b,a)=>a.audits>b.audits);
    wrapChangedAction('cancelMovement',(b,a)=>a.audits>b.audits);
    wrapChangedAction('saveRequestFromReview',(b,a)=>a.requests>b.requests);
    wrapChangedAction('deleteRequest',(b,a)=>a.requests<b.requests);
  }
  function install(){
    if(installed)return true;installed=true;
    if(typeof window.addEventListener==='function'){
      window.addEventListener('pointerdown',unlock,{capture:true,passive:true});
      window.addEventListener('keydown',unlock,{capture:true});
    }
    wrapAlert();wrapSetStatus();wrapWarehouseToast();installActionHooks();
    setTimeout(()=>{try{wrapSetStatus();wrapWarehouseToast();installActionHooks()}catch{}},120);
    return true;
  }

  window.WarehouseValidationSounds={version:VERSION,isEnabled,setEnabled,unlock,play,classifyMessage,snapshot,install};
  install();
})();
