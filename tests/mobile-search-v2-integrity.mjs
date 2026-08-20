import fs from 'node:fs';
const js=fs.readFileSync('mobile-search-v3.js','utf8');
const flex=fs.readFileSync('flexible-position-v2.js','utf8');
const css=fs.readFileSync('mobile-search-v2.css','utf8');
const index=fs.readFileSync('index.html','utf8');
const must=[
  ['either position validation',/Fila\/Scaffale oppure Bancale\/Carrello/],
  ['exact size parser',/parseSearch/],
  ['space size example',/I00215 S/],
  ['hyphen size example',/I00215-S/],
  ['grouped availability',/msv2StockGroup/],
  ['availability dropdown',/msv3ToggleGroup/],
  ['swipe back',/touchstart[\s\S]*touchend/],
  ['smart back',/smartBack/],
  ['corrected optional-position integrity',/correctedIntegrity/]
];
for(const [name,re] of must)if(!re.test(js))throw new Error('Missing '+name);
if(!/posOk\(after\)/.test(flex))throw new Error('Flexible rectification position validation missing');
if(!/msv2StockGroup/.test(css))throw new Error('Grouped search CSS missing');
if(!/mobile-search-v3\.js/.test(index)||!/flexible-position-v2\.js/.test(index))throw new Error('New modules are not loaded by index');
if(/mobile-search-v2\.js/.test(index))throw new Error('Broken V2 script must not be loaded');
console.log('Mobile Search V3 integrity OK: flexible positions, exact article+size search, grouped availability and swipe-back are wired.');
