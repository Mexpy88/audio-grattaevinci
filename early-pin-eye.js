/* Early PIN reveal installer.
   Runs before the extension stack so the eye is already present when the PIN dialog opens. */
(function installWarehouseEarlyPinEye(){
  'use strict';
  if(window.WarehouseEarlyPinEye)return;

  const VERSION='2026.08.25-early-pin-eye1';
  const frame=document.getElementById('warehouseApp');

  function eyeSvg(hidden){
    return hidden
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.4 12s3.4-6 9.6-6 9.6 6 9.6 6-3.4 6-9.6 6-9.6-6-9.6-6Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6.2 0 9.6 6 9.6 6a16 16 0 0 1-3 3.7M6.2 6.2C3.7 8.1 2.4 12 2.4 12s3.4 6 9.6 6c1.4 0 2.7-.3 3.8-.8M9.9 9.9A3 3 0 0 0 14.1 14.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function injectStyle(d){
    if(!d||d.getElementById('sessionCyclePinStyle'))return;
    const style=d.createElement('style');style.id='sessionCyclePinStyle';
    style.textContent=`
      #pinInput::-ms-reveal,#pinInput::-ms-clear,#deleteMasterPin::-ms-reveal,#deleteMasterPin::-ms-clear{display:none!important;width:0!important;height:0!important}
      .pinRevealWrap{position:relative;width:100%}
      .pinRevealWrap>.pinInput{width:100%!important;box-sizing:border-box!important;padding-right:54px!important}
      .pinRevealBtn{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:42px;height:42px;border:0;border-radius:12px;background:transparent;color:#587087;display:grid;place-items:center;padding:9px;cursor:pointer;-webkit-tap-highlight-color:transparent}
      .pinRevealBtn:focus-visible{outline:2px solid #2c60aa;outline-offset:1px}
      .pinRevealBtn svg{width:24px;height:24px;display:block}
    `;
    d.head.appendChild(style);
  }

  function installOne(d,inputId){
    const input=d?.getElementById(inputId);if(!input)return false;
    if(input.dataset.pinEyeInstalled==='1')return true;
    input.dataset.pinEyeInstalled='1';
    const wrap=d.createElement('div');wrap.className='pinRevealWrap';
    input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const button=d.createElement('button');button.type='button';button.className='pinRevealBtn';button.setAttribute('aria-label','Mostra PIN');button.setAttribute('aria-pressed','false');button.innerHTML=eyeSvg(true);
    button.addEventListener('click',()=>{
      const show=input.type==='password';input.type=show?'text':'password';
      button.setAttribute('aria-label',show?'Nascondi PIN':'Mostra PIN');button.setAttribute('aria-pressed',show?'true':'false');button.innerHTML=eyeSvg(!show);
      try{input.focus({preventScroll:true});const n=input.value.length;input.setSelectionRange?.(n,n)}catch{}
    });
    wrap.appendChild(button);return true;
  }

  function install(){
    const d=frame?.contentDocument;if(!d)return false;
    injectStyle(d);installOne(d,'pinInput');installOne(d,'deleteMasterPin');return true;
  }

  if(frame){frame.addEventListener('load',install);try{if(frame.contentDocument?.readyState==='complete')install()}catch{}}
  window.WarehouseEarlyPinEye={version:VERSION,install};
})();
