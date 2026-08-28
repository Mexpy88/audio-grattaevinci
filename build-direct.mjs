import fs from 'node:fs';

const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
let html=manifest.parts.map(p=>fs.readFileSync(p,'utf8')).join('');
const mustReplace=(from,to,label)=>{if(!html.includes(from))throw new Error(`NOVA build contract missing: ${label}`);html=html.replace(from,to)};

mustReplace('<link rel="preload" as="image" href="logo-transparent.png">','<link rel="preload" as="image" href="logo-transparent.png" fetchpriority="high">','logo preload');

const landingRe=/landing\(\)\{return `<section class="landing warehouse-landing">[\s\S]*?<\/section>`\}/;
if(!landingRe.test(html))throw new Error('NOVA build contract missing: landing renderer');
html=html.replace(landingRe,`landing(){return \`<section class="landing warehouse-landing"><div class="brand-lockup"><img class="brand-logo" src="\${LOGO}" width="600" height="127" alt="Servizi Ospedalieri" loading="eager" decoding="sync" fetchpriority="high" onload="this.closest('.warehouse-landing')?.classList.add('brand-ready')" onerror="this.closest('.warehouse-landing')?.classList.add('brand-ready')"></div><div class="warehouse-list"><button class="warehouse-card warehouse-teramo" type="button" data-action="login" aria-label="Accedi a Magazzino Teramo"><span>MAGAZZINO TERAMO</span></button><button class="warehouse-card warehouse-ferrara" type="button" disabled aria-disabled="true"><span>MAGAZZINO FERRARA</span></button><button class="warehouse-card warehouse-lucca" type="button" disabled aria-disabled="true"><span>MAGAZZINO LUCCA</span></button></div></section>\`}`);

mustReplace('data-action="toggle-pin" aria-label="Mostra PIN"','class="pin-toggle" data-action="toggle-pin" aria-label="Mostra PIN" aria-pressed="false"','PIN toggle markup');
mustReplace("openLogin(){const d=document.getElementById('loginDialog'),pin=document.getElementById('loginPin');pin.value='';document.getElementById('loginError').classList.add('hidden');d.showModal();setTimeout(()=>pin.focus(),50)}","openLogin(){const d=document.getElementById('loginDialog'),pin=document.getElementById('loginPin'),toggle=d.querySelector('[data-action=\\\"toggle-pin\\\"]');pin.value='';pin.type='password';if(toggle){toggle.setAttribute('aria-label','Mostra PIN');toggle.setAttribute('aria-pressed','false')}document.getElementById('loginError').classList.add('hidden');d.showModal();setTimeout(()=>pin.focus(),50)}",'login reset');
mustReplace("'toggle-pin':()=>{const p=document.getElementById('loginPin');p.type=p.type==='password'?'text':'password'}","'toggle-pin':()=>{const p=document.getElementById('loginPin'),show=p.type==='password';p.type=show?'text':'password';el.setAttribute('aria-label',show?'Nascondi PIN':'Mostra PIN');el.setAttribute('aria-pressed',show?'true':'false')}",'PIN toggle state');

mustReplace("replaceSheet(wb,name,ws){if(wb.SheetNames.includes(name))wb.Sheets[name]=ws;else X().utils.book_append_sheet(wb,ws,name)}","replaceSheet(wb,name,ws){const previous=wb.Sheets[name],protection=previous?.['!protect'];if(protection)ws['!protect']=clone(protection);if(wb.SheetNames.includes(name))wb.Sheets[name]=ws;else X().utils.book_append_sheet(wb,ws,name)}",'worksheet protection preservation');

if(!html.includes('bundle/mobile-v4.css'))html=html.replace('</head>','<link rel="stylesheet" href="bundle/mobile-v4.css?v=20260828-v6"></head>');
else html=html.replace(/bundle\/mobile-v4\.css\?v=[^"']+/g,'bundle/mobile-v4.css?v=20260828-v6');
if(!html.includes('bundle/landing-brand-v7.css'))html=html.replace('</head>','<link rel="stylesheet" href="bundle/landing-brand-v7.css?v=20260828-v7"></head>');
else html=html.replace(/bundle\/landing-brand-v7\.css\?v=[^"']+/g,'bundle/landing-brand-v7.css?v=20260828-v7');
if(!html.includes('bundle/landing-brand-v8.css'))html=html.replace('</head>','<link rel="stylesheet" href="bundle/landing-brand-v8.css?v=20260828-v8"></head>');
else html=html.replace(/bundle\/landing-brand-v8\.css\?v=[^"']+/g,'bundle/landing-brand-v8.css?v=20260828-v8');
if(!html.includes('bundle/ui-sound-v8.js'))html=html.replace('</body>','<script src="bundle/ui-sound-v8.js?v=20260828-v9"></script></body>');
else html=html.replace(/bundle\/ui-sound-v8\.js\?v=[^"']+/g,'bundle/ui-sound-v8.js?v=20260828-v9');

fs.writeFileSync('index.html',html,'utf8');
console.log(`NOVA V9 stronger sound + protected-sheet preservation shell generated: ${Buffer.byteLength(html)} bytes`);
