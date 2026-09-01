import fs from 'node:fs';

await import('./build-v16.mjs');

let html=fs.readFileSync('index.html','utf8');
const mustReplace=(from,to,label)=>{if(!html.includes(from))throw new Error(`NOVA V17 build contract missing: ${label}`);html=html.replace(from,to)};
const mustRegex=(re,to,label)=>{if(!re.test(html))throw new Error(`NOVA V17 build contract missing: ${label}`);html=html.replace(re,to)};

mustReplace('</head>','<link rel="stylesheet" href="bundle/position-v17.css?v=20260901-v17"></head>','V17 stylesheet');
mustReplace('<title>Magazzino NOVA · Teramo · V16</title>','<title>Magazzino NOVA · Teramo · V17</title>','V17 title');

/* One exact, normalized position engine for every warehouse workflow. */
mustReplace(
  "const norm=value=>String(value??'').trim().toUpperCase();\nconst normalizeArticle=",
  "const norm=value=>String(value??'').trim().toUpperCase();\nconst positionKey=value=>norm(value).replace(/\\s+/g,' ');\nconst positionMatches=(row,location='',pallet='')=>{const l=positionKey(location),p=positionKey(pallet);return(!l||positionKey(row?.location)===l)&&(!p||positionKey(row?.pallet)===p)};\nconst normalizeArticle=",
  'Unified exact position matcher'
);

const stock=`  stock(){return \`${'${'}this.sectionTitle('GIACENZE','Cerca articoli e posizioni')}<section class="filter-card"><input id="stockQuery" class="field stock-query-uppercase" placeholder="CODICE ARTICOLO O TAGLIA…" autocapitalize="characters" autocomplete="off" spellcheck="false" oninput="this.value=this.value.toUpperCase()"><select id="stockState" class="field" style="margin-top:10px"><option value="">TUTTI GLI STATI</option>${'${'}CONFIG.states.map(s=>\`<option>${'${'}s}</option>\`).join('')}</select><div class="position-filter-block"><div class="position-filter-head"><span><b>POSIZIONE</b><small>Fila/Scaffale e Bancale sono indipendenti.</small></span><span class="exact-chip">MATCH ESATTO</span></div><div class="position-filter-grid"><label>Fila / Scaffale<input id="stockLocation" class="field" placeholder="Es. 5" autocomplete="off"></label><label>Bancale<input id="stockPallet" class="field" placeholder="Es. 157 o DISMESSI 52" autocomplete="off"></label></div><div class="position-filter-help">Scrivendo 5 trovi solo la posizione 5, non 52 o 157.</div></div></section><div id="stockResults"></div>\`}`;
mustRegex(/  stock\(\)\{[^\n]*\}\n  renderStockResults/,`${stock}\n  renderStockResults`,'Stock exact-position UI');

const stockResults=`  renderStockResults(){const host=document.getElementById('stockResults');if(!host)return;const q=norm(document.getElementById('stockQuery')?.value),st=norm(document.getElementById('stockState')?.value),location=positionKey(document.getElementById('stockLocation')?.value),pallet=positionKey(document.getElementById('stockPallet')?.value);const rows=this.domain.stock.positive().filter(r=>(!q||normalizeArticle(r.article).includes(normalizeArticle(q))||r.size.includes(q))&&(!st||r.state===st)&&positionMatches(r,location,pallet));host.innerHTML=rows.length?rows.map(r=>\`<article class="stock-card"><div class="stock-card-head"><b>${'${'}esc(r.article)}${'${'}r.size?\` · ${'${'}esc(r.size)}\`:''}</b><strong>${'${'}r.quantity}</strong></div><div class="stock-meta"><span>${'${'}esc(r.state)}</span><span>${'${'}r.location===CONFIG.receivingLocation?'📦 DISPONIBILE · DA UBICARE':\`Fila/Scaffale ${'${'}esc(r.location||'—')}\`}</span><span>Bancale ${'${'}esc(r.pallet||'—')}</span></div>${'${'}this.auth.can('RECTIFY')?\`<button class="mini-btn" data-action="rectify-open" data-key="${'${'}esc(bucketKey(r))}">RETTIFICA</button>\`:''}</article>\`).join(''):'<div class="empty">Nessuna giacenza trovata con questi filtri esatti.</div>'}`;
mustRegex(/  renderStockResults\(\)\{[^\n]*\}\n  rectify/,`${stockResults}\n  rectify`,'Stock exact-position filtering');

