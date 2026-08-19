import fs from 'node:fs';
const js=fs.readFileSync('local-master.js','utf8');
const css=fs.readFileSync('local-master.css','utf8');
const checks=[
  ['Movimenti shortcut',/data-lm-nav="movimenti"/],
  ['Scarichi shortcut',/data-lm-nav="scarichi"/],
  ['Richieste shortcut',/data-lm-nav="richieste"/],
  ['Registry movements route',/setRegistryTab\('MOVIMENTI'\)/],
  ['Registry discharges route',/setRegistryTab\('SCARICHI'\)/],
  ['Requests route',/openRequests\(\)/],
  ['Keyboard accessible buttons',/<button[^>]+class="lmStatBtn"/],
  ['Clickable styling',/\.lmStatBtn/]
];
const missing=[];
for(const [name,re] of checks){const src=name==='Clickable styling'?css:js;if(!re.test(src))missing.push(name)}
if(missing.length){console.error('Dashboard shortcuts FAILED:',missing.join(', '));process.exit(1)}
console.log('Dashboard shortcuts OK: Movimenti, Scarichi e Richieste sono pulsanti navigabili con route dedicate.');
