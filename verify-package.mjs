import fs from 'node:fs';import assert from 'node:assert/strict';import vm from 'node:vm';
const m=JSON.parse(fs.readFileSync('manifest.json','utf8'));
const source=m.parts.map(p=>fs.readFileSync(p,'utf8')).join('');
const css=fs.readFileSync('bundle/mobile-v4.css','utf8');
const brand=fs.readFileSync('bundle/landing-brand-v7.css','utf8');
const refine=fs.readFileSync('bundle/landing-brand-v8.css','utf8');
const stockUx=fs.readFileSync('bundle/stock-ux-v11.css','utf8');
const palette=fs.readFileSync('bundle/article-palette-v12.css','utf8');
const v13=fs.readFileSync('bundle/ux-system-v13.css','utf8');
const sound=fs.readFileSync('bundle/ui-sound-v8.js','utf8');
const direct=fs.readFileSync('index.html','utf8');

assert.ok(source.length>100000,'bundle NOVA incompleto');
assert.ok(direct.length>100000,'index NOVA incompleto');
assert.doesNotMatch(direct,/Avvio applicazione|const PARTS=|document\.write\(/,'loader legacy ancora presente');
assert.doesNotMatch(direct,/MutationObserver|setInterval\s*\(/,'NOVA must stay event-driven');

/* Existing release contracts must survive. */
assert.match(direct,/fetchpriority="high"/);assert.match(direct,/class="brand-lockup"/);assert.match(direct,/MAGAZZINO TERAMO/);assert.match(direct,/warehouse-ferrara[^>]*disabled/);assert.match(direct,/warehouse-lucca[^>]*disabled/);
assert.match(direct,/bundle\/mobile-v4\.css\?v=20260828-v6/);assert.match(direct,/bundle\/landing-brand-v7\.css\?v=20260828-v7/);assert.match(direct,/bundle\/landing-brand-v8\.css\?v=20260828-v8/);assert.match(direct,/bundle\/stock-ux-v11\.css\?v=20260831-v11/);assert.match(direct,/bundle\/article-palette-v12\.css\?v=20260831-v12/);assert.match(direct,/bundle\/ux-system-v13\.css\?v=20260831-v13/);assert.match(direct,/bundle\/ui-sound-v8\.js\?v=20260828-v10/);
assert.match(direct,/class="pin-toggle"[^>]*aria-label="Mostra PIN"[^>]*aria-pressed="false"/);assert.match(direct,/pin\.type='password'/);assert.match(direct,/show\?'Nascondi PIN':'Mostra PIN'/);
assert.match(css,/NOVA mobile layout V6/);assert.match(brand,/NOVA landing branding V7/);assert.match(refine,/NOVA landing refinement V8/);assert.match(stockUx,/NOVA stock UX V11/);assert.match(palette,/NOVA article palette V12/);

/* V13: definitive sage/cream hierarchy. */
assert.match(v13,/NOVA UX system V13/);
assert.match(v13,/--v13-sage-2:#dff1e6/);assert.match(v13,/--v13-cream-2:#f9e9c9/);
assert.match(v13,/#stockResults \.stock-card:nth-child\(odd\)/);assert.match(v13,/#stockResults \.stock-card:nth-child\(even\)/);
assert.match(v13,/#registryResults \.ledger-card:nth-child\(odd\)/);assert.match(v13,/#registryResults \.ledger-card:nth-child\(even\)/);
assert.match(v13,/grid-template-columns:minmax\(0,1fr\) max-content!important/);assert.match(v13,/white-space:nowrap!important/);
assert.match(v13,/#sourcePickerDialog/);assert.match(v13,/position:sticky;top:0/);assert.match(v13,/\.source-picker-back/);assert.match(v13,/\.source-picker-item\.tone-green/);assert.match(v13,/\.source-picker-item\.tone-cream/);
assert.match(v13,/\.master-version-card/);assert.match(v13,/\.master-id/);

/* V13: native stock select is replaced by NOVA picker. */
assert.match(direct,/id="sourcePickerDialog"/);assert.match(direct,/class="source-picker-back"[^>]*data-action="source-picker-close"/);assert.match(direct,/id="sourcePickerSearch"/);assert.match(direct,/id="sourcePickerList"/);
assert.match(direct,/sourcePickerTriggerMarkup\(r\)/);assert.match(direct,/openSourcePicker\(id\)/);assert.match(direct,/renderSourcePicker\(query=''/);assert.match(direct,/chooseSource\(key\)/);
assert.match(direct,/'source-picker-open':\(\)=>this\.openSourcePicker/);assert.match(direct,/'source-picker-close':\(\)=>this\.closeSourcePicker/);assert.match(direct,/'source-picker-choose':\(\)=>this\.chooseSource/);
assert.match(direct,/sourcePickerSearch'\)this\.renderSourcePicker\(el\.value\)/);
assert.doesNotMatch(direct,/sourceSelect\(id='sourceSelect'\)\{const rows=this\.domain\.stock\.positive\(\);return `<select/,'native stock select must be gone');

/* V13: Master identity/version lineage. */
assert.match(direct,/const masterIdFor=/);assert.match(direct,/masterId:'',version:0,versionAt:null/);
assert.match(direct,/source:'FRESH_IMPORT',masterId:masterIdFor\(file\.name,importedAt\),version:1,versionAt:importedAt/);
assert.match(direct,/source:'REMOTO_XLSX_MIGRATION',masterId:masterIdFor\(file\.name,importedAt\),version:1,versionAt:importedAt/);
assert.match(direct,/source:'NOVA_REIMPORT',masterId:next\.master\?\.masterId\|\|masterIdFor/);
assert.match(direct,/meta\.version=Math\.max\(1,Number\(meta\.version\)\|\|1\)\+1/);
assert.match(direct,/ID MASTER/);assert.match(direct,/VERSIONE CREATA/);assert.match(direct,/class="master-version-card"/);
assert.match(direct,/MASTER_EXPORTED','MASTER',name,null,\{name,masterId:this\.store\.db\.master\.masterId,version:this\.store\.db\.master\.version\}/);

/* Stock search and card collision fix remain active. */
assert.match(direct,/id="stockQuery" class="field stock-query-uppercase"[^>]*oninput="this\.value=this\.value\.toUpperCase\(\)"/);assert.match(direct,/class="stock-card-head"/);

/* Sound and protected-sheet preservation remain intact. */
assert.match(sound,/gain=0\.10/);assert.match(sound,/tone\(520,0\.070,0\.16/);assert.doesNotMatch(sound,/fetch\s*\(|\.mp3|\.wav|MutationObserver|setInterval\s*\(/);
new vm.Script(sound,{filename:'ui-sound-v10.js'});
assert.match(direct,/replaceSheet\(wb,name,ws\)\{const previous=wb\.Sheets\[name\],protection=previous\?\.\['!protect'\];if\(protection\)ws\['!protect'\]=clone\(protection\);/);
assert.doesNotMatch(direct,/sheetPassword|worksheetPassword|protectionPassword/);

/* Syntax + domain regression. */
const script=(direct.match(/<script>([\s\S]*?)<\/script>/)||[])[1];assert.ok(script,'application script missing');new vm.Script(script,{filename:'nova-v13.js'});
const core=(script.split('/* js/core.js */')[1]||'').split('/* js/domain.js */')[0],domain=(script.split('/* js/domain.js */')[1]||'').split('/* js/excel.js */')[0];assert.ok(core&&domain);
const runtime=core+'\n'+domain+`\nclass M{constructor(){this.m=new Map()}getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}};globalThis.localStorage=new M();const s={db:createEmptyDb(),save(){},snapshot(){return structuredClone(this.db)},replace(x){this.db=x}},a={user:'Mattia',can(c){return PROFILES[this.user].caps.includes(c)},isLina(){return this.user==='Lina'}},d=createDomain(s,a);s.db.master.rows=[{article:'I1',size:'M',state:'NUOVO',quantity:10,location:'1',pallet:'A'}];d.stock.invalidate();const r=d.receiving.create({supplier:'TEST',lines:[{article:'I1',size:'M',state:'NUOVO',ddtQuantity:5,checkedQuantity:5,pallet:'P'}]});if(d.stock.total('I1','M')!==15)throw new Error('receipt stock regression');if(d.receiving.stats(r).pending!==5)throw new Error('pending regression');const mid=masterIdFor('MASTER.xlsx','2026-08-31T12:00:00.000Z');if(!/^MST-20260831-[A-F0-9]{6}$/.test(mid))throw new Error('master id regression');`;
vm.runInNewContext(runtime,{console,structuredClone,crypto:globalThis.crypto,Date,Math,Number,String,Array,Map,Set,JSON,Object,Error,Intl});
console.log('NOVA V13 sage/cream + source picker + Master identity + domain regression: OK');