const count=`  count(){if(!this.require('COUNT',{master:true}))return'';return \`${'${'}this.sectionTitle('GIACENZE','Conteggio assistito','Conta ciò che è previsto e registra anche eventuale materiale trovato in più.')}<section class="form-card count-position-card"><div class="position-filter-block"><div class="position-filter-head"><span><b>POSIZIONE DA CONTARE</b><small>Compila Fila/Scaffale, Bancale oppure entrambi.</small></span><span class="exact-chip">MATCH ESATTO</span></div><div class="position-filter-grid"><label>Fila / Scaffale<input id="countLocation" class="field" value="${'${'}esc(this.countDraft?.location||'')}" placeholder="Facoltativo"></label><label>Bancale<input id="countPallet" class="field" value="${'${'}esc(this.countDraft?.pallet||'')}" placeholder="Facoltativo"></label></div><div class="position-filter-help">È obbligatorio compilare almeno uno dei due campi.</div></div><button class="primary" data-action="count-load">CARICA POSIZIONE</button></section><div id="countBody"></div>\`}`;
mustRegex(/  count\(\)\{[^\n]*\}\n  loadCount/,`${count}\n  loadCount`,'Count independent position UI');

const loadCount=`  loadCount(){const location=positionKey(document.getElementById('countLocation')?.value),pallet=positionKey(document.getElementById('countPallet')?.value);if(!location&&!pallet)throw new Error('Inserisci almeno Fila/Scaffale oppure Bancale.');const rows=this.domain.stock.positive().filter(r=>positionMatches(r,location,pallet));this.countDraft={location,pallet,rows:rows.map((r,i)=>({domId:\`c${'${'}i}\`,key:bucketKey(r),source:r,partials:[],counted:null,verified:false})),extras:[]};this.renderCountBody()}`;
mustRegex(/  loadCount\(\)\{[^\n]*\}\n  renderCountBody/,`${loadCount}\n  renderCountBody`,'Count exact independent matching');

/* Count results always show the physical location, especially for pallet-only scopes. */
mustReplace(
  "<span>Atteso: <strong>${r.source.quantity}</strong> · ${esc(r.source.state)} · Bancale ${esc(r.source.pallet||'—')}</span>",
  "<span class=\"count-position-meta\">Atteso: <strong>${r.source.quantity}</strong> · ${esc(r.source.state)} · Fila/Scaffale ${esc(r.source.location||'—')} · Bancale ${esc(r.source.pallet||'—')}</span>",
  'Count result physical position'
);

/* Found-extra rows need their own location when the counting scope was pallet-only. */
mustReplace(
  "<label>Bancale<input class=\"field\" data-count-extra=\"pallet\" data-dom=\"${r.domId}\" value=\"${esc(r.pallet||this.countDraft.pallet)}\"></label>",
  "<div class=\"two\"><label>Fila/Scaffale<input class=\"field\" data-count-extra=\"location\" data-dom=\"${r.domId}\" value=\"${esc(r.location||this.countDraft.location)}\"></label><label>Bancale<input class=\"field\" data-count-extra=\"pallet\" data-dom=\"${r.domId}\" value=\"${esc(r.pallet||this.countDraft.pallet)}\"></label></div>",
  'Extra material location field'
);
mustReplace(
  "addCountExtra(){this.countDraft.extras.push({domId:uid(),article:'',size:'',state:'NUOVO',pallet:this.countDraft.pallet||'',partials:[],counted:0});",
  "addCountExtra(){this.countDraft.extras.push({domId:uid(),article:'',size:'',state:'NUOVO',location:this.countDraft.location||'',pallet:this.countDraft.pallet||'',partials:[],counted:0});",
  'Extra material location model'
);
mustReplace(
  "else if(['size','state','pallet'].includes(key))r[key]=norm(value);",
  "else if(['size','state','location','pallet'].includes(key))r[key]=norm(value);",
  'Extra material location binding'
);

