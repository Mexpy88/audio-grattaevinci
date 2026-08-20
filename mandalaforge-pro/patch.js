document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.getElementById('buildFromReference');
  btn?.addEventListener('click',()=>{
    const api=window.__MF__,ratio=parseFloat(document.getElementById('aRatio')?.textContent||'');
    if(api?.state&&Number.isFinite(ratio)){
      api.state.frame=(ratio>1.15||ratio<.85)?'rectangle':'rounded';
    }
  },true);
});
