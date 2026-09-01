import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import XLSX from 'xlsx';

const direct=fs.readFileSync('index.html','utf8');
assert.match(direct,/<title>Magazzino NOVA · Teramo · V18<\/title>/);
assert.match(direct,/location:\['FILA SCAFFALE','FILA\/SCAFFALE','SCAFFALE FILA','SCAFFALE\/FILA','POSIZIONE','UBICAZIONE'\]/);
assert.doesNotMatch(direct,/hiddenBaseline=normalizeMasterRows/);
assert.match(direct,/rows:parsed\.rows,excelRows:parsed\.excelRows/);
assert.match(direct,/rowCount:parsed\.rowCount/);
assert.match(direct,/TableStyleMedium2/);
assert.match(direct,/name:spec\.key==='MAGAZZINO'\?'Tabella1'/);
assert.doesNotMatch(direct,/columns\.push\(\{name:base,filterButton:true\}\)/);

const start=direct.indexOf('const headerNorm=');
const end=direct.indexOf('\nconst identity=',start);
assert.ok(start>=0&&end>start,'Master parser code missing');
const parserCode=direct.slice(start,end);
const context=vm.createContext({
  XLSX,
  X:()=>XLSX,
  CONFIG:{states:['NUOVO','SCARICATO','USATO','DISMESSO','NON_CHIARO']},
  norm:value=>String(value??'').trim().toUpperCase(),
  normalizeArticle:value=>String(value??'').trim().toUpperCase().replace(/\s+/g,''),
  normalizeMasterRows:rows=>rows,
  Number,String,Set,Map,Math,console
});
vm.runInContext(`${parserCode};globalThis.__parse=parseMaster;globalThis.__detect=detectHeader`,context);
const wb=XLSX.utils.book_new();
const ws=XLSX.utils.aoa_to_sheet([
  ['SCAFFALE / FILA','BANCALE ','ARTICOLO','TAGLIA','NUOVO','SCARICATO','USATO','NOTE','DATA CONTROLLO QUANTITÀ'],
  [5,'','I01003UHF','L',111,0,0,'',''],
  [52,202,'I40909UHF','2XL',76,0,0,'',''],
  [7,99,'I000ZERO','M',0,0,0,'','']
]);
XLSX.utils.book_append_sheet(wb,ws,'MAGAZZINO');
const parsed=context.__parse(wb);
assert.equal(parsed.columns.location,0,'SCAFFALE / FILA must be detected as the combined location column');
assert.equal(parsed.rows.length,2,'only positive stock states belong to the active baseline');
assert.equal(parsed.rows[0].location,'5');
assert.equal(parsed.rows[1].location,'52');
assert.equal(parsed.excelRows.length,3,'zero-quantity physical rows must be preserved for future export mapping');
assert.equal(parsed.excelRows[2].quantity,0);
assert.equal(parsed.excelRows[2].sourceRow,3);
assert.equal(parsed.rowCount,3);

const script=(direct.match(/<script>([\s\S]*?)<\/script>/)||[])[1];
assert.ok(script,'application script missing');
new vm.Script(script,{filename:'nova-v18.js'});
console.log('NOVA V18 Master header + visible baseline reimport repair: OK');