const finalize=`  finalizeCount(){const missing=this.countDraft.rows.filter(r=>!r.verified);if(missing.length)throw new Error(\`Restano ${'${'}missing.length} righe previste da verificare.\`);const extras=(this.countDraft.extras||[]).filter(r=>r.article||r.counted);for(const r of extras){if(!r.article)throw new Error('Completa il codice del materiale trovato.');if(Number(r.counted)<=0)throw new Error(\`Inserisci una quantità contata per ${'${'}r.article}.\`);const location=positionKey(r.location||this.countDraft.location),pallet=positionKey(r.pallet||this.countDraft.pallet);if(!location)throw new Error(\`Per il materiale trovato ${'${'}r.article} indica Fila/Scaffale.\`);const match=this.domain.stock.positive().find(x=>normalizeArticle(x.article)===normalizeArticle(r.article)&&norm(x.size)===norm(r.size)&&norm(x.state)===norm(r.state)&&positionMatches(x,location,pallet));r.location=location;r.pallet=pallet;r.currentKey=match?bucketKey(match):''}const scope=[this.countDraft.location?\`Fila/Scaffale ${'${'}this.countDraft.location}\`:'',this.countDraft.pallet?\`Bancale ${'${'}this.countDraft.pallet}\`:''].filter(Boolean).join(' · ');for(const r of this.countDraft.rows)this.domain.rectifications.setQuantity({currentKey:r.key,counted:r.counted,note:\`Conteggio assistito · ${'${'}scope}\`});for(const r of extras)this.domain.rectifications.setQuantity({currentKey:r.currentKey,article:r.article,size:r.size,state:r.state,location:r.location,pallet:r.pallet,counted:r.counted,note:\`Materiale trovato durante conteggio assistito · ${'${'}scope}\`});this.countDraft=null;this.toast('Conteggio confermato.');this.router.go('stock')}`;
mustRegex(/  finalizeCount\(\)\{[^\n]*\}\n\n  sourcePickerTriggerMarkup/,`${finalize}\n\n  sourcePickerTriggerMarkup`,'Count finalize for independent scope');

/* Live stock filtering responds to both exact position fields. */
mustReplace("if(['stockQuery','stockLocation'].includes(el.id))this.renderStockResults();","if(['stockQuery','stockLocation','stockPallet'].includes(el.id))this.renderStockResults();",'Stock pallet live filtering');

/* Show exactly which independent scope was loaded. */
mustReplace(
  "host.innerHTML=`${expected||'<div class=\"empty compact\">Nessun articolo previsto in questa posizione.</div>'}",
  "const scope=[this.countDraft.location?`Fila/Scaffale ${this.countDraft.location}`:'',this.countDraft.pallet?`Bancale ${this.countDraft.pallet}`:''].filter(Boolean).join(' · ');host.innerHTML=`<div class=\"count-scope\"><span><span>AREA DI CONTEGGIO</span><b>${esc(scope)}</b></span><i>=</i></div>${expected||'<div class=\"empty compact\">Nessun articolo previsto con questi filtri esatti.</div>'}",
  'Count loaded-scope feedback'
);

fs.writeFileSync('index.html',html,'utf8');
console.log(`NOVA V17 exact position UX generated: ${Buffer.byteLength(html)} bytes`);
