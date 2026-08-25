/* Fast interaction path for carton requests.
   Draft taps/values update in memory + a tiny dedicated local cache; they do NOT
   serialize the whole warehouse DB or rebuild the whole request after each touch.
   Full DB persistence still happens on the real picking confirmation and on other
   warehouse operations. */
(function installRequestInteractionPerformanceFix(){
  'use strict';
  if(window.WarehouseRequestInteractionPerformanceFix)return;

  const VERSION='2026.08.25-request-fast1';
  const CACHE_KEY='so_request_draft_cache_v1';
  const text=v=>String(v??'');
  const isCartonRequest=req=>!!req&&(req.quantity_unit==='CARTONI'||Number(req.request_schema||0)>=2);
  const clone=v=>{try{return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v))}catch{return v}};
  const deliveryCount=req=>Array.isArray(req?.deliveries)?req.deliveries.length:0;
  const rectificationCount=()=>{try{return (db?.rectifications||[]).filter(r=>!r?.cancelled_at).length}catch{return 0}};
  const storage=()=>{try{return window.localStorage||localStorage}catch{return null}};

  let timer=null;
  const pending=new Map();

  function readCache(){try{const raw=storage()?.getItem(CACHE_KEY);const parsed=raw?JSON.parse(raw):{};return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch{return {}}}
  function writeCache(cache){try{storage()?.setItem(CACHE_KEY,JSON.stringify(cache));return true}catch{return false}}
  function prune(cache){const entries=Object.entries(cache).sort((a,b)=>Number(b[1]?.at||0)-Number(a[1]?.at||0));for(const [id] of entries.slice(20))delete cache[id];return cache}
  function cacheDraftNow(req){
    if(!req?.id||!isCartonRequest(req))return false;
    const cache=readCache();cache[req.id]={at:Date.now(),deliveryCount:deliveryCount(req),rectificationCount:rectificationCount(),draft:clone(req.draft||{allocations:[],extraAllocations:[],note:''})};writeCache(prune(cache));return true;
  }
  function flushCache(){if(timer){clearTimeout(timer);timer=null}for(const req of pending.values())cacheDraftNow(req);pending.clear()}
  function scheduleCache(req){if(!req?.id)return;pending.set(req.id,req);if(timer)clearTimeout(timer);timer=setTimeout(flushCache,120)}
  function clearDraftCache(id){if(!id)return;pending.delete(id);const cache=readCache();if(id in cache){delete cache[id];writeCache(cache)}if(!pending.size&&timer){clearTimeout(timer);timer=null}}
  function hydrateDraft(req){
    if(!req?.id||!isCartonRequest(req))return false;
    const saved=readCache()[req.id];if(!saved?.draft)return false;
    if(Number(saved.deliveryCount||0)!==deliveryCount(req))return false;
    if(Number(saved.rectificationCount||0)!==rectificationCount())return false;
    req.draft=clone(saved.draft);return true;
  }

  function applyDraftValue(a,key,value){
    if(!a)return null;
    if(key==='quantity')a.quantity=Math.max(0,Math.min(Math.floor(Number(value)||0),Math.floor(Number(a.available)||0)));
    else if(key==='cartons')a.cartons=Math.max(0,Math.floor(Number(value)||0));
    else if(key==='checked')a.checked=value===true||value===1||value==='true';
    else a[key]=value;
    return a;
  }

  function activeRequest(){try{const id=typeof activeRequestId!=='undefined'?activeRequestId:null;return id?(db?.requests||[]).find(r=>r.id===id)||null:null}catch{return null}}
  function cardForAllocation(id){
    if(typeof document==='undefined')return null;
    const needle=`'${text(id)}'`;
    for(const card of document.querySelectorAll('.stockPick.cartonPick')){
      if([...card.querySelectorAll('[onchange]')].some(el=>text(el.getAttribute('onchange')).includes(needle)))return card;
    }
    return null;
  }
  function patchAllocationCard(id,a){
    const card=cardForAllocation(id);if(!card)return false;
    card.classList.toggle('selected',!!a.checked);
    const check=card.querySelector('.pickCheck');if(check)check.checked=!!a.checked;
    const cartons=card.querySelector('.cartonQty');if(cartons&&document.activeElement!==cartons)cartons.value=String(Math.max(0,Math.floor(Number(a.cartons)||0)));
    const pieces=card.querySelector('.pieceQty');if(pieces){pieces.max=String(Math.max(0,Math.floor(Number(a.available)||0)));if(document.activeElement!==pieces||Number(pieces.value)>Number(a.available||0))pieces.value=String(Math.max(0,Math.floor(Number(a.quantity)||0)))}
    const notes=card.querySelector('.notes');if(notes&&document.activeElement!==notes)notes.value=text(a.note||'');
    return true;
  }

  function install(){
    if(typeof document==='undefined')return true;

    if(typeof window.updateAllocation==='function'&&!window.updateAllocation.__warehouseFastRequest){
      const baseUpdate=window.updateAllocation;
      const fast=function(id,key,value,extra=false){
        const req=activeRequest();if(!isCartonRequest(req))return baseUpdate.apply(this,arguments);
        const arr=extra?req?.draft?.extraAllocations:req?.draft?.allocations,a=Array.isArray(arr)?arr.find(x=>x.id===id):null;if(!a)return;
        applyDraftValue(a,key,value);patchAllocationCard(id,a);scheduleCache(req);return true;
      };
      fast.__warehouseFastRequest=true;fast.__warehousePrevious=baseUpdate;window.updateAllocation=fast;
    }

    if(typeof window.openRequestDetail==='function'&&!window.openRequestDetail.__warehouseDraftCache){
      const baseOpen=window.openRequestDetail;
      const wrapped=function(id){try{const req=(db?.requests||[]).find(r=>r.id===id);if(isCartonRequest(req))hydrateDraft(req)}catch{}return baseOpen.apply(this,arguments)};
      wrapped.__warehouseDraftCache=true;wrapped.__warehousePrevious=baseOpen;window.openRequestDetail=wrapped;
    }

    if(typeof window.renderRequestDetail==='function'&&!window.renderRequestDetail.__warehouseDraftCache){
      const baseRender=window.renderRequestDetail;
      const wrapped=function(req){const out=baseRender.apply(this,arguments);if(isCartonRequest(req))scheduleCache(req);return out};
      wrapped.__warehouseDraftCache=true;wrapped.__warehousePrevious=baseRender;window.renderRequestDetail=wrapped;
    }

    if(typeof window.confirmPicking==='function'&&!window.confirmPicking.__warehouseDraftCache){
      const baseConfirm=window.confirmPicking;
      const wrapped=async function(){const req=activeRequest(),before=deliveryCount(req);flushCache();const out=await baseConfirm.apply(this,arguments);if(req&&deliveryCount(req)>before)clearDraftCache(req.id);else if(req)scheduleCache(req);return out};
      wrapped.__warehouseDraftCache=true;wrapped.__warehousePrevious=baseConfirm;window.confirmPicking=wrapped;
    }

    window.addEventListener?.('pagehide',flushCache);
    document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='hidden')flushCache()});
    return true;
  }

  window.WarehouseRequestInteractionPerformanceFix={version:VERSION,CACHE_KEY,readCache,cacheDraftNow,scheduleCache,flushCache,clearDraftCache,hydrateDraft,applyDraftValue,patchAllocationCard,install};
  if(typeof document!=='undefined')install();
})();
