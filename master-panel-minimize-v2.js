/* Compact the whole MASTER EXCEL panel into a status bar when a Master is loaded. */
(function installMasterPanelMinimizeV2(){
  'use strict';
  if(window.WarehouseMasterPanelMinimizeV2)return;
  const VERSION='2026.08.26-master-panel-min-v2';
  const PREF='so_master_panel_minimized_v2';
  const META='so_local_master_meta_v3';
  const GUARD='so_master_generation_guard_v1';
  let installed=false,baseRender=null;
  const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')||{}}catch{return {}}};
  const loaded=()=>{try{return !!(db?.master?.rows?.length&&db?.master?.filename)}catch{return false}};
  const pad=n=>String(Math.max(0,Math.floor(Number(n)||0))).padStart(4,'0');
  const dirty=()=>{try{const m=read(META),base=m.lastExportAt||m.importedAt;if(!base)return (db?.audits||[]).length;const t=new Date(base).getTime();return (db?.audits||[]).filter(a=>new Date(a.at||0).getTime()>t).length}catch{return 0}};

  function css(){if(document.getElementById('masterPanelMinV2Css'))return;const s=document.createElement('style');s.id='masterPanelMinV2Css';s.textContent=`
    #localMasterPanel{position:relative}
    #lmCompactBar{display:none;width:100%;min-height:60px;border:0;background:transparent;padding:4px 2px;align-items:center;gap:10px;text-align:left;color:#17314d}
    #lmCompactBar .ico{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#e2eef8;color:#2c60aa;font-size:20px;flex:0 0 auto}
    #lmCompactBar .txt{min-width:0;flex:1}.lmCompactTitle{font-weight:950;font-size:13px;letter-spacing:.04em}.lmCompactSub{font-size:11px;color:#65788c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
    #lmCompactBar .badge{font-size:10px;font-weight:950;padding:6px 8px;border-radius:999px;background:#e1f4e9;color:#14623e;white-space:nowrap}.badge.warn{background:#fff0d2!important;color:#7a5208!important}
    #lmCompactBar .chev{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#e7eef5;color:#2c60aa;font-size:16px;flex:0 0 auto}
    #localMasterPanel.lmPanelMinimized{padding:8px 12px!important;border-radius:18px!important;box-shadow:0 6px 18px #15395810!important;margin:8px 0 12px!important}
    #localMasterPanel.lmPanelMinimized>#lmCompactBar{display:flex}
    #localMasterPanel.lmPanelMinimized>:not(#lmCompactBar){display:none!important}
    #lmCollapseWhole{position:absolute;right:11px;top:11px;width:38px;height:38px;border:0;border-radius:50%;background:#e5eef6;color:#2c60aa;font-weight:950;font-size:18px;z-index:4}
    #localMasterPanel.lmPanelMinimized #lmCollapseWhole{display:none}
    @media(max-width:430px){#lmCompactBar{min-height:54px;gap:8px}#lmCompactBar .ico{width:38px;height:38px}.lmCompactTitle{font-size:12px}.lmCompactSub{font-size:10px}#localMasterPanel.lmPanelMinimized{padding:6px 9px!important}}
  `;document.head.appendChild(s)}

  function status(){const m=read(META),g=read(GUARD),d=dirty(),gen=Math.max(Number(g.maxGeneration)||0,Number(m.sourceGeneration)||0);return {d,sub:[gen?`G${pad(gen)}`:'',d?`${d} modifiche da esportare`:'Nessuna modifica in attesa'].filter(Boolean).join(' · '),name:String(db?.master?.filename||'Master Excel')}}
  function refresh(){const bar=document.getElementById('lmCompactBar');if(!bar)return false;if(!loaded()){document.getElementById('localMasterPanel')?.classList.remove('lmPanelMinimized');return true}const s=status(),sub=bar.querySelector('[data-sub]'),badge=bar.querySelector('[data-badge]');if(sub){sub.textContent=s.sub;sub.title=s.name}if(badge){badge.textContent=s.d?`${s.d} DA ESPORTARE`:'OK';badge.classList.toggle('warn',!!s.d)}return true}
  function setMinimized(v,persist=true){const panel=document.getElementById('localMasterPanel');if(!panel)return false;if(!loaded())v=false;panel.classList.toggle('lmPanelMinimized',!!v);if(persist&&loaded())localStorage.setItem(PREF,v?'1':'0');refresh();return true}
  function preferred(){const p=localStorage.getItem(PREF);if(p==='0')return false;if(p==='1')return true;return loaded()}

  function ensure(){css();const panel=document.getElementById('localMasterPanel');if(!panel)return false;let bar=document.getElementById('lmCompactBar');if(!bar){bar=document.createElement('button');bar.id='lmCompactBar';bar.type='button';bar.setAttribute('aria-label','Espandi Master Excel');bar.innerHTML='<span class="ico">▦</span><span class="txt"><div class="lmCompactTitle">MASTER EXCEL · PRONTO</div><div class="lmCompactSub" data-sub>Stato Master</div></span><span class="badge" data-badge>OK</span><span class="chev">⌄</span>';bar.onclick=()=>setMinimized(false);panel.insertBefore(bar,panel.firstChild)}let close=document.getElementById('lmCollapseWhole');if(!close){close=document.createElement('button');close.id='lmCollapseWhole';close.type='button';close.title='Riduci pannello Master';close.setAttribute('aria-label','Riduci pannello Master');close.textContent='−';close.onclick=()=>setMinimized(true);panel.appendChild(close)}if(!panel.dataset.wholeMinInit){panel.dataset.wholeMinInit='1';setMinimized(preferred(),false)}refresh();return true}

  function wrap(){const lm=window.LocalMaster;if(!lm||typeof lm.renderPanel!=='function'||lm.renderPanel.__wholeMinV2)return false;baseRender=lm.renderPanel;const f=async function(){const out=await baseRender.apply(this,arguments);ensure();if(!loaded())setMinimized(false,false);else if(localStorage.getItem(PREF)===null)setMinimized(true,false);refresh();return out};f.__wholeMinV2=true;f.__previous=baseRender;lm.renderPanel=f;return true}
  function install(){if(installed){ensure();refresh();return true}if(typeof document==='undefined')return false;ensure();wrap();const ob=new MutationObserver(()=>{ensure();refresh()});ob.observe(document.body,{childList:true,subtree:true});installed=true;return true}
  window.WarehouseMasterPanelMinimizeV2={version:VERSION,install,setMinimized,refresh};if(typeof document!=='undefined')install();
})();
