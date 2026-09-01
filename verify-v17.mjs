import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const direct=fs.readFileSync('index.html','utf8');
assert.match(direct,/<title>Magazzino NOVA · Teramo · V1[78]<\/title>/);
assert.match(direct,/bundle\/position-v17\.css/);
assert.match(direct,/const positionKey=value=>norm\(value\)\.replace/);
assert.match(direct,/const positionMatches=\(row,location='',pallet=''\)=>/);
assert.match(direct,/id="stockLocation"[^>]*placeholder="Es\. 5"/);
assert.match(direct,/id="stockPallet"[^>]*placeholder="Es\. 157 o DISMESSI 52"/);
assert.match(direct,/MATCH ESATTO/);
assert.doesNotMatch(direct,/placeholder="Fila \/ bancale"/);
assert.match(direct,/if\(!location&&!pallet\)throw new Error\('Inserisci almeno Fila\/Scaffale oppure Bancale\.'/);
assert.match(direct,/this\.domain\.stock\.positive\(\)\.filter\(r=>positionMatches\(r,location,pallet\)\)/);
assert.match(direct,/data-count-extra="location"/);
assert.match(direct,/AREA DI CONTEGGIO/);
assert.match(direct,/stockQuery','stockLocation','stockPallet/);

const norm=value=>String(value??'').trim().toUpperCase();
const positionKey=value=>norm(value).replace(/\s+/g,' ');
const positionMatches=(row,location='',pallet='')=>{const l=positionKey(location),p=positionKey(pallet);return(!l||positionKey(row?.location)===l)&&(!p||positionKey(row?.pallet)===p)};
const rows=[
  {location:'5',pallet:'157'},
  {location:'52',pallet:'5'},
  {location:'15',pallet:'DISMESSI 52'},
  {location:'5',pallet:'DISMESSI 52'},
  {location:'',pallet:'5'}
];
assert.deepEqual(rows.filter(r=>positionMatches(r,'5','')).map(r=>[r.location,r.pallet]),[['5','157'],['5','DISMESSI 52']]);
assert.deepEqual(rows.filter(r=>positionMatches(r,'','5')).map(r=>[r.location,r.pallet]),[['52','5'],['','5']]);
assert.deepEqual(rows.filter(r=>positionMatches(r,'5','DISMESSI 52')).map(r=>[r.location,r.pallet]),[['5','DISMESSI 52']]);
assert.equal(positionMatches({location:' 5 ',pallet:'gemelli 8'},'5','GEMELLI 8'),true);
assert.equal(positionMatches({location:'52',pallet:'157'},'5',''),false);

const script=(direct.match(/<script>([\s\S]*?)<\/script>/)||[])[1];
assert.ok(script,'application script missing');
new vm.Script(script,{filename:'nova-position-regression.js'});
console.log('NOVA exact independent position engine + UX regression: OK');
