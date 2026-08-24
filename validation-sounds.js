/* REMOTO UI sounds — isolated, non-invasive feedback.
   Does not replace alert/confirm/navigation and does not force an audio-session mode.
   Provides a very short tap cue for interactive controls plus distinct success/error cues. */
(function installWarehouseValidationSounds(){
  'use strict';
  if(window.WarehouseValidationSounds)return;

  const VERSION='2026.08.24-safe-sounds3-voice-safe';
  const PREF_KEY='so_validation_sounds_enabled';
  let ctx=null;
  let installed=false;
  let lastAt=0;
  let lastKind='';

  const byId=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const now=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
  function enabled(){try{return localStorage.getItem(PREF_KEY)!=='0'}catch{return true}}
  function setEnabled(v){try{localStorage.setItem(PREF_KEY,v?'1':'0')}catch{}return !!v}
  function visible(){return typeof document==='undefined'||document.visibilityState!=='hidden'}
  function audioCtor(){return window.AudioContext||window.webkitAudioContext||null}
  function getContext(){
    if(ctx)return ctx;
    const C=audioCtor();if(!C)return null;
    try{ctx=new C();return ctx}catch{return null}
  }
  function unlock(){
    if(!enabled())return false;
    const c=getContext();if(!c)return false;
    try{if(c.state==='suspended')c.resume?.().catch?.(()=>{})}catch{}
    return true;
  }
  function tone(c,freq,start,duration,volume,type='sine'){
    const o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,start);
    g.gain.setValueAtTime(0.0001,start);
    g.gain.exponentialRampToValueAtTime(volume,start+Math.min(0.01,duration/3));
    g.gain.exponentialRampToValueAtTime(0.0001,start+duration);
    o.connect(g);g.connect(c.destination);o.start(start);o.stop(start+duration+0.012);
  }
  function play(kind='success'){
    if(!enabled()||!visible())return false;
    const t=now(),gap=kind==='tap'?45:180;if(kind===lastKind&&t-lastAt<gap)return false;lastKind=kind;lastAt=t;
    const c=getContext();if(!c)return false;
    try{
      if(c.state==='suspended')c.resume?.().catch?.(()=>{});
      const s=c.currentTime+0.006;
      if(kind==='tap'){
        tone(c,760,s,0.028,0.012,'sine');
      }else if(kind==='error'){
        tone(c,330,s,0.075,0.035);tone(c,245,s+0.095,0.105,0.03);
      }else{
        tone(c,660,s,0.065,0.03);tone(c,880,s+0.082,0.09,0.032);
      }
      return true;
    }catch{return false}
  }
  const tap=()=>play('tap');
  const success=()=>play('success');
  const error=()=>play('error');

  function dbLen(key){try{return Array.isArray(db?.[key])?db[key].length:0}catch{return 0}}
  function masterStamp(){try{return String(db?.master?.imported_at||'')}catch{return ''}}
  function masterRows(){try{return Array.isArray(db?.master?.rows)?db.master.rows.length:0}catch{return 0}}
  function userName(){try{return typeof currentUser!=='undefined'?String(currentUser||''):''}catch{return ''}}

  function wrapSync(name,before,changed){
    const base=window[name];if(typeof base!=='function'||base.__warehouseSoundWrapped)return false;
    const wrapped=function(){
      const snap=before();
      try{
        const out=base.apply(this,arguments);
        if(out&&typeof out.then==='function')return out.then(value=>{if(changed(snap))success();return value},e=>{error();throw e});
        if(changed(snap))success();
        return out;
      }catch(e){error();throw e}
    };
    wrapped.__warehouseSoundWrapped=true;window[name]=wrapped;return true;
  }
  function wrapAsync(name,before,after){
    const base=window[name];if(typeof base!=='function'||base.__warehouseSoundWrapped)return false;
    const wrapped=async function(){
      const snap=before();
      try{
        const out=await base.apply(this,arguments);
        after(snap);return out;
      }catch(e){error();throw e}
    };
    wrapped.__warehouseSoundWrapped=true;window[name]=wrapped;return true;
  }

  function installWrappers(){
    wrapAsync('submitLogin',()=>({user:userName()}),snap=>{
      const user=userName();
      if(user&&user!==snap.user)success();
      else if(byId('loginError')&&!byId('loginError').classList.contains('hidden'))error();
    });
    wrapSync('confirmOperation',()=>dbLen('movements'),n=>dbLen('movements')>n);
    wrapSync('saveMovementEdit',()=>dbLen('audits'),n=>dbLen('audits')>n);
    wrapSync('cancelMovement',()=>dbLen('audits'),n=>dbLen('audits')>n);
    wrapSync('saveRequestFromReview',()=>dbLen('requests'),n=>dbLen('requests')>n);
    wrapSync('deleteRequest',()=>dbLen('requests'),n=>dbLen('requests')<n);
    wrapSync('confirmPicking',()=>dbLen('documents'),n=>dbLen('documents')>n);
    wrapSync('importMappedMaster',()=>masterStamp(),stamp=>!!masterStamp()&&masterStamp()!==stamp);
    wrapAsync('confirmDeleteMaster',()=>({rows:masterRows()}),snap=>{
      if(snap.rows>0&&masterRows()===0)success();
      else if(byId('deleteMasterError')&&!byId('deleteMasterError').classList.contains('hidden'))error();
    });
  }
  function isVoiceControl(target){return !!target?.closest?.('.voiceBtn,#voiceSpeakMore,[data-no-tap-sound="1"]')}
  function isTapControl(target){
    if(!target||typeof target.closest!=='function')return false;
    const el=target.closest('button,[role="button"],.fileBtn,.lmBtn');
    if(!el||el.disabled||el.getAttribute?.('aria-disabled')==='true'||el.dataset?.noTapSound==='1'||isVoiceControl(target))return false;
    return true;
  }
  function onPointerDown(e){
    /* Do not even resume WebAudio on microphone controls: on some Android Chromium
       builds audio focus changes immediately before SpeechRecognition can abort capture. */
    if(isVoiceControl(e.target))return;
    unlock();
    if(isTapControl(e.target))tap();
  }
  function install(){
    if(installed)return true;installed=true;
    installWrappers();
    if(typeof document!=='undefined'){
      document.addEventListener('pointerdown',onPointerDown,{capture:true,passive:true});
      document.addEventListener('keydown',unlock,{capture:true});
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')unlock()});
    }
    return true;
  }

  window.WarehouseValidationSounds={version:VERSION,enabled,setEnabled,unlock,play,tap,success,error,isVoiceControl,isTapControl,installWrappers,install};
  install();
})();
