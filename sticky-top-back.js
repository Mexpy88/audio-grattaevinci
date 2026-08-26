/* Sticky top-bar navigation for REMOTO.
   Keeps BACK always reachable while preserving each screen's existing back logic. */
(function installWarehouseStickyTopBack(){
  'use strict';
  if(window.WarehouseStickyTopBack)return;
  const VERSION='2026.08.26-sticky-top-back1';
  let installed=false,baseShow=null,observer=null;

  function currentScreen(){return document.querySelector('main .screen.on')}

  function injectCss(){
    if(document.getElementById('stickyTopBackCss'))return;
    const s=document.createElement('style');s.id='stickyTopBackCss';s.textContent=`
      .topNavLeft{display:flex;align-items:center;gap:7px;min-width:0;flex:1}
      #stickyTopBack{width:42px;height:42px;min-width:42px;border:0;border-radius:14px;background:#dfeaf4;color:#2c60aa;display:grid;place-items:center;font-size:28px;font-weight:900;line-height:1;padding:0;box-shadow:0 3px 10px #17314d12}
      #stickyTopBack:active{transform:scale(.96);background:#d3e3f0}
      #stickyTopBack.hidden{display:none!important}
      .topNavLeft .logoButton{min-width:0;display:flex;align-items:center}
      .topNavLeft .logoButton img{background:transparent!important}
      body.stickyTopBackReady main>.screen>.back{display:none!important}
      @media(max-width:430px){#stickyTopBack{width:40px;height:40px;min-width:40px;border-radius:13px;font-size:26px}.topNavLeft{gap:5px}.topNavLeft .logoButton img{width:min(168px,42vw)!important;max-width:none!important}}
      @media(max-width:360px){#stickyTopBack{width:38px;height:38px;min-width:38px}.topNavLeft .logoButton img{width:min(138px,39vw)!important}}
    `;document.head.appendChild(s);
  }

  function ensureButton(){
    const top=document.querySelector('.topbar'),logo=top?.querySelector('.logoButton');if(!top||!logo)return false;
    let wrap=top.querySelector('.topNavLeft');
    if(!wrap){wrap=document.createElement('div');wrap.className='topNavLeft';top.insertBefore(wrap,logo);wrap.appendChild(logo)}
    let back=document.getElementById('stickyTopBack');
    if(!back){
      back=document.createElement('button');back.id='stickyTopBack';back.type='button';back.className='hidden';back.setAttribute('aria-label','Torna indietro');back.title='Indietro';back.textContent='‹';
      back.onclick=goBack;wrap.insertBefore(back,logo);
    }
    document.body.classList.add('stickyTopBackReady');return true;
  }

  function sync(){
    const back=document.getElementById('stickyTopBack');if(!back)return false;
    const screen=currentScreen(),isHome=!screen||screen.id==='home';
    back.classList.toggle('hidden',isHome);
    if(!isHome){
      const nativeBack=screen.querySelector(':scope > .back');
      const label=(nativeBack?.textContent||'INDIETRO').replace(/^\s*[←‹]\s*/,'').trim();
      back.setAttribute('aria-label',label?`Indietro: ${label}`:'Torna indietro');
      back.title=label||'Indietro';
    }
    return true;
  }

  function goBack(){
    const screen=currentScreen();if(!screen||screen.id==='home')return;
    const nativeBack=screen.querySelector(':scope > .back');
    if(nativeBack){nativeBack.click();setTimeout(sync,0);return}
    if(typeof window.show==='function'){window.show('home');setTimeout(sync,0)}
  }

  function wrapShow(){
    if(typeof window.show!=='function'||window.show.__stickyTopBack)return false;
    baseShow=window.show;
    const wrapped=function(){const out=baseShow.apply(this,arguments);setTimeout(sync,0);return out};
    wrapped.__stickyTopBack=true;wrapped.__previous=baseShow;window.show=wrapped;return true;
  }

  function watchScreens(){
    const main=document.querySelector('main');if(!main||typeof MutationObserver!=='function'||observer)return;
    observer=new MutationObserver(sync);observer.observe(main,{attributes:true,subtree:true,attributeFilter:['class']});
  }

  function install(){
    if(typeof document==='undefined')return false;
    injectCss();if(!ensureButton())return false;wrapShow();watchScreens();sync();installed=true;return true;
  }

  window.WarehouseStickyTopBack={version:VERSION,install,sync,goBack};
  install();
})();
