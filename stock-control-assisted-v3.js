/* Stock Control Assisted V3 — grouped article UX + progressive partial counts.
   Loaded after managerial-v2.js and flex-position-v2.js.
   Keeps the existing stock/rectification model and Excel export contract unchanged. */
(function installStockControlAssistedV3(){
  'use strict';
  if(window.WarehouseStockControlAssistedV3)return;

  const VERSION='2026.08.26-stock-control-assisted3';
  const $=id=>document.getElementById(id);
  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const art=v=>{try{return typeof normalizeArticle==='function'?normalizeArticle(v,true):norm(v)}catch{return norm(v)}};
  const html=v=>typeof esc==='function'?esc(v):text(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const uidSafe=()=>typeof uid==='function'?uid():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const actor=()=>typeof operatorName==='function'?operatorName():'';
  const nowIso=()=>new Date().toISOString();
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const palOf=r=>norm(r?.bancale||'');
  const hasPos=(l,p)=>!!(norm(l)||norm(p));
  const posText=(l,p)=>window.WarehouseManagerialV2?.posText?.(l,p)||(norm(l)&&norm(p)?`Fila/Scaffale ${norm(l)} · Bancale/Carrello ${norm(p)}`:norm(l)?`Fila/Scaffale ${norm(l)}`:norm(p)?`Bancale/Carrello ${norm(p)}`:'Posizione non indicata');
  const stockRows=()=>{try{return typeof stockBuckets==='function'?stockBuckets():[]}catch{return []}};
  const rowKey=r=>window.WarehouseManagerialV2?.rowKey?.(r)||[art(r?.article_base),norm(r?.size),norm(r?.state||'NON_CHIARO'),locOf(r),palOf(r)].join('|');
  const states=()=>{const base=Array.isArray(window.STATES)?window.STATES:(typeof STATES!=='undefined'?STATES:['NUOVO','SCARICATO','USATO','DISMESSO']);return [...new Set(base.map(norm).filter(s=>s&&s!=='NON_CHIARO'))]};
  const toast=(m,t='success')=>{try{if(typeof warehouseToast==='function')warehouseToast(m,t)}catch{}};

  let assistDraft=[];
  let assistContext={loc:'',pallet:''};
  let quickMode='count';

  function injectCss(){
    if($('stockControlAssistedV3Css'))return;
    const s=document.createElement('style');s.id='stockControlAssistedV3Css';s.textContent=`
      .scaArticleGroup{border:1px solid #dfd2c1;border-radius:24px;padding:15px;margin:12px 0;box-shadow:0 8px 22px #553a2110}
      .scaArticleGroup.toneA{background:#f1e2d0}.scaArticleGroup.toneB{background:#fbf2df}
      .scaArticleHead{display:flex;align-items:center;gap:10px;justify-content:space-between;margin-bottom:10px}.scaArticleCode{font-size:21px;font-weight:950;color:#17314d;min-width:0;overflow-wrap:anywhere}
      .scaArticleInput{font-size:18px;font-weight:900;background:#ffffffb8}
      .scaVariant{background:#ffffffc9;border:1px solid #e1d7ca;border-radius:18px;padding:12px;margin:9px 0}.scaVariant.deleted{opacity:.55}
      .scaVariantHead{display:flex;justify-content:space-between;gap:8px;align-items:center}.scaVariantTitle{font-size:16px;font-weight:950}.scaVariantMeta{font-size:12px;color:#65788c;margin-top:2px}
      .scaCountMetrics{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin:9px 0}.scaMetric{background:#f7fafc;border:1px solid #dce5ed;border-radius:14px;padding:9px;text-align:center}.scaMetric b{display:block;font-size:21px}.scaMetric span{font-size:10px;color:#65788c;font-weight:850}
      .scaPartialAdd{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-top:8px}.scaPartialAdd .field{min-height:50px}.scaPartialAdd button{min-height:50px;border:0;border-radius:14px;padding:0 15px;background:#2c60aa;color:#fff;font-weight:950}
      .scaPartials{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.scaPartialChip{border:0;border-radius:999px;background:#e6eef5;color:#17314d;padding:7px 10px;font-weight:900}.scaPartialChip small{opacity:.65;margin-left:4px}.scaUnverified{background:#fff0d3;color:#7d5300;border-radius:12px;padding:8px 10px;font-size:12px;font-weight:850;margin-top:8px}
      .scaZeroBtn{border:0;border-radius:12px;padding:9px 11px;background:#eef2f5;color:#40566a;font-weight:900}.scaAddVariant{width:100%;border:1px dashed #b9a891;border-radius:14px;background:#ffffff80;padding:10px;font-weight:900;color:#66513d;margin-top:7px}
      .scaFloatAdd{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));z-index:45;border:0;border-radius:999px;min-height:56px;padding:0 18px;background:#17314d;color:#fff;font-weight:950;font-size:15px;box-shadow:0 12px 30px #17314d40;display:none}
      #mgrCountAssistScreenV3.on .scaFloatAdd,#stockEditScreen.on .scaFloatAdd.scaDirectFloat{display:block}
      .scaQuickDialog{width:min(92vw,470px);border:0;border-radius:24px;padding:18px}.scaQuickDialog::backdrop{background:#0a1c2dbb}.scaQuickHead{display:flex;justify-content:space-between;align-items:center;gap:10px}.scaQuickHead h2{margin:0}.scaQuickHead button{width:40px;height:40px;border:0;border-radius:50%;font-size:22px}.scaQuickActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      #stockEditEditor>.btn.soft{display:none!important}
      @media(max-width:430px){.scaArticleGroup{padding:12px;border-radius:20px}.scaCountMetrics{grid-template-columns:repeat(3,1fr)}.scaMetric b{font-size:18px}.scaFloatAdd{min-height:54px;padding:0 16px}}
    `;document.head.appendChild(s);
  }

  function grouped(rows){
    const map=new Map();
    for(const r of rows){const key=art(r.article_base)||'— SENZA ARTICOLO —';if(!map.has(key))map.set(key,[]);map.get(key).push(r)}
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  }

  /* -------- Direct rectification: visual grouping, same underlying draft/save engine -------- */
  function directVariantHtml(r){
    const disabled=r.deleted?'disabled':'';
    return `<div class="scaVariant stockEditRow ${r.deleted?'deleted':''}"><div class="scaVariantHead"><div><div class="scaVariantTitle">${html(norm(r.size)||'SENZA TAGLIA')} · ${html(norm(r.state)||'NON_CHIARO')}</div><div class="scaVariantMeta">${r.original?'Riga esistente':'Trovato / aggiunto'}</div></div><button class="mini ${r.deleted?'':'danger'}" onclick="toggleStockEditDelete('${r.edit_id}')">${r.deleted?'RIPRISTINA':'ELIMINA'}</button></div><div class="twoCols"><label>Taglia<input class="field" ${disabled} value="${html(r.size)}" oninput="editStockDraft('${r.edit_id}','size',this.value)"></label><label>Quantità<input class="field" ${disabled} type="number" min="0" value="${Number(r.quantity)||0}" oninput="editStockDraft('${r.edit_id}','quantity',this.value)"></label></div><label>Stato<select class="field" ${disabled} onchange="editStockDraft('${r.edit_id}','state',this.value)">${(typeof STATES!=='undefined'?STATES:states()).map(s=>`<option ${norm(s)===norm(r.state)?'selected':''}>${html(s)}</option>`).join('')}</select></label><div class="twoCols"><label>Fila/Scaffale<input class="field" ${disabled} value="${html(r.fila_scaffale)}" oninput="editStockDraft('${r.edit_id}','fila_scaffale',this.value)"></label><label>Bancale/Carrello<input class="field" ${disabled} value="${html(r.bancale)}" oninput="editStockDraft('${r.edit_id}','bancale',this.value)"></label></div></div>`;
  }

  window.renameStockArticleGroupV3=function(idsCsv,value){
    const a=art(value);for(const id of idsCsv.split(',').filter(Boolean))editStockDraft(id,'article_base',a);window.renderStockEditRows?.();
  };
  window.addStockVariantGroupV3=function(articleCode){
    const l=norm(stockEditSource?.fila_scaffale),p=norm(stockEditSource?.bancale);if(!hasPos(l,p))return alert('Cerca prima una posizione da modificare.');
    stockEditRowsDraft.push({edit_id:uidSafe(),original:null,deleted:false,article_base:art(articleCode),size:'',quantity:0,state:'NUOVO',fila_scaffale:l,bancale:p});window.renderStockEditRows?.();
  };

  function installDirectGrouping(){
    if(typeof stockEditRowsDraft==='undefined')return false;
    window.renderStockEditRows=function(){
      const active=stockEditRowsDraft.filter(r=>!r.deleted).length,groups=grouped(stockEditRowsDraft),holder=$('stockEditRows');
      if($('stockEditSummary'))$('stockEditSummary').textContent=`${posText(stockEditSource?.fila_scaffale||'',stockEditSource?.bancale||'')} · ${groups.length} articoli · ${active} varianti attive`;
      if(holder)holder.innerHTML=groups.map(([code,rows],gi)=>{const ids=rows.map(r=>r.edit_id).join(',');return `<section class="scaArticleGroup ${gi%2?'toneB':'toneA'}"><div class="scaArticleHead"><div style="flex:1"><label style="margin:0">Articolo<input class="field scaArticleInput" value="${html(code.startsWith('—')?'':code)}" onchange="renameStockArticleGroupV3('${ids}',this.value)"></label></div></div>${rows.map(directVariantHtml).join('')}<button class="scaAddVariant" onclick="addStockVariantGroupV3('${html(code.startsWith('—')?'':code)}')">＋ AGGIUNGI TAGLIA / STATO</button></section>`}).join('');
      ensureDirectFloat();
    };
    return true;
  }

  function ensureDirectFloat(){
    if($('stockQuickFoundDirectV3'))return;const screen=$('stockEditScreen');if(!screen)return;
    const b=document.createElement('button');b.id='stockQuickFoundDirectV3';b.className='scaFloatAdd scaDirectFloat';b.type='button';b.textContent='＋ TROVATO';b.onclick=()=>openQuick('direct');screen.appendChild(b);
  }

  /* -------- Assisted physical count -------- */
  function counted(r){return (r.partials||[]).reduce((n,x)=>n+Math.max(0,Math.floor(Number(x)||0)),0)}
  function difference(r){return counted(r)-Math.max(0,Math.floor(Number(r.expected)||0))}
  function exactDraft(articleCode,size,state){return assistDraft.find(r=>art(r.article_base)===art(articleCode)&&norm(r.size)===norm(size)&&norm(r.state)===norm(state))}
  function knownElsewhere(articleCode,size,state){return stockRows().filter(x=>art(x.article_base)===art(articleCode)&&norm(x.size)===norm(size)&&norm(x.state)===norm(state)&&Number(x.quantity)>0&&!( (!assistContext.loc||locOf(x)===assistContext.loc) && (!assistContext.pallet||palOf(x)===assistContext.pallet) ));}

  function ensureAssistScreen(){
    if($('mgrCountAssistScreenV3'))return true;const main=document.querySelector('main');if(!main)return false;
    const s=document.createElement('section');s.id='mgrCountAssistScreenV3';s.className='screen';s.innerHTML=`<button class="back" onclick="show('mgrStockControlHub')">← RETTIFICA / VERIFICA</button><div class="eyebrow">CONTEGGIO ASSISTITO</div><h1>Verifica giacenza</h1><div class="card"><div class="sectionTitle">Posizione da verificare</div><div class="mgrPosGrid"><label>Fila/Scaffale<input id="scaCountLoc" class="field" placeholder="Facoltativo"></label><label>Bancale/Carrello<input id="scaCountPal" class="field" placeholder="Facoltativo"></label></div><button class="btn primary" onclick="loadPhysicalCountAssistV3()">CARICA GIACENZA ATTESA</button><div id="scaCountStatus" class="status hidden"></div></div><div id="scaCountBody" class="hidden"><div class="status warn"><b>Conta mentre cammini lungo la fila.</b><br>Ogni cartone può essere aggiunto come parziale. Il totale viene aggiornato automaticamente e non devi ricordarlo a mente.</div><div id="scaCountRows"></div><button class="btn success" onclick="confirmPhysicalCountAssistV3()">CONFERMA VERIFICA</button></div><button id="scaFloatFound" class="scaFloatAdd" type="button" onclick="openStockQuickFoundV3('count')">＋ TROVATO</button>`;main.appendChild(s);return true;
  }

  function partialsHtml(r){return (r.partials||[]).map((q,pi)=>`<button class="scaPartialChip" type="button" onclick="removeCountPartialV3('${r.cid}',${pi})">${q}<small>×</small></button>`).join('')}
  function variantCountHtml(r){
    const c=counted(r),d=difference(r),verified=!!r.verified,delta=verified?(d>0?`+${d}`:String(d)):'—',deltaCls=!verified?'zero':d>0?'pos':d<0?'neg':'zero';
    return `<div class="scaVariant ${r.extra?'mgrFound':''}"><div class="scaVariantHead"><div><div class="scaVariantTitle">${html(norm(r.size)||'SENZA TAGLIA')} · ${html(norm(r.state))}</div><div class="scaVariantMeta">${r.extra?'TROVATO NON PREVISTO':'Previsto nella posizione'}</div></div>${r.extra?`<button class="mini danger" onclick="removeAssistExtraV3('${r.cid}')">RIMUOVI</button>`:''}</div><div class="scaCountMetrics"><div class="scaMetric"><b>${Math.floor(Number(r.expected)||0)}</b><span>ATTESO</span></div><div class="scaMetric"><b>${verified?c:'—'}</b><span>CONTATO</span></div><div class="scaMetric"><b class="mgrDelta ${deltaCls}" style="margin:0">${delta}</b><span>DIFFERENZA</span></div></div><div class="scaPartialAdd"><label style="margin:0">Aggiungi parziale<input id="scaPartial_${r.cid}" class="field" type="number" min="1" inputmode="numeric" placeholder="Es. 30" onkeydown="if(event.key==='Enter'){event.preventDefault();addCountPartialV3('${r.cid}')} "></label><button type="button" onclick="addCountPartialV3('${r.cid}')">＋</button></div><div class="scaPartials">${partialsHtml(r)}</div>${!verified?'<div class="scaUnverified">Da verificare: aggiungi almeno un parziale oppure conferma che il totale trovato è 0.</div>':''}<div class="mgrToolbar"><button class="scaZeroBtn" type="button" onclick="markCountZeroV3('${r.cid}')">CONFERMA 0</button>${r.partials?.length?`<button class="mini" type="button" onclick="clearCountPartialsV3('${r.cid}')">AZZERA PARZIALI</button>`:''}</div></div>`;
  }
  function renderAssist(){
    const h=$('scaCountRows');if(!h)return;const groups=grouped(assistDraft);
    h.innerHTML=groups.map(([code,rows],gi)=>`<section class="scaArticleGroup ${gi%2?'toneB':'toneA'}"><div class="scaArticleHead"><div class="scaArticleCode">${html(code)}</div><span class="tag">${rows.length} ${rows.length===1?'variante':'varianti'}</span></div>${rows.map(variantCountHtml).join('')}</section>`).join('');
  }

  window.openPhysicalCountV2=function(){
    if(typeof requireLogin==='function'&&!requireLogin())return;if(window.LocalMaster?.requireMaster&&!window.LocalMaster.requireMaster())return;
    ensureAssistScreen();assistDraft=[];assistContext={loc:'',pallet:''};$('scaCountLoc').value='';$('scaCountPal').value='';$('scaCountStatus').classList.add('hidden');$('scaCountBody').classList.add('hidden');show('mgrCountAssistScreenV3');
  };
  window.loadPhysicalCountAssistV3=function(){
    const l=norm($('scaCountLoc')?.value),p=norm($('scaCountPal')?.value);if(!hasPos(l,p))return alert('Inserisci Fila/Scaffale oppure Bancale/Carrello da verificare.');
    assistContext={loc:l,pallet:p};const rows=window.WarehouseManagerialV2?.rowsAt?.(l,p)||[];assistDraft=rows.map(r=>({cid:uidSafe(),extra:false,article_base:art(r.article_base),size:norm(r.size),state:norm(r.state),expected:Math.floor(Number(r.quantity)||0),fila_scaffale:locOf(r),bancale:palOf(r),key:rowKey(r),partials:[],verified:false}));
    const articles=new Set(assistDraft.map(r=>art(r.article_base))).size;$('scaCountStatus').className=`status ${rows.length?'good':'warn'}`;$('scaCountStatus').textContent=rows.length?`${articles} articoli · ${rows.length} varianti attese · ${posText(l,p)}.`:`Nessuna giacenza attesa · ${posText(l,p)}. Usa + TROVATO per ciò che trovi.`;$('scaCountStatus').classList.remove('hidden');$('scaCountBody').classList.remove('hidden');renderAssist();
  };
  window.addCountPartialV3=function(cid,qArg){const r=assistDraft.find(x=>x.cid===cid);if(!r)return;const input=$(`scaPartial_${cid}`),q=Math.floor(Number(qArg??input?.value)||0);if(q<=0)return alert('Inserisci un parziale maggiore di 0.');r.partials.push(q);r.verified=true;if(input)input.value='';renderAssist();};
  window.removeCountPartialV3=function(cid,pi){const r=assistDraft.find(x=>x.cid===cid);if(!r)return;r.partials.splice(pi,1);r.verified=r.partials.length>0;renderAssist();};
  window.clearCountPartialsV3=function(cid){const r=assistDraft.find(x=>x.cid===cid);if(!r)return;r.partials=[];r.verified=false;renderAssist();};
  window.markCountZeroV3=function(cid){const r=assistDraft.find(x=>x.cid===cid);if(!r)return;if(r.partials.length&&!confirm('Sono già presenti parziali. Vuoi azzerarli e confermare CONTATO = 0?'))return;r.partials=[];r.verified=true;renderAssist();};
  window.removeAssistExtraV3=function(cid){const i=assistDraft.findIndex(x=>x.cid===cid);if(i>=0&&assistDraft[i].extra){assistDraft.splice(i,1);renderAssist()}};

  /* -------- Always-reachable quick found dialog -------- */
  function ensureQuickDialog(){
    let d=$('scaQuickDialog');if(d)return d;d=document.createElement('dialog');d.id='scaQuickDialog';d.className='scaQuickDialog';d.innerHTML=`<div class="scaQuickHead"><h2 id="scaQuickTitle">Trovato</h2><button type="button" onclick="scaQuickDialog.close()">×</button></div><div id="scaQuickHint" class="status good"></div><label>Articolo<input id="scaQuickArticle" class="field" autocomplete="off"></label><div class="twoCols"><label>Taglia<input id="scaQuickSize" class="field" autocomplete="off"></label><label>Stato<select id="scaQuickState" class="field"></select></label></div><label>Quantità trovata<input id="scaQuickQty" class="field" type="number" min="1" inputmode="numeric" placeholder="Es. 30"></label><div class="scaQuickActions"><button class="btn soft" type="button" onclick="scaQuickDialog.close()">ANNULLA</button><button class="btn primary" type="button" onclick="confirmStockQuickFoundV3()">AGGIUNGI</button></div>`;document.body.appendChild(d);return d;
  }
  function openQuick(mode){
    quickMode=mode;const d=ensureQuickDialog(),l=mode==='count'?assistContext.loc:norm(stockEditSource?.fila_scaffale),p=mode==='count'?assistContext.pallet:norm(stockEditSource?.bancale);if(!hasPos(l,p))return alert(mode==='count'?'Carica prima una posizione da verificare.':'Cerca prima una posizione da rettificare.');
    $('scaQuickTitle').textContent=mode==='count'?'Trovato durante il conteggio':'Aggiungi materiale trovato';$('scaQuickHint').innerHTML=mode==='count'?`<b>${html(posText(l,p))}</b><br>Se la combinazione è già prevista, la quantità verrà aggiunta direttamente come parziale.`:`<b>${html(posText(l,p))}</b><br>La nuova variante verrà aggiunta alla rettifica, non registrata come CARICA.`;$('scaQuickArticle').value='';$('scaQuickSize').value='';$('scaQuickQty').value='';$('scaQuickState').innerHTML=states().map(s=>`<option>${html(s)}</option>`).join('');d.showModal();setTimeout(()=>$('scaQuickArticle')?.focus(),40);
  }
  window.openStockQuickFoundV3=openQuick;
  window.confirmStockQuickFoundV3=function(){
    const a=art($('scaQuickArticle')?.value),s=norm($('scaQuickSize')?.value),st=norm($('scaQuickState')?.value),q=Math.floor(Number($('scaQuickQty')?.value)||0);if(!a)return alert('Inserisci il codice articolo.');if(q<=0)return alert('Inserisci una quantità maggiore di 0.');
    if(quickMode==='count'){
      let r=exactDraft(a,s,st);if(r){r.partials.push(q);r.verified=true;toast(`${a}${s?' '+s:''}: +${q} al conteggio.`,'success')}
      else{const elsewhere=knownElsewhere(a,s,st);if(elsewhere.length&&!confirm(`${a}${s?' '+s:''} ${st} risulta già presente in altre posizioni (${elsewhere.reduce((n,x)=>n+Number(x.quantity||0),0)} pezzi).\n\nSe è la stessa merce ubicata male, premi ANNULLA e usa SPOSTA.\n\nVuoi registrarla comunque come quantità aggiuntiva trovata qui?`))return;r={cid:uidSafe(),extra:true,article_base:a,size:s,state:st,expected:0,fila_scaffale:assistContext.loc,bancale:assistContext.pallet,key:'',partials:[q],verified:true};assistDraft.push(r);toast(`${a}${s?' '+s:''}: trovato non previsto +${q}.`,'success')}
      renderAssist();$('scaQuickDialog').close();return;
    }
    stockEditRowsDraft.push({edit_id:uidSafe(),original:null,deleted:false,article_base:a,size:s,quantity:q,state:st,fila_scaffale:norm(stockEditSource?.fila_scaffale),bancale:norm(stockEditSource?.bancale)});window.renderStockEditRows?.();toast(`${a}${s?' '+s:''}: aggiunto alla rettifica.`,'success');$('scaQuickDialog').close();
  };

  window.confirmPhysicalCountAssistV3=function(){
    if(typeof requireLogin==='function'&&!requireLogin())return;if(!assistDraft.length&&!hasPos(assistContext.loc,assistContext.pallet))return alert('Carica prima una posizione da verificare.');
    const missing=assistDraft.filter(r=>!r.extra&&!r.verified);if(missing.length)return alert(`Completa il conteggio di tutte le varianti attese. Ne restano ${missing.length} da verificare.`);
    const extras=assistDraft.filter(r=>r.extra&&counted(r)>0);for(const r of extras){if(!art(r.article_base))return alert('Completa il codice articolo dei materiali trovati.');if(!states().includes(norm(r.state)))return alert('Scegli uno stato valido per tutti i materiali trovati.')}
    const current=new Map(stockRows().map(r=>[rowKey(r),Number(r.quantity)||0]));for(const r of assistDraft.filter(x=>!x.extra)){const now=Number(current.get(r.key)||0);if(now!==Number(r.expected))return alert(`${r.article_base} ${r.size||''}: la giacenza è cambiata durante il conteggio (${r.expected} → ${now}). Ricarica la posizione e ripeti la verifica.`)}
    const lines=[],changes=[];for(const r of assistDraft){if(!r.verified&&r.extra)continue;const c=counted(r),e=Math.max(0,Math.floor(Number(r.expected)||0)),d=c-e;if(r.extra&&c<=0)continue;lines.push({article_base:art(r.article_base),size:norm(r.size),state:norm(r.state),expected:e,counted:c,difference:d,extra:!!r.extra,partials:[...(r.partials||[])]});if(d===0)continue;if(r.extra){changes.push({before:null,after:{article_base:art(r.article_base),size:norm(r.size),quantity:c,state:norm(r.state),fila_scaffale:assistContext.loc,fila:assistContext.loc,scaffale:'',bancale:assistContext.pallet},expected:0,counted:c,difference:d})}else{const before={article_base:art(r.article_base),size:norm(r.size),quantity:e,state:norm(r.state),fila_scaffale:r.fila_scaffale,fila:r.fila_scaffale,scaffale:'',bancale:r.bancale};changes.push({before,after:c>0?{...before,quantity:c}:null,expected:e,counted:c,difference:d})}}
    const plus=lines.filter(x=>x.difference>0).reduce((n,x)=>n+x.difference,0),minus=Math.abs(lines.filter(x=>x.difference<0).reduce((n,x)=>n+x.difference,0));if(!confirm(`Confermi il conteggio assistito di ${posText(assistContext.loc,assistContext.pallet)}?\n\nArticoli: ${new Set(lines.map(x=>x.article_base)).size}\nVarianti controllate: ${lines.length}\nCon differenze: ${changes.length}\nDifferenze positive: +${plus}\nDifferenze negative: -${minus}\n\nLe differenze saranno registrate come VERIFICA FISICA.`))return;
    if(!Array.isArray(db.rectifications))db.rectifications=[];if(!Array.isArray(db.stock_verifications))db.stock_verifications=[];const batch=uidSafe(),id=`VF-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}-${batch.slice(-4)}`,at=nowIso(),rectIds=[];for(const c of changes){const note=`[VERIFICA] ${id} · Atteso ${c.expected} · Contato ${c.counted} · Differenza ${c.difference>0?'+':''}${c.difference} · ${posText(assistContext.loc,assistContext.pallet)}`,rec={id:uidSafe(),batch_id:batch,type:'RETTIFICA',semantic_type:'VERIFICA_FISICA',operator:actor(),registered_at:at,operation_at:at,updated_at:at,cancelled_at:null,before:c.before?clone(c.before):null,after:c.after?clone(c.after):null,note};db.rectifications.unshift(rec);rectIds.push(rec.id);if(typeof audit==='function')audit('CREATE','RECTIFICATION',rec.id,null,clone(rec))}
    const session={id,type:'VERIFICA_FISICA',operator:actor(),created_at:at,position:{fila_scaffale:assistContext.loc,bancale:assistContext.pallet},lines,changed_lines:changes.length,positive_difference:plus,negative_difference:minus,rectification_ids:rectIds};db.stock_verifications.unshift(session);if(typeof audit==='function')audit('CREATE','STOCK_VERIFICATION',id,null,clone(session));saveDb();window.renderStock?.();window.renderRegistry?.();window.LocalMaster?.renderPanel?.();toast(`Verifica ${id} completata: ${changes.length} differenze.`,'success');show('mgrStockControlHub');
  };

  function relabelCountMode(){const hub=$('mgrStockControlHub');if(!hub)return;const btn=[...hub.querySelectorAll('.mgrAction')].find(b=>/CONTEGGIO FISICO/i.test(b.textContent||''));if(btn){const b=btn.querySelector('b'),small=btn.querySelector('small');if(b)b.textContent='CONTEGGIO ASSISTITO';if(small)small.textContent='Conta cartone per cartone con parziali progressivi, raggruppati per articolo.'}}

  function install(){injectCss();ensureAssistScreen();installDirectGrouping();ensureDirectFloat();relabelCountMode();return true}
  window.WarehouseStockControlAssistedV3={version:VERSION,install,renderAssist};
  install();
})();