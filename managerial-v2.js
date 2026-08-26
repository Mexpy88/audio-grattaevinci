/* Managerial UX V2 for REMOTO.
   MOVIMENTA -> CARICA / SCARICA / SPOSTA
   GIACENZE -> CERCA / RETTIFICA-VERIFICA
   Physical count is a mode of RETTIFICA-VERIFICA, not a separate inventory function.
*/
(function installWarehouseManagerialV2(){
  'use strict';
  if(window.WarehouseManagerialV2)return;

  const VERSION='2026.08.26-managerial-v2.1';
  const VALID_STATES=['NUOVO','SCARICATO','USATO'];
  let installed=false;
  let moveDraft=[];
  let countDraft=[];
  let countContext={loc:'',pallet:''};
  let baseRenderRegistry=null;

  const $id=id=>typeof document!=='undefined'?document.getElementById(id):null;
  const txt=v=>String(v??'');
  const norm=v=>txt(v).trim().toUpperCase();
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const article=v=>{try{return typeof normalizeArticle==='function'?normalizeArticle(v,true):norm(v)}catch{return norm(v)}};
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const palletOf=r=>norm(r?.bancale||'');
  const hasPos=(loc,pallet)=>!!(norm(loc)||norm(pallet));
  const posText=(loc,pallet)=>{const l=norm(loc),p=norm(pallet);if(l&&p)return `Fila/Scaffale ${l} · Bancale/Carrello ${p}`;if(l)return `Fila/Scaffale ${l}`;if(p)return `Bancale/Carrello ${p}`;return 'Posizione non indicata'};
  const stockRows=()=>{try{return typeof stockBuckets==='function'?stockBuckets():[]}catch{return []}};
  const rowKey=r=>[article(r?.article_base),norm(r?.size),norm(r?.state||'NON_CHIARO'),locOf(r),palletOf(r)].join('|');
  const matchPos=(r,loc,pallet)=>{const l=norm(loc),p=norm(pallet);return hasPos(l,p)&&(!l||locOf(r)===l)&&(!p||palletOf(r)===p)};
  const rowsAt=(loc,pallet)=>stockRows().filter(r=>matchPos(r,loc,pallet));
  const actor=()=>typeof operatorName==='function'?operatorName():(typeof currentUser!=='undefined'?currentUser:'');
  const uidSafe=()=>typeof uid==='function'?uid():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const nowIso=()=>new Date().toISOString();
  const html=v=>typeof esc==='function'?esc(v):txt(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const rects=()=>{if(!Array.isArray(db.rectifications))db.rectifications=[];return db.rectifications};
  const transfers=()=>{if(!Array.isArray(db.stock_transfers))db.stock_transfers=[];return db.stock_transfers};
  const verifications=()=>{if(!Array.isArray(db.stock_verifications))db.stock_verifications=[];return db.stock_verifications};

  function requireOperational(){
    if(typeof requireLogin==='function'&&!requireLogin())return false;
    if(window.LocalMaster?.requireMaster&&!window.LocalMaster.requireMaster())return false;
    return true;
  }
  function toast(msg,type='success'){if(typeof warehouseToast==='function')warehouseToast(msg,type);else console.log('[MANAGERIAL V2]',msg)}
  function setStatusSafe(id,text,type='good'){
    if(typeof setStatus==='function')return setStatus(id,text,type);
    const el=$id(id);if(!el)return;el.className=`status ${type}`;el.textContent=text;el.classList.remove('hidden');
  }

  function injectCss(){
    if($id('managerialV2Css'))return;
    const s=document.createElement('style');s.id='managerialV2Css';
    s.textContent=`
      #home .homeGrid>.managerialLegacyNav{display:none!important}
      .mgrHomeBtn{border:0;border-radius:24px;min-height:140px;color:#fff;text-align:left;padding:18px;display:flex;flex-direction:column;justify-content:flex-end;box-shadow:0 10px 24px #193b5e1a}
      .mgrHomeBtn .icon{font-size:34px;margin-bottom:auto}.mgrHomeBtn b{font-size:19px}.mgrHomeBtn small{font-size:12px;margin-top:4px;opacity:.92}
      .mgrHomeBtn.move{background:linear-gradient(135deg,#126c57,#33a982)}.mgrHomeBtn.stock{background:linear-gradient(135deg,#2860aa,#6baed6)}.mgrHomeBtn.requests{background:linear-gradient(135deg,#204f93,#00a45b)}.mgrHomeBtn.registry{background:linear-gradient(135deg,#445e78,#6f8499)}
      .mgrActionGrid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.mgrAction{border:1px solid #d9e5ee;background:#fff;border-radius:22px;min-height:132px;padding:17px;text-align:left;color:#17314d;box-shadow:0 8px 24px #15395810;display:flex;flex-direction:column}.mgrAction .icon{font-size:30px;margin-bottom:auto}.mgrAction b{font-size:18px}.mgrAction small{color:#65788c;margin-top:5px;line-height:1.3}.mgrAction.full{grid-column:1/-1}
      .mgrPosGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.mgrRows{margin-top:12px}.mgrRow{background:#fff;border:1px solid #dbe5ee;border-radius:18px;padding:13px;margin:9px 0}.mgrRow.selected{border-color:#2c60aa;box-shadow:0 0 0 2px #2c60aa18}.mgrRowHead{display:flex;align-items:flex-start;gap:10px}.mgrRowHead input[type=checkbox]{width:24px;height:24px;margin-top:2px}.mgrRowHead>div{flex:1}.mgrSku{font-size:17px;font-weight:950}.mgrMeta{font-size:12px;color:#65788c;margin-top:4px;line-height:1.35}.mgrQtyGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.mgrExpected{background:#eef4f8;border-radius:13px;padding:10px;text-align:center}.mgrExpected b{display:block;font-size:21px}.mgrExpected span{font-size:11px;color:#65788c}.mgrToolbar{display:flex;gap:8px;flex-wrap:wrap;margin:9px 0}.mgrToolbar .mini{flex:1}.mgrWarn{font-size:13px;line-height:1.45}.mgrDelta{font-size:14px;font-weight:950;margin-top:8px}.mgrDelta.neg{color:#b23b35}.mgrDelta.pos{color:#08784a}.mgrDelta.zero{color:#65788c}.mgrFound{border-style:dashed}.mgrModeHint{margin-top:8px}.mgrSemanticBadge{font-weight:950!important}.mgrSemanticBadge.move{background:#e2f2ec!important;color:#176249!important}.mgrSemanticBadge.verify{background:#e5edf8!important;color:#285a93!important}
      #stockEditScreen .mgrRectificationHint{margin:10px 0 0}
      @media(max-width:430px){.mgrHomeBtn{min-height:122px;border-radius:20px;padding:15px}.mgrHomeBtn .icon{font-size:29px}.mgrHomeBtn b{font-size:17px}.mgrAction{min-height:116px;padding:14px}.mgrPosGrid,.mgrQtyGrid{grid-template-columns:1fr 1fr}}
      @media(max-width:360px){.mgrActionGrid,.mgrPosGrid,.mgrQtyGrid{grid-template-columns:1fr}.mgrAction.full{grid-column:auto}}
    `;
    document.head.appendChild(s);
  }

  function ensureHome(){
    const grid=document.querySelector('#home .homeGrid');if(!grid)return false;
    [...grid.querySelectorAll('.homeBtn')].forEach(b=>b.classList.add('managerialLegacyNav'));
    if($id('mgrHomeMove'))return true;
    const defs=[
      ['mgrHomeMove','mgrHomeBtn move','↔','MOVIMENTA','Carica, scarica e sposta','openMgrHub("move")'],
      ['mgrHomeStock','mgrHomeBtn stock','⌕','GIACENZE','Cerca, rettifica e verifica','openMgrHub("stock")'],
      ['mgrHomeRequests','mgrHomeBtn requests','✓','RICHIESTE','Prelievi e avanzamento','openRequests()'],
      ['mgrHomeRegistry','mgrHomeBtn registry','≡','REGISTRO','Movimenti e storico','openRegistry()']
    ];
    for(const [id,cls,icon,label,sub,onclick] of defs){
      const b=document.createElement('button');b.id=id;b.className=cls;b.setAttribute('onclick',onclick);
      b.innerHTML=`<span class="icon">${icon}</span><b>${label}</b><small>${sub}</small>`;grid.appendChild(b);
    }
    return true;
  }

  function ensureHubs(){
    const main=document.querySelector('main');if(!main)return false;
    if(!$id('mgrMoveHub')){
      const s=document.createElement('section');s.id='mgrMoveHub';s.className='screen';
      s.innerHTML=`<button class="back" onclick="show('home')">← HOME</button><div class="eyebrow">OPERAZIONI</div><h1>Movimenta</h1><div class="mgrActionGrid"><button class="mgrAction" onclick="openOperation('CARICA')"><span class="icon">＋</span><b>CARICA</b><small>Entrata merce nella giacenza.</small></button><button class="mgrAction" onclick="openOperation('SCARICA')"><span class="icon">−</span><b>SCARICA</b><small>Uscita merce verso una destinazione.</small></button><button class="mgrAction full" onclick="openStockMoveV2()"><span class="icon">↔</span><b>SPOSTA</b><small>Trasferisce merce tra posizioni senza creare un falso carico o scarico.</small></button></div>`;
      main.appendChild(s);
    }
    if(!$id('mgrStockHub')){
      const s=document.createElement('section');s.id='mgrStockHub';s.className='screen';
      s.innerHTML=`<button class="back" onclick="show('home')">← HOME</button><div class="eyebrow">CONTROLLO GIACENZE</div><h1>Giacenze</h1><div class="mgrActionGrid"><button class="mgrAction" onclick="openSearch()"><span class="icon">⌕</span><b>CERCA</b><small>Consulta articolo, taglia, stato e posizione.</small></button><button class="mgrAction" onclick="openStockControlV2()"><span class="icon">✎</span><b>RETTIFICA / VERIFICA</b><small>Correggi un dato oppure esegui un conteggio fisico controllato.</small></button></div>`;
      main.appendChild(s);
    }
    if(!$id('mgrStockControlHub')){
      const s=document.createElement('section');s.id='mgrStockControlHub';s.className='screen';
      s.innerHTML=`<button class="back" onclick="show('mgrStockHub')">← GIACENZE</button><div class="eyebrow">CONTROLLO GIACENZA</div><h1>Rettifica / Verifica</h1><div class="status warn mgrModeHint"><b>Scegli il motivo dell'intervento.</b><br>Usa RETTIFICA quando sai già quale dato è errato. Usa CONTEGGIO FISICO quando vuoi confrontare ciò che il sistema si aspetta con ciò che trovi realmente.</div><div class="mgrActionGrid"><button class="mgrAction" onclick="openDirectRectificationV2()"><span class="icon">✎</span><b>RETTIFICA DIRETTA</b><small>Correggi quantità, stato, articolo, taglia o posizione errata.</small></button><button class="mgrAction" onclick="openPhysicalCountV2()"><span class="icon">☷</span><b>CONTEGGIO FISICO</b><small>Atteso, contato e differenza. Puoi aggiungere materiale trovato ma non previsto.</small></button></div>`;
      main.appendChild(s);
    }
    return true;
  }

  window.openMgrHub=function(kind){if(!requireOperational())return;show(kind==='move'?'mgrMoveHub':'mgrStockHub')};
  window.openStockControlV2=function(){if(!requireOperational())return;show('mgrStockControlHub')};
  window.openDirectRectificationV2=function(){if(!requireOperational())return;openStockEdit();setTimeout(decorateRectificationScreen,0)};

  function decorateRectificationScreen(){
    const screen=$id('stockEditScreen');if(!screen)return false;
    const eyebrow=screen.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='RETTIFICA GIACENZA';
    const h=screen.querySelector('h1');if(h)h.textContent='Rettifica diretta';
    const searchBtn=screen.querySelector('button.btn.primary');if(searchBtn&&/CERCA/i.test(searchBtn.textContent))searchBtn.textContent='CERCA POSIZIONE';
    if(!$id('mgrRectificationHint')){
      const n=document.createElement('div');n.id='mgrRectificationHint';n.className='status warn mgrRectificationHint';
      n.innerHTML='<b>RETTIFICA = correzione di un dato errato.</b><br>Se stai trasferendo fisicamente merce da una posizione a un’altra, usa SPOSTA per mantenere lo storico corretto.';
      const editor=$id('stockEditEditor');(editor||screen).insertAdjacentElement(editor?'beforebegin':'beforeend',n);
    }
    const back=screen.querySelector('.back');if(back){back.textContent='← RETTIFICA / VERIFICA';back.onclick=()=>show('mgrStockControlHub')}
    return true;
  }

  function ensureMoveScreen(){
    if($id('mgrMoveScreen'))return true;const main=document.querySelector('main');if(!main)return false;
    const s=document.createElement('section');s.id='mgrMoveScreen';s.className='screen';
    s.innerHTML=`<button class="back" onclick="show('mgrMoveHub')">← MOVIMENTA</button><div class="eyebrow">TRASFERIMENTO INTERNO</div><h1>Sposta merce</h1><div class="card"><div class="sectionTitle">1. Posizione di origine</div><div class="mgrPosGrid"><label>Fila/Scaffale<input id="mgrMoveSrcLoc" class="field" placeholder="Facoltativo"></label><label>Bancale/Carrello<input id="mgrMoveSrcPal" class="field" placeholder="Facoltativo"></label></div><button class="btn primary" onclick="loadStockMoveSourceV2()">CERCA ORIGINE</button><div id="mgrMoveStatus" class="status hidden"></div></div><div id="mgrMoveBody" class="hidden"><div class="mgrToolbar"><button class="mini" onclick="selectAllMoveV2(true)">SELEZIONA TUTTO</button><button class="mini" onclick="selectAllMoveV2(false)">AZZERA</button></div><div id="mgrMoveRows" class="mgrRows"></div><div class="card"><div class="sectionTitle">2. Nuova posizione</div><div class="mgrPosGrid"><label>Fila/Scaffale<input id="mgrMoveDstLoc" class="field" placeholder="Facoltativo"></label><label>Bancale/Carrello<input id="mgrMoveDstPal" class="field" placeholder="Facoltativo"></label></div><div class="status warn mgrWarn"><b>SPOSTA modifica soltanto l'ubicazione.</b><br>Articolo, taglia, stato e quantità totale restano invariati.</div><button class="btn success" onclick="confirmStockMoveV2()">CONFERMA SPOSTAMENTO</button></div></div>`;
    main.appendChild(s);return true;
  }

  function moveRowHtml(r,i){
    return `<div class="mgrRow ${r.selected?'selected':''}"><div class="mgrRowHead"><input type="checkbox" ${r.selected?'checked':''} onchange="updateMoveV2(${i},'selected',this.checked)"><div><div class="mgrSku">${html(r.article_base)}${r.size?` · ${html(r.size)}`:''}</div><div class="mgrMeta">${html(r.state)} · ${html(posText(r.fila_scaffale,r.bancale))}</div></div></div><div class="mgrQtyGrid"><div class="mgrExpected"><b>${Number(r.available)||0}</b><span>PEZZI DISPONIBILI</span></div><label>Da spostare<input class="field" type="number" min="0" max="${Number(r.available)||0}" value="${Number(r.quantity)||0}" oninput="updateMoveV2(${i},'quantity',this.value)"></label></div></div>`;
  }
  function renderMove(){const h=$id('mgrMoveRows');if(h)h.innerHTML=moveDraft.map(moveRowHtml).join('')}

  window.openStockMoveV2=function(){
    if(!requireOperational())return;ensureMoveScreen();moveDraft=[];
    ['mgrMoveSrcLoc','mgrMoveSrcPal','mgrMoveDstLoc','mgrMoveDstPal'].forEach(id=>{if($id(id))$id(id).value=''});
    $id('mgrMoveStatus')?.classList.add('hidden');$id('mgrMoveBody')?.classList.add('hidden');show('mgrMoveScreen');
  };
  window.loadStockMoveSourceV2=function(){
    if(!requireOperational())return;
    const loc=norm($id('mgrMoveSrcLoc')?.value),pal=norm($id('mgrMoveSrcPal')?.value);
    if(!hasPos(loc,pal))return alert('Inserisci Fila/Scaffale oppure Bancale/Carrello di origine.');
    const rows=rowsAt(loc,pal);
    if(!rows.length){moveDraft=[];$id('mgrMoveBody')?.classList.add('hidden');setStatusSafe('mgrMoveStatus',`Nessuna giacenza trovata · ${posText(loc,pal)}.`,'error');return}
    moveDraft=rows.map(r=>({article_base:article(r.article_base),size:norm(r.size),state:norm(r.state),fila_scaffale:locOf(r),bancale:palletOf(r),available:Number(r.quantity)||0,quantity:0,selected:false,key:rowKey(r)}));
    setStatusSafe('mgrMoveStatus',`${rows.length} righe trovate · ${posText(loc,pal)}.`,'good');$id('mgrMoveBody')?.classList.remove('hidden');renderMove();
  };
  window.updateMoveV2=function(i,key,value){
    const r=moveDraft[i];if(!r)return;
    if(key==='selected')r.selected=!!value;
    else r.quantity=Math.max(0,Math.min(Number(r.available)||0,Math.floor(Number(value)||0)));
    if(r.quantity>0)r.selected=true;
    renderMove();
  };
  window.selectAllMoveV2=function(v){for(const r of moveDraft){r.selected=!!v;r.quantity=v?Number(r.available)||0:0}renderMove()};

  function stockMap(){return new Map(stockRows().map(r=>[rowKey(r),Number(r.quantity)||0]))}
  function rectRecord({batch,semantic,before,after,note,at}){
    return {id:uidSafe(),batch_id:batch,type:'RETTIFICA',semantic_type:semantic,operator:actor(),registered_at:at,operation_at:at,updated_at:at,cancelled_at:null,before:before?clone(before):null,after:after?clone(after):null,note};
  }
  function normalizeStock(r,quantity){
    const l=locOf(r),p=palletOf(r);
    return {article_base:article(r.article_base),size:norm(r.size),quantity:Math.max(0,Number(quantity??r.quantity)||0),state:norm(r.state),fila_scaffale:l,fila:l,scaffale:'',bancale:p};
  }

  window.confirmStockMoveV2=function(){
    if(!requireOperational())return;
    const selected=moveDraft.filter(r=>r.selected&&Number(r.quantity)>0);
    if(!selected.length)return alert('Seleziona almeno una riga e indica la quantità da spostare.');
    const dl=norm($id('mgrMoveDstLoc')?.value),dp=norm($id('mgrMoveDstPal')?.value);
    if(!hasPos(dl,dp))return alert('Inserisci Fila/Scaffale oppure Bancale/Carrello di destinazione.');
    const current=stockMap();
    for(const r of selected){
      const available=Number(current.get(r.key)||0),q=Math.floor(Number(r.quantity)||0);
      if(q<=0||q>available)return alert(`${r.article_base} ${r.size||''}: giacenza cambiata. Disponibili ${available}, da spostare ${q}. Ricarica l'origine.`);
      if(locOf(r)===dl&&palletOf(r)===dp)return alert(`${r.article_base} ${r.size||''}: origine e destinazione coincidono.`);
    }
    const total=selected.reduce((a,r)=>a+Number(r.quantity||0),0);
    if(!confirm(`Confermi lo spostamento di ${total} pezzi su ${selected.length} righe verso ${posText(dl,dp)}?\n\nLa quantità totale del magazzino non cambierà.`))return;
    const batch=uidSafe(),transferId=`SP-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}-${batch.slice(-4)}`,at=nowIso(),lines=[];
    for(const r of selected){
      const q=Math.floor(Number(r.quantity)||0),available=Number(current.get(r.key)||0),source=normalizeStock(r,available),remaining=available-q;
      const srcAfter=remaining>0?normalizeStock(r,remaining):null;
      const dest={article_base:article(r.article_base),size:norm(r.size),quantity:q,state:norm(r.state),fila_scaffale:dl,fila:dl,scaffale:'',bancale:dp};
      const note=`[SPOSTA] ${transferId} · ${q} pezzi · ${posText(source.fila_scaffale,source.bancale)} → ${posText(dl,dp)}`;
      const dec=rectRecord({batch,semantic:'SPOSTA',before:source,after:srcAfter,note,at});
      const inc=rectRecord({batch,semantic:'SPOSTA',before:null,after:dest,note,at});
      rects().unshift(inc,dec);
      if(typeof audit==='function'){audit('CREATE','RECTIFICATION',dec.id,null,clone(dec));audit('CREATE','RECTIFICATION',inc.id,null,clone(inc))}
      lines.push({article_base:dest.article_base,size:dest.size,state:dest.state,quantity:q,from:{fila_scaffale:source.fila_scaffale,bancale:source.bancale},to:{fila_scaffale:dl,bancale:dp},rectification_ids:[dec.id,inc.id]});
    }
    const rec={id:transferId,type:'SPOSTA',operator:actor(),created_at:at,from_filter:{fila_scaffale:norm($id('mgrMoveSrcLoc')?.value),bancale:norm($id('mgrMoveSrcPal')?.value)},to:{fila_scaffale:dl,bancale:dp},total_pieces:total,lines};
    transfers().unshift(rec);if(typeof audit==='function')audit('CREATE','STOCK_TRANSFER',transferId,null,clone(rec));saveDb();
    window.renderStock?.();window.renderRegistry?.();window.LocalMaster?.renderPanel?.();toast(`Spostamento ${transferId} registrato: ${total} pezzi.`,'success');show('mgrMoveHub');
  };

  function ensureCountScreen(){
    if($id('mgrCountScreen'))return true;const main=document.querySelector('main');if(!main)return false;
    const s=document.createElement('section');s.id='mgrCountScreen';s.className='screen';
    s.innerHTML=`<button class="back" onclick="show('mgrStockControlHub')">← RETTIFICA / VERIFICA</button><div class="eyebrow">CONTEGGIO FISICO</div><h1>Verifica giacenza</h1><div class="card"><div class="sectionTitle">Posizione da verificare</div><div class="mgrPosGrid"><label>Fila/Scaffale<input id="mgrCountLoc" class="field" placeholder="Facoltativo"></label><label>Bancale/Carrello<input id="mgrCountPal" class="field" placeholder="Facoltativo"></label></div><button class="btn primary" onclick="loadPhysicalCountV2()">CARICA GIACENZA ATTESA</button><div id="mgrCountStatus" class="status hidden"></div></div><div id="mgrCountBody" class="hidden"><div class="status warn mgrWarn"><b>Inserisci ciò che trovi realmente.</b><br>I campi CONTATO non vengono precompilati: questo evita di confermare per errore quantità non verificate.</div><div id="mgrCountRows" class="mgrRows"></div><button class="btn soft" onclick="addUnexpectedCountRowV2()">＋ AGGIUNGI ARTICOLO / TAGLIA TROVATO</button><button class="btn success" onclick="confirmPhysicalCountV2()">CONFERMA VERIFICA</button></div>`;
    main.appendChild(s);return true;
  }

  function unexpectedWarnings(r){
    if(!r.extra||!r.article_base)return '';
    const a=article(r.article_base),s=norm(r.size),st=norm(r.state);
    const matches=stockRows().filter(x=>article(x.article_base)===a&&norm(x.size)===s&&(!st||norm(x.state)===st)&&Number(x.quantity)>0);
    if(matches.length){const total=matches.reduce((n,x)=>n+Number(x.quantity||0),0);return `<div class="status warn mgrWarn">⚠ Questa combinazione risulta già presente in ${matches.length} giacenze, ${total} pezzi totali. Se è la stessa merce ubicata male, annulla e usa <b>SPOSTA</b>.</div>`}
    const articleKnown=stockRows().some(x=>article(x.article_base)===a);
    return articleKnown?'<div class="status warn mgrWarn">Taglia/stato non presenti nelle giacenze attive per questo articolo. Verifica prima di confermare.</div>':'<div class="status error mgrWarn">⚠ Articolo non presente nelle giacenze attive del Master. Controlla attentamente il codice.</div>';
  }

  function deltaHtml(expected,counted){
    if(counted===null||counted===undefined||counted==='')return '<div class="mgrDelta zero">DIFFERENZA: —</div>';
    const d=Math.floor(Number(counted)||0)-Math.floor(Number(expected)||0),cls=d>0?'pos':d<0?'neg':'zero',sign=d>0?'+':'';
    return `<div class="mgrDelta ${cls}">DIFFERENZA: ${sign}${d}</div>`;
  }
  function countRowHtml(r,i){
    if(r.extra){
      return `<div class="mgrRow mgrFound"><div class="actions"><b>TROVATO NON PREVISTO</b><button class="mini danger" onclick="removeCountRowV2(${i})">RIMUOVI</button></div><label>Articolo<input class="field" value="${html(r.article_base)}" oninput="updateCountRowV2(${i},'article_base',this.value)"></label><div class="twoCols"><label>Taglia<input class="field" value="${html(r.size)}" oninput="updateCountRowV2(${i},'size',this.value)"></label><label>Stato<select class="field" onchange="updateCountRowV2(${i},'state',this.value)">${VALID_STATES.map(s=>`<option ${s===r.state?'selected':''}>${s}</option>`).join('')}</select></label></div><div class="mgrQtyGrid"><div class="mgrExpected"><b>0</b><span>ATTESO</span></div><label>Contato<input class="field" type="number" min="0" value="${r.counted??''}" oninput="updateCountRowV2(${i},'counted',this.value)"></label></div>${unexpectedWarnings(r)}${deltaHtml(0,r.counted)}</div>`;
    }
    return `<div class="mgrRow"><div class="mgrSku">${html(r.article_base)}${r.size?` · ${html(r.size)}`:''}</div><div class="mgrMeta">${html(r.state)} · ${html(posText(r.fila_scaffale,r.bancale))}</div><div class="mgrQtyGrid"><div class="mgrExpected"><b>${r.expected}</b><span>ATTESO</span></div><label>Contato<input class="field" type="number" min="0" value="${r.counted??''}" placeholder="Da contare" oninput="updateCountRowV2(${i},'counted',this.value)"></label></div>${deltaHtml(r.expected,r.counted)}</div>`;
  }
  function renderCount(){const h=$id('mgrCountRows');if(h)h.innerHTML=countDraft.map(countRowHtml).join('')}

  window.openPhysicalCountV2=function(){
    if(!requireOperational())return;ensureCountScreen();countDraft=[];countContext={loc:'',pallet:''};
    ['mgrCountLoc','mgrCountPal'].forEach(id=>{if($id(id))$id(id).value=''});
    $id('mgrCountStatus')?.classList.add('hidden');$id('mgrCountBody')?.classList.add('hidden');show('mgrCountScreen');
  };
  window.loadPhysicalCountV2=function(){
    if(!requireOperational())return;
    const loc=norm($id('mgrCountLoc')?.value),pal=norm($id('mgrCountPal')?.value);
    if(!hasPos(loc,pal))return alert('Inserisci Fila/Scaffale oppure Bancale/Carrello da verificare.');
    countContext={loc,pallet:pal};const rows=rowsAt(loc,pal);
    countDraft=rows.map(r=>({extra:false,article_base:article(r.article_base),size:norm(r.size),state:norm(r.state),fila_scaffale:locOf(r),bancale:palletOf(r),expected:Math.floor(Number(r.quantity)||0),counted:null,key:rowKey(r)}));
    setStatusSafe('mgrCountStatus',rows.length?`${rows.length} righe attese · ${posText(loc,pal)}.`:`Nessuna giacenza attesa · ${posText(loc,pal)}. Puoi comunque registrare materiale trovato.`,rows.length?'good':'warn');
    $id('mgrCountBody')?.classList.remove('hidden');renderCount();
  };
  window.addUnexpectedCountRowV2=function(){
    if(!hasPos(countContext.loc,countContext.pallet))return alert('Carica prima una posizione da verificare.');
    countDraft.push({extra:true,article_base:'',size:'',state:'NUOVO',fila_scaffale:countContext.loc,bancale:countContext.pallet,expected:0,counted:null,key:''});renderCount();
    setTimeout(()=>{const rows=document.querySelectorAll('#mgrCountRows .mgrRow');rows[rows.length-1]?.scrollIntoView?.({behavior:'smooth',block:'center'})},30);
  };
  window.removeCountRowV2=function(i){if(countDraft[i]?.extra){countDraft.splice(i,1);renderCount()}};
  window.updateCountRowV2=function(i,key,value){
    const r=countDraft[i];if(!r)return;
    if(key==='article_base')r[key]=article(value);
    else if(key==='size')r[key]=norm(value);
    else if(key==='state')r[key]=norm(value);
    else if(key==='counted')r[key]=value===''?null:Math.max(0,Math.floor(Number(value)||0));
    renderCount();
  };

  function knownElsewhere(r){
    const a=article(r.article_base),s=norm(r.size),st=norm(r.state);
    return stockRows().filter(x=>article(x.article_base)===a&&norm(x.size)===s&&norm(x.state)===st&&Number(x.quantity)>0&&!matchPos(x,countContext.loc,countContext.pallet));
  }

  window.confirmPhysicalCountV2=function(){
    if(!requireOperational())return;
    const expectedRows=countDraft.filter(r=>!r.extra);
    const missing=expectedRows.filter(r=>r.counted===null||r.counted===undefined||r.counted==='');
    if(missing.length)return alert(`Completa il conteggio di tutte le righe attese. Mancano ${missing.length} valori CONTATO.`);
    const extras=countDraft.filter(r=>r.extra&&(Number(r.counted)||0)>0);
    for(const r of extras){
      if(!article(r.article_base))return alert('Completa il codice articolo nelle righe TROVATO NON PREVISTO.');
      if(!VALID_STATES.includes(norm(r.state)))return alert('Scegli uno stato valido per tutti gli articoli trovati.');
    }
    const possibleMoves=extras.filter(r=>knownElsewhere(r).length>0);
    if(possibleMoves.length){
      const names=possibleMoves.slice(0,5).map(r=>`${r.article_base}${r.size?' '+r.size:''}`).join(', ');
      if(!confirm(`ATTENZIONE: ${possibleMoves.length} righe trovate non previste risultano già presenti in altre posizioni (${names}${possibleMoves.length>5?'…':''}).\n\nConfermando, saranno considerate QUANTITÀ AGGIUNTIVE.\nSe invece è la stessa merce ubicata nella posizione sbagliata, premi ANNULLA e usa SPOSTA.\n\nVuoi confermare comunque come quantità aggiuntive?`))return;
    }
    const current=stockMap();
    for(const r of expectedRows){
      const now=Number(current.get(r.key)||0);
      if(now!==Number(r.expected))return alert(`${r.article_base} ${r.size||''}: la giacenza è cambiata durante il conteggio (${r.expected} → ${now}). Ricarica la posizione e ripeti la verifica.`);
    }
    const changes=[],lines=[];
    for(const r of countDraft){
      const counted=Math.max(0,Math.floor(Number(r.counted)||0));
      const expected=Math.max(0,Math.floor(Number(r.expected)||0));
      const delta=counted-expected;
      if(r.extra&&counted<=0)continue;
      lines.push({article_base:article(r.article_base),size:norm(r.size),state:norm(r.state),expected,counted,difference:delta,extra:!!r.extra});
      if(delta===0)continue;
      if(r.extra){
        const after={article_base:article(r.article_base),size:norm(r.size),quantity:counted,state:norm(r.state),fila_scaffale:countContext.loc,fila:countContext.loc,scaffale:'',bancale:countContext.pallet};
        changes.push({before:null,after,expected:0,counted,difference:delta});
      }else{
        const before={article_base:article(r.article_base),size:norm(r.size),quantity:expected,state:norm(r.state),fila_scaffale:r.fila_scaffale,fila:r.fila_scaffale,scaffale:'',bancale:r.bancale};
        const after=counted>0?{...before,quantity:counted}:null;
        changes.push({before,after,expected,counted,difference:delta});
      }
    }
    const plus=lines.filter(x=>x.difference>0).reduce((n,x)=>n+x.difference,0);
    const minus=Math.abs(lines.filter(x=>x.difference<0).reduce((n,x)=>n+x.difference,0));
    if(!confirm(`Confermi la verifica di ${posText(countContext.loc,countContext.pallet)}?\n\nRighe controllate: ${lines.length}\nRighe con differenze: ${changes.length}\nDifferenze positive: +${plus}\nDifferenze negative: -${minus}\n\nLe differenze verranno registrate come VERIFICA FISICA, non come CARICA/SCARICA.`))return;
    const batch=uidSafe(),verificationId=`VF-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}-${batch.slice(-4)}`,at=nowIso(),rectIds=[];
    for(const c of changes){
      const note=`[VERIFICA] ${verificationId} · Atteso ${c.expected} · Contato ${c.counted} · Differenza ${c.difference>0?'+':''}${c.difference} · ${posText(countContext.loc,countContext.pallet)}`;
      const rec=rectRecord({batch,semantic:'VERIFICA_FISICA',before:c.before,after:c.after,note,at});rects().unshift(rec);rectIds.push(rec.id);
      if(typeof audit==='function')audit('CREATE','RECTIFICATION',rec.id,null,clone(rec));
    }
    const session={id:verificationId,type:'VERIFICA_FISICA',operator:actor(),created_at:at,position:{fila_scaffale:countContext.loc,bancale:countContext.pallet},lines,changed_lines:changes.length,positive_difference:plus,negative_difference:minus,rectification_ids:rectIds};
    verifications().unshift(session);if(typeof audit==='function')audit('CREATE','STOCK_VERIFICATION',verificationId,null,clone(session));saveDb();
    window.renderStock?.();window.renderRegistry?.();window.LocalMaster?.renderPanel?.();toast(`Verifica ${verificationId} completata: ${changes.length} differenze registrate.`,'success');show('mgrStockControlHub');
  };

  function ensureRegistrySemantics(){
    const sel=$id('uxRegType');if(!sel)return;
    const values=[...sel.options].map(o=>o.value||o.textContent);
    if(!values.includes('SPOSTA')){const o=document.createElement('option');o.value='SPOSTA';o.textContent='SPOSTA';sel.appendChild(o)}
    if(!values.includes('VERIFICA')){const o=document.createElement('option');o.value='VERIFICA';o.textContent='VERIFICA FISICA';sel.appendChild(o)}
  }
  function decorateRegistryCards(){
    ensureRegistrySemantics();const list=$id('registryList');if(!list)return;
    const typ=norm($id('uxRegType')?.value);let visible=0;
    for(const card of list.querySelectorAll('.movementCard')){
      const text=card.textContent||'',isMove=/\[SPOSTA\]/.test(text),isVerify=/\[VERIFICA\]/.test(text),isSemantic=isMove||isVerify;
      card.classList.remove('managerialFiltered');
      if(typ==='SPOSTA'&&!isMove)card.classList.add('managerialFiltered');
      else if(typ==='VERIFICA'&&!isVerify)card.classList.add('managerialFiltered');
      else if(typ==='RETTIFICA'&&isSemantic)card.classList.add('managerialFiltered');
      if(!card.classList.contains('managerialFiltered'))visible++;
      const badges=[...card.querySelectorAll('.meta span')],rectBadge=badges.find(x=>norm(x.textContent)==='RETTIFICA');
      if(rectBadge&&isMove){rectBadge.textContent='SPOSTA';rectBadge.classList.add('mgrSemanticBadge','move')}
      if(rectBadge&&isVerify){rectBadge.textContent='VERIFICA FISICA';rectBadge.classList.add('mgrSemanticBadge','verify')}
    }
    const count=$id('uxRegCount');if(count&&(typ==='SPOSTA'||typ==='VERIFICA'||typ==='RETTIFICA'))count.textContent=`${visible} registrazioni visualizzate`;
  }
  function wrapRegistry(){
    if(typeof window.renderRegistry!=='function'||window.renderRegistry.__managerialV2)return;
    baseRenderRegistry=window.renderRegistry;
    const f=function(){
      const sel=$id('uxRegType'),requested=norm(sel?.value);
      if(sel&&(requested==='SPOSTA'||requested==='VERIFICA'))sel.value='RETTIFICA';
      const out=baseRenderRegistry.apply(this,arguments);
      if(sel&&(requested==='SPOSTA'||requested==='VERIFICA'))sel.value=requested;
      decorateRegistryCards();return out;
    };
    f.__managerialV2=true;f.__previous=baseRenderRegistry;window.renderRegistry=f;
  }

  function install(){
    if(installed){ensureHome();ensureHubs();ensureMoveScreen();ensureCountScreen();decorateRectificationScreen();ensureRegistrySemantics();return true}
    if(typeof document==='undefined')return false;
    injectCss();ensureHome();ensureHubs();ensureMoveScreen();ensureCountScreen();decorateRectificationScreen();wrapRegistry();ensureRegistrySemantics();installed=true;return true;
  }

  window.WarehouseManagerialV2={version:VERSION,install,rowsAt,posText,rowKey};
  if(typeof document!=='undefined')install();
})();
