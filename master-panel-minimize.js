/* Compact/iconizable MASTER EXCEL panel for REMOTO V1.
   Keeps the operational controls unchanged but lets the whole panel collapse into
   a small status bar. Loaded masters start compact unless the user chose otherwise. */
(function installMasterPanelMinimize(){
  'use strict';
  if(window.WarehouseMasterPanelMinimize)return;

  const VERSION='2026.08.26-master-panel-min2';
  const PREF_KEY='so_master_panel_minimized_v1';
  const META_KEY='so_local_master_meta_v3';
  const GUARD_KEY='so_master_generation_guard_v1';
  let installed=false,baseRenderPanel=null;

  const txt=v=>String(v??'');
  const readJson=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')||{}}catch{return {}}};
  const pad=n=>String(Math.max(0,Math.floor(Number(n)||0))).padStart(4,'0');
  const loaded=()=>{try{return !!(db?.master?.rows?.length&&db?.master?.filename)}catch{return false}};
  const dirtyCount=()=>{try{const m=readJson(META_KEY),base=m.lastExportAt||m.importedAt;if(!base)return (db?.audits||[]).length;const t=new Date(base).getTime();return (db?.audits||[]).filter(a=>new Date(a.at||0).getTime()>t).length}catch{return 0}};
  const setText=(el,value)=>{const v=txt(value);if(el&&el.textContent!==v)el.textContent=v};

  function injectCss(){
    if(document.getElementById('masterPanelMinimizeCss'))return;
    const s=document.createElement('style');s.id='masterPanelMinimizeCss';
    s.textContent=`
      #localMasterPanel{position:relative;transition:padding .18s ease,border-radius .18s ease,box-shadow .18s ease}
      #lmMiniBar{display:none;align-items:center;gap:11px;min-height:62px;width:100%;border:0;background:transparent;color:#17314d;text-align:left;padding:5px 2px;cursor:pointer}
      #lmMiniBar .lmMiniIcon{width:42px;height:42px;border-radius:14px;background:#e2eef8;color:#2c60aa;display:grid;place-items:center;font-size:21px;flex:0 0 auto}
      #lmMiniBar .lmMiniText{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
      #lmMiniBar .lmMiniText b{font-size:14px;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #lmMiniBar .lmMiniText span{font-size:12px;color:#65788c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #lmMiniBar .lmMiniBadge{border-radius:999px;padding:6px 9px;background:#e1f4e9;color:#14623e;font-weight:950;font-size:11px;white-space:nowrap}
      #lmMiniBar .lmMiniBadge.warn{background:#fff0d2;color:#7a5208}
      #lmMiniBar .lmMiniChevron{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#e7eef5;color:#2c60aa;font-size:20px;font-weight:900;flex:0 0 auto}
      #localMasterPanel.lmMinimized{padding:9px 14px!important;border-radius:20px!important;box-shadow:0 6px 18px #15395810!important}
      #localMasterPanel.lmMinimized>#lmMiniBar{display:flex}
      #localMasterPanel.lmMinimized>:not(#lmMiniBar){display:none!important}
      #localMasterPanel:not(.lmMinimized)>#lmMiniBar{display:none}
      #lmPanelCollapseBtn{position:absolute;right:12px;top:12px;width:38px;height:38px;border:0;border-radius:50%;background:#e5eef6;color:#2c60aa;font-size:19px;font-weight:950;z-index:3;display:grid;place-items:center}
      #lmPanelCollapseBtn:active{transform:scale(.96)}
      #localMasterPanel.lmMinimized #lmPanelCollapseBtn{display:none}
      @media(max-width:430px){
        #localMasterPanel.lmMinimized{margin:8px 0 12px!important;padding:7px 10px!important;border-radius:17px!important}
        #lmMiniBar{min-height:56px;gap:9px}
        #lmMiniBar .lmMiniIcon{width:38px;height:38px;border-radius:12px;font-size:19px}
        #lmMiniBar .lmMiniText b{font-size:13px}
        #lmMiniBar .lmMiniText span{font-size:11px}
        #lmMiniBar .lmMiniBadge{font-size:10px;padding:5px 7px}
        #lmMiniBar .lmMiniChevron{width:30px;height:30px;font-size:17px}
      }
    `;
    document.head.appendChild(s);
  }

  function preferredMinimized(){
    const raw=localStorage.getItem(PREF_KEY);
    if(raw==='0')return false;
    if(raw==='1')return true;
    return loaded();
  }

  function miniStatus(){
    const m=readJson(META_KEY),g=readJson(GUARD_KEY),dirty=dirtyCount(),gen=Math.max(Number(g.maxGeneration)||0,Number(m.sourceGeneration)||0);
    const name=txt(db?.master?.filename||'Master Excel');
    const subtitle=[gen?`G${pad(gen)}`:'',dirty?`${dirty} modifiche da esportare`:'Nessuna modifica in attesa'].filter(Boolean).join(' · ');
    return {name,subtitle,dirty};
  }

  function refreshMini(){
    const bar=document.getElementById('lmMiniBar');if(!bar)return false;
    if(!loaded()){
      document.getElementById('localMasterPanel')?.classList.remove('lmMinimized');
      return true;
    }
    const s=miniStatus(),name=bar.querySelector('[data-mini-name]'),sub=bar.querySelector('[data-mini-sub]'),badge=bar.querySelector('[data-mini-badge]');
    setText(name,'MASTER EXCEL · PRONTO');
    if(sub){setText(sub,s.subtitle);if(sub.title!==s.name)sub.title=s.name}
    if(badge){setText(badge,s.dirty?`${s.dirty} DA ESPORTARE`:'OK');badge.classList.toggle('warn',!!s.dirty)}
    return true;
  }

  function setMinimized(value,persist=true){
    const panel=document.getElementById('localMasterPanel');if(!panel)return false;
    if(!loaded())value=false;
    const next=!!value;
    if(panel.classList.contains('lmMinimized')!==next)panel.classList.toggle('lmMinimized',next);
    if(persist&&loaded())localStorage.setItem(PREF_KEY,next?'1':'0');
    refreshMini();
    return true;
  }

  function toggle(){const panel=document.getElementById('localMasterPanel');if(!panel)return;setMinimized(!panel.classList.contains('lmMinimized'))}

  function ensureUi(){
    injectCss();
    const panel=document.getElementById('localMasterPanel');if(!panel)return false;
    let bar=document.getElementById('lmMiniBar');
    if(!bar){
      bar=document.createElement('button');bar.id='lmMiniBar';bar.type='button';bar.setAttribute('aria-label','Espandi pannello Master Excel');
      bar.innerHTML='<span class="lmMiniIcon" aria-hidden="true">▦</span><span class="lmMiniText"><b data-mini-name>MASTER EXCEL</b><span data-mini-sub>Stato Master</span></span><span class="lmMiniBadge" data-mini-badge>OK</span><span class="lmMiniChevron" aria-hidden="true">⌄</span>';
      bar.onclick=()=>setMinimized(false);
      panel.insertBefore(bar,panel.firstChild);
    }
    let collapse=document.getElementById('lmPanelCollapseBtn');
    if(!collapse){
      collapse=document.createElement('button');collapse.id='lmPanelCollapseBtn';collapse.type='button';collapse.title='Riduci Master Excel';collapse.setAttribute('aria-label','Riduci pannello Master Excel');collapse.textContent='−';collapse.onclick=()=>setMinimized(true);panel.appendChild(collapse);
    }
    if(!panel.dataset.lmMiniInitialized){panel.dataset.lmMiniInitialized='1';setMinimized(preferredMinimized(),false)}
    refreshMini();return true;
  }

  function wrapRender(){
    const lm=window.LocalMaster;if(!lm||typeof lm.renderPanel!=='function')return false;
    if(lm.renderPanel.__masterPanelMinimized)return true;
    baseRenderPanel=lm.renderPanel;
    const wrapped=async function(){
      const out=await baseRenderPanel.apply(this,arguments);ensureUi();
      if(!loaded())setMinimized(false,false);
      else if(localStorage.getItem(PREF_KEY)===null)setMinimized(true,false);
      refreshMini();return out;
    };
    wrapped.__masterPanelMinimized=true;wrapped.__previous=baseRenderPanel;lm.renderPanel=wrapped;return true;
  }

  function install(){
    if(installed){ensureUi();refreshMini();return true}
    if(typeof document==='undefined')return false;
    ensureUi();wrapRender();
    const ob=new MutationObserver(()=>{ensureUi();refreshMini()});ob.observe(document.body,{childList:true,subtree:true});
    installed=true;return true;
  }

  window.WarehouseMasterPanelMinimize={version:VERSION,install,setMinimized,toggle,refreshMini,miniStatus};
  if(typeof document!=='undefined')install();
})();
