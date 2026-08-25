/* Top-level Gboard UX enhancement for REMOTO.
   Never rewrites the textarea while Gboard is dictating. Instead it shows, live,
   the normalized text the warehouse parser will receive. */
(function installWarehouseTopLevelGboardUx(){
  'use strict';
  if(window.WarehouseTopLevelGboardUx)return;
  const VERSION='2026.08.25-gboard-ux1';
  let wired=false;

  const $=id=>document.getElementById(id);
  const child=()=>document.getElementById('warehouseApp')?.contentWindow||null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function ensureStyle(){
    if($('gboardUxStyle'))return;
    const s=document.createElement('style');s.id='gboardUxStyle';s.textContent=`
      .gbLive{display:none;margin:12px 0 2px;padding:12px 13px;border:1px solid #cfe0ef;border-radius:17px;background:#f3f8fd}.gbLive.on{display:block}.gbLiveHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.gbLiveTitle{font-size:11px;letter-spacing:.09em;font-weight:950;color:#55718d}.gbLiveState{font-size:11px;font-weight:950;color:#137146;background:#dff3e8;border-radius:999px;padding:5px 8px}.gbLiveText{font-size:16px;line-height:1.42;font-weight:800;color:#17314d;overflow-wrap:anywhere}.gbCodes{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.gbCode{font-size:12px;font-weight:950;border-radius:999px;padding:5px 8px;background:#dfeaf7;color:#245b91}.gbCode.known{background:#dff3e8;color:#14633f}.gbHint{margin-top:7px;font-size:12px;color:#6d8194;line-height:1.35}
    `;document.head.appendChild(s);
  }
  function ensurePreview(){
    ensureStyle();let box=$('gboardLivePreview');if(box)return box;
    const wrap=$('wtldDialog')?.querySelector('.wtldInputWrap');if(!wrap)return null;
    box=document.createElement('div');box.id='gboardLivePreview';box.className='gbLive';box.innerHTML='<div class="gbLiveHead"><span class="gbLiveTitle">INTERPRETAZIONE LIVE</span><span class="gbLiveState">PRONTA</span></div><div id="gboardLiveText" class="gbLiveText"></div><div id="gboardLiveCodes" class="gbCodes"></div><div class="gbHint">Il testo sopra rimane esattamente come lo scrive Gboard. Qui sotto vedi come l’app sta interpretando codici e dati.</div>';
    wrap.insertAdjacentElement('afterend',box);return box;
  }
  function resultFor(raw){
    try{return child()?.WarehouseGboardNormalizer?.preview?.(raw)||{normalized:String(raw||''),codes:[],knownCodes:[]}}catch{return {normalized:String(raw||''),codes:[],knownCodes:[]}}
  }
  function render(){
    const text=$('wtldText'),box=ensurePreview();if(!text||!box)return;
    const raw=text.value||'',trim=raw.trim();box.classList.toggle('on',!!trim);if(!trim)return;
    const r=resultFor(raw),known=new Set(r.knownCodes||[]);
    $('gboardLiveText').textContent=r.normalized||raw;
    $('gboardLiveCodes').innerHTML=(r.codes||[]).map(c=>`<span class="gbCode ${known.has(c)?'known':''}">${esc(c)}</span>`).join('');
    box.querySelector('.gbLiveState').textContent=(r.knownCodes||[]).length?'CODICE RICONOSCIUTO':'ANALISI LIVE';
  }
  function wire(){
    const text=$('wtldText');if(!text)return false;
    text.setAttribute('inputmode','text');text.setAttribute('lang','it-IT');text.setAttribute('autocomplete','off');text.setAttribute('autocorrect','off');text.setAttribute('autocapitalize','none');text.setAttribute('spellcheck','false');
    if(!text.dataset.gboardUxBound){text.dataset.gboardUxBound='1';text.addEventListener('input',render);text.addEventListener('compositionend',render)}
    ensurePreview();render();wired=true;return true;
  }
  function patchOpen(){
    const api=window.WarehouseTopLevelDictation;if(!api||api.__gboardUxPatched)return false;
    const base=api.open.bind(api);
    api.open=function(hint,options){const out=base(hint,options);requestAnimationFrame(()=>{wire();render()});return out};
    api.__gboardUxPatched=true;return true;
  }
  function install(){patchOpen();wire();return true}
  window.WarehouseTopLevelGboardUx={version:VERSION,install,wire,render,resultFor};
  install();
})();