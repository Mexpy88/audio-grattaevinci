/* Correzioni mirate: feedback importazione, salvataggio richieste e modalità desktop/smartphone. */
(function installWarehouseFixes(){
  function toast(message,type='success'){
    let host=document.getElementById('warehouseToastHost');
    if(!host){
      host=document.createElement('div');
      host.id='warehouseToastHost';
      document.body.appendChild(host);
    }
    host.innerHTML='';
    const el=document.createElement('div');
    el.className=`warehouseToast ${type}`;
    el.textContent=message;
    host.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('show'));
    clearTimeout(window.__warehouseToastTimer);
    window.__warehouseToastTimer=setTimeout(()=>{
      el.classList.remove('show');
      setTimeout(()=>{if(host.contains(el))host.removeChild(el)},220);
    },3200);
  }
  window.warehouseToast=toast;

  function applyViewMode(mode,persist=true){
    const value=mode==='desktop'?'desktop':'smartphone';
    document.body.classList.toggle('desktopMode',value==='desktop');
    document.querySelectorAll('#viewModeSwitch button').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===value));
    if(persist){try{localStorage.setItem('so_view_mode',value)}catch{}}
  }
  window.setWarehouseViewMode=function(mode){applyViewMode(mode,true)};

  const home=document.getElementById('home');
  if(home&&!document.getElementById('viewModeSwitch')){
    const hero=home.querySelector('.hero');
    const switcher=document.createElement('div');
    switcher.id='viewModeSwitch';
    switcher.className='viewModeSwitch';
    switcher.innerHTML='<button type="button" data-mode="smartphone" onclick="setWarehouseViewMode(\'smartphone\')">📱 SMARTPHONE</button><button type="button" data-mode="desktop" onclick="setWarehouseViewMode(\'desktop\')">🖥️ DESKTOP</button>';
    if(hero)hero.insertAdjacentElement('afterend',switcher);
  }
  let savedMode='';
  try{savedMode=localStorage.getItem('so_view_mode')||''}catch{}
  applyViewMode(savedMode||(window.innerWidth>=900?'desktop':'smartphone'),false);

  const originalImport=window.importAnalysisResult;
  if(typeof originalImport==='function'){
    window.importAnalysisResult=function(){
      const modeBefore=typeof analysisMode!=='undefined'?analysisMode:'';
      originalImport();
      requestAnimationFrame(()=>{
        const active=document.querySelector('.screen.on')?.id||'';
        if(active==='results'){
          let count=0;
          try{count=importedPhotos.reduce((a,p)=>a+p.groups.reduce((b,g)=>b+g.variants.length,0),0)}catch{}
          toast(count?`Importazione riuscita: ${count} righe caricate e pronte da verificare.`:'Importazione riuscita. Risultati pronti da verificare.','success');
        }else if(active==='requestReview'){
          let count=0;
          try{count=requestReviewLines.length}catch{}
          toast(count?`Richiesta importata correttamente: ${count} righe.`:'Richiesta importata correttamente.','success');
        }else if(modeBefore&&active==='bridge'){
          const status=document.getElementById('importStatus');
          if(status&&!status.classList.contains('hidden')&&status.classList.contains('error'))toast(status.textContent||'Importazione non riuscita.','error');
        }
      });
    };
  }

  function requestLinesFromScreen(){
    const holder=document.getElementById('requestReviewLines');
    if(!holder)return [];
    return [...holder.querySelectorAll('.card')].map(card=>{
      const inputs=[...card.querySelectorAll('input')];
      return {
        article_base:normalizeArticle(inputs[0]?.value||''),
        size:String(inputs[1]?.value||'').trim().toUpperCase(),
        quantity:Math.max(0,Number(inputs[2]?.value)||0),
        note:String(inputs[3]?.value||'').trim()
      };
    }).filter(line=>line.article_base&&line.quantity>0);
  }

  window.saveRequestFromReview=function(){
    if(!requireLogin())return;
    try{
      const lines=requestLinesFromScreen();
      if(!lines.length){
        toast('Inserisci almeno una riga valida con articolo e quantità.','error');
        alert('Inserisci almeno una riga valida.');
        return;
      }
      requestReviewLines=lines.map(line=>({...line}));
      const destination=document.getElementById('requestDestination')?.value||'LINA';
      const requestedAtValue=document.getElementById('requestAt')?.value||'';
      const reference=document.getElementById('requestReference')?.value?.trim()||'';
      const req={
        id:nextRequestId(),
        destination,
        requested_at:requestedAtValue?new Date(requestedAtValue).toISOString():new Date().toISOString(),
        created_at:new Date().toISOString(),
        operator:operatorName(),
        reference,
        lines,
        status:'DA PREPARARE',
        deliveries:[],
        draft:{allocations:[],extraAllocations:[],note:''}
      };
      db.requests.unshift(req);
      audit('CREATE','REQUEST',req.id,null,req);
      saveDb();
      activeRequestId=req.id;
      toast(`Richiesta ${req.id} salvata. Verifica giacenze in corso…`,'success');
      try{
        openRequestDetail(req.id);
      }catch(detailErr){
        console.error('Apertura verifica giacenze fallita',detailErr);
        try{renderRequestList();show('requestsScreen')}catch{}
        toast(`Richiesta ${req.id} salvata. Aprila dalla lista per verificare le giacenze.`,'warn');
      }
    }catch(err){
      console.error('Errore salvataggio richiesta',err);
      toast('Errore durante il salvataggio della richiesta.','error');
      alert('Errore durante il salvataggio della richiesta: '+(err?.message||err));
    }
  };

  /* Mantiene sempre leggibile il nome operatore dopo login/logout. */
  const originalSyncAuth=window.syncAuthUI;
  if(typeof originalSyncAuth==='function'){
    window.syncAuthUI=function(){
      originalSyncAuth();
      const user=document.getElementById('userBtn');
      if(user&&currentUser)user.title=currentUser;
    };
    window.syncAuthUI();
  }
})();
