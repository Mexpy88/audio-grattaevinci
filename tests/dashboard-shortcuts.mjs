import fs from 'node:fs';
const js=fs.readFileSync('dashboard-links.js','utf8');
const checks=[
  ['Movimenti shortcut',/key:'movimenti'/],
  ['Scarichi shortcut',/key:'scarichi'/],
  ['Richieste shortcut',/key:'richieste'/],
  ['Registry movements route',/setRegistryTab\('MOVIMENTI'\)/],
  ['Registry discharges route',/setRegistryTab\('SCARICHI'\)/],
  ['Requests route',/openRequests\(\)/],
  ['Click navigation',/addEventListener\('click'/],
  ['Keyboard navigation',/addEventListener\('keydown'/],
  ['Accessible role',/setAttribute\('role','button'\)/],
  ['Touch feedback',/lmStatLink:active/]
];
const missing=[];
for(const [name,re] of checks)if(!re.test(js))missing.push(name);
if(missing.length){console.error('Dashboard shortcuts FAILED:',missing.join(', '));process.exit(1)}
console.log('Dashboard shortcuts OK: Movimenti, Scarichi e Richieste sono cliccabili, accessibili e collegati alle viste corrette.');
