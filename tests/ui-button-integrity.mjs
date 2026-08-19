import fs from 'node:fs';

const files=[
  'base.html','modifica.js','fixes.js','local-master.js','local-master-ooxml.js','local-master-ux.js','ui-hardening.js','super-ux.js','request-cartons.js'
];
const sources=Object.fromEntries(files.map(f=>[f,fs.readFileSync(f,'utf8')]));
const combined=Object.values(sources).join('\n');

const ignore=new Set(['if','for','while','switch','return','Math','JSON','String','Number','Date','Array','Object','Promise','console','setTimeout','setInterval']);
function callees(code){
  const out=[];const re=/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;let m;
  while((m=re.exec(code))){if(!ignore.has(m[2])&&!out.includes(m[2]))out.push(m[2])}
  return out;
}
function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function defined(name){
  const n=escRe(name);
  const patterns=[
    new RegExp(`function\\s+${n}\\s*\\(`),
    new RegExp(`(?:const|let|var)\\s+${n}\\s*=`),
    new RegExp(`window\\.${n}\\s*=`),
    new RegExp(`(?:^|[^.\\w$])${n}\\s*=\\s*(?:async\\s*)?function`,'m')
  ];
  return patterns.some(r=>r.test(combined));
}

const attrRe=/on(?:click|change|input)=(['"])([\s\S]*?)\1/g;
const unresolved=[];let handlers=0,m;
while((m=attrRe.exec(combined))){
  handlers++;
  for(const name of callees(m[2]))if(!defined(name))unresolved.push({name,code:m[2].slice(0,180)});
}

const critical=['show','openLogin','submitLogin','logout','openOperation','openSearch','openRegistry','openRequests','confirmOperation','importMappedMaster','confirmPicking','saveRequestFromReview','openStockEdit','saveStockEdit','validateLocation','uxQuickOperation','uxQuickEdit','startBarcodeScanner','undoLastOperation','renderRequestReview','ensureDraftAllocations','updateAllocation','exportRequest'];
for(const name of critical)if(!defined(name))unresolved.push({name,code:'CRITICAL_HANDLER'});

const hard=sources['ui-hardening.js'];
if(!/removeAttribute\(['"]onclick['"]\)/.test(hard))unresolved.push({name:'master import hardening',code:'onclick attribute not removed'});
if(!/addEventListener\(['"]click['"],execute,true\)/.test(hard))unresolved.push({name:'master import hardening',code:'capture click listener missing'});
if(!/window\.importMappedMaster=execute/.test(hard))unresolved.push({name:'master import hardening',code:'global import fallback missing'});
if(!/WarehouseUX\?\.beforeMasterImport/.test(hard))unresolved.push({name:'master import preflight',code:'preflight hook missing'});

const unique=[];const seen=new Set();for(const x of unresolved){const k=x.name+'|'+x.code;if(!seen.has(k)){seen.add(k);unique.push(x)}}
if(unique.length){
  console.error('UI integrity FAILED. Unresolved actions:');
  for(const x of unique)console.error('-',x.name,'=>',x.code);
  process.exit(1);
}
console.log(`UI integrity OK: ${handlers} inline handlers scanned; ${critical.length} critical actions verified; master import has explicit capture binding and preflight.`);
