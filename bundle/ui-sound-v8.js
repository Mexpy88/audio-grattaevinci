(()=>{
  'use strict';

  let audioCtx=null;
  let lastSuccessAt=0;

  const getAudio=()=>{
    const AudioCtor=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtor)return null;
    try{
      if(!audioCtx)audioCtx=new AudioCtor({latencyHint:'interactive'});
      if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
      return audioCtx;
    }catch{return null}
  };

  const tone=(frequency,duration,gain=0.014,type='sine',delay=0)=>{
    const ctx=getAudio();
    if(!ctx)return;
    const start=ctx.currentTime+delay;
    const osc=ctx.createOscillator();
    const amp=ctx.createGain();
    osc.type=type;
    osc.frequency.setValueAtTime(frequency,start);
    amp.gain.setValueAtTime(0,start);
    amp.gain.linearRampToValueAtTime(gain,start+0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001,start+duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start+duration+0.01);
  };

  const softTap=()=>{
    tone(330,0.028,0.014,'sine',0);
    tone(520,0.020,0.0085,'sine',0.010);
  };

  const keyTick=()=>{
    tone(760,0.016,0.009,'triangle',0);
  };

  const accessSuccess=()=>{
    const now=performance.now();
    if(now-lastSuccessAt<500)return;
    lastSuccessAt=now;
    tone(520,0.055,0.017,'sine',0);
    tone(660,0.060,0.016,'sine',0.045);
    tone(820,0.075,0.0145,'sine',0.092);
  };

  const checkSuccessfulLogin=()=>{
    window.setTimeout(()=>{
      const dialog=document.getElementById('loginDialog');
      const topbar=document.getElementById('topbar');
      if(dialog&&!dialog.open&&topbar&&!topbar.classList.contains('hidden'))accessSuccess();
    },150);
  };

  document.addEventListener('pointerdown',event=>{
    if(event.target.closest?.('.warehouse-teramo'))softTap();
  },{capture:true,passive:true});

  document.addEventListener('input',event=>{
    if(event.isTrusted&&event.target?.id==='loginPin')keyTick();
  },true);

  document.addEventListener('submit',event=>{
    if(event.target?.querySelector?.('#loginPin'))checkSuccessfulLogin();
  },true);

  document.addEventListener('click',event=>{
    if(event.target.closest?.('#loginDialog .primary'))checkSuccessfulLogin();
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&document.activeElement?.id==='loginPin')checkSuccessfulLogin();
  },true);
})();
