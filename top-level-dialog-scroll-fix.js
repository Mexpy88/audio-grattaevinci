/* Mobile scroll/touch fix for the top-level dictation dialog.
   Keeps header/actions reachable and makes only the central content scrollable. */
(function installWarehouseTopDialogScrollFix(){
  'use strict';
  if(window.WarehouseTopDialogScrollFix)return;
  const VERSION='2026.08.25-scrollfix1';
  function install(){
    if(document.getElementById('wtldScrollFixStyle'))return true;
    const s=document.createElement('style');
    s.id='wtldScrollFixStyle';
    s.textContent=`
      #wtldDialog[open]{
        box-sizing:border-box;
        display:flex !important;
        flex-direction:column;
        height:min(90dvh,820px);
        max-height:min(90dvh,820px);
        overflow:hidden !important;
        overscroll-behavior:none;
      }
      #wtldDialog .wtldHead{
        flex:0 0 auto;
        position:relative;
        z-index:4;
      }
      #wtldDialog .wtldBody{
        box-sizing:border-box;
        flex:1 1 auto;
        min-height:0;
        max-height:none !important;
        overflow-y:auto !important;
        overflow-x:hidden !important;
        -webkit-overflow-scrolling:touch;
        overscroll-behavior-y:contain;
        touch-action:pan-y;
        position:relative;
        z-index:1;
      }
      #wtldDialog .wtldActions{
        flex:0 0 auto;
        position:relative;
        z-index:5;
        pointer-events:auto;
      }
      #wtldDialog .wtldActions button,
      #wtldDialog .wtldClose{
        pointer-events:auto;
        touch-action:manipulation;
      }
      #wtldDialog .wtldText{
        overflow-y:auto;
        -webkit-overflow-scrolling:touch;
      }
      @media(max-width:430px){
        #wtldDialog[open]{
          width:100vw;
          height:min(92dvh,820px);
          max-height:92dvh;
          margin:auto auto 0;
        }
        #wtldDialog .wtldBody{
          padding-bottom:14px;
        }
      }
      @media(max-height:700px){
        #wtldDialog[open]{height:96dvh;max-height:96dvh}
        #wtldDialog .wtldHead{padding-top:12px;padding-bottom:10px}
        #wtldDialog .wtldBody{padding-top:10px}
      }
    `;
    document.head.appendChild(s);
    return true;
  }
  window.WarehouseTopDialogScrollFix={version:VERSION,install};
  install();
})();
