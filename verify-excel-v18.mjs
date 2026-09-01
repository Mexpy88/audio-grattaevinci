import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import JSZip from 'jszip';

const direct=fs.readFileSync('index.html','utf8');
assert.match(direct,/<title>Magazzino NOVA · Teramo · V18<\/title>/);
assert.match(direct,/TableStyleMedium2/);
assert.doesNotMatch(direct,/TableStyleMedium4/);
assert.match(direct,/JSZIP_URL='https:\/\/cdn\.jsdelivr\.net\/npm\/jszip@3\.10\.1\/dist\/jszip\.min\.js'/);
assert.match(direct,/async function patchExcelTableXml/);
assert.match(direct,/totalsRowShown="1"\/g,'totalsRowShown="0"'/);
assert.match(direct,/hiddenButton="1"/);

const start=direct.indexOf('async function patchExcelTableXml');
const end=direct.indexOf('\nlet xlsxPromise=null;',start);
assert.ok(start>=0&&end>start,'Excel OOXML patcher/finalizer missing');
const fnCode=direct.slice(start,end);
const excelText=v=>{if(v==null)return'';if(v instanceof Date)return v;return typeof v==='object'&&v.result!=null?v.result:v};
const excelTableName=s=>('NOVA_'+String(s||'TABELLA').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_]/g,'_').replace(/^([^A-Za-z_])/,'T_$1')).slice(0,240);
const context=vm.createContext({ExcelJS,JSZip,ensureExcelJs:async()=>ExcelJS,ensureJsZip:async()=>JSZip,excelText,excelTableName,structuredClone,Map,String,Number,Math,Date,Array,Object,RegExp,console});
vm.runInContext(`${fnCode};globalThis.__enhance=enhanceWorkbookTables`,context);
const enhance=context.__enhance;

const aoa=[
  ['SCAFFALE / FILA','BANCALE','ARTICOLO','TAGLIA','NUOVO','SCARICATO','USATO','NOTE','DATA CONTROLLO QUANTITÀ'],
  [5,'','I01003UHF','L',111,'','','',''],
  [52,202,'I40909UHF','2XL',76,'','','',''],
  [52,202,'I40910UHF','M',55,'','','','']
];
const swb=XLSX.utils.book_new(),sws=XLSX.utils.aoa_to_sheet(aoa);
XLSX.utils.book_append_sheet(swb,sws,'MAGAZZINO');
const raw=XLSX.write(swb,{type:'buffer',bookType:'xlsx',compression:true});
const finalBytes=await enhance(raw,{masterSheet:'MAGAZZINO',masterHeaderRow:1});

/* The patched final package itself must remain readable. Never re-save it in this verifier, because that would reintroduce ExcelJS serialization defects. */
const readable=XLSX.read(finalBytes,{type:'array',raw:true});
assert.equal(readable.Sheets.MAGAZZINO.A2.v,5);
assert.equal(readable.Sheets.MAGAZZINO.A3.v,52);
assert.equal(readable.Sheets.MAGAZZINO.C2.v,'I01003UHF');

const finalBook=new ExcelJS.Workbook();await finalBook.xlsx.load(finalBytes);
const ws=finalBook.getWorksheet('MAGAZZINO');assert.ok(ws);
assert.equal(ws.getTables().length,1);
assert.equal(ws.getTables()[0].table.name,'Tabella1');
assert.equal(ws.getTables()[0].table.style?.theme,'TableStyleMedium2');
assert.equal(ws.getRow(1).height,28.5);
assert.equal(ws.getRow(2).height,15);
assert.ok(Math.abs(ws.getColumn(1).width-58.28515625)<0.01);
assert.ok(Math.abs(ws.getColumn(2).width-20.140625)<0.01);
assert.ok(Math.abs(ws.getColumn(3).width-40.140625)<0.01);
assert.equal(ws.views?.[0]?.state,'frozen');
assert.equal(ws.views?.[0]?.ySplit,1);

const zip=await JSZip.loadAsync(finalBytes);
const tableFiles=Object.keys(zip.files).filter(n=>/^xl\/tables\/table\d+\.xml$/.test(n));
assert.equal(tableFiles.length,1);
const tableXml=await zip.file(tableFiles[0]).async('string');
assert.match(tableXml,/name="Tabella1"/);
assert.match(tableXml,/ref="A1:I4"/);
assert.match(tableXml,/<autoFilter ref="A1:I4"/);
assert.match(tableXml,/tableStyleInfo name="TableStyleMedium2"/);
assert.match(tableXml,/totalsRowShown="0"/,'totals row must be disabled exactly like the reference file');
assert.doesNotMatch(tableXml,/hiddenButton="1"/,'filter arrows must not be hidden');
assert.doesNotMatch(tableXml,/<filterColumn/,'reference-style visible filter arrows require no hidden filterColumn overrides');
assert.doesNotMatch(tableXml,/totalsRowLabel=/);
assert.doesNotMatch(tableXml,/totalsRowFunction=/);
const sheetXml=await zip.file('xl/worksheets/sheet1.xml').async('string');
assert.match(sheetXml,/<tableParts count="1">/);
assert.doesNotMatch(sheetXml,/<autoFilter ref=/,'reference-style Master relies on the table AutoFilter, not a second worksheet AutoFilter');
assert.match(sheetXml,/<pane[^>]*ySplit="1"/);
assert.match(sheetXml,/<row r="1"[^>]*ht="28\.5"/);
assert.match(sheetXml,/<row r="2"[^>]*ht="15"/);
assert.match(sheetXml,/<col min="1" max="1" width="58\.28515625"/);

/* Protected sheets must keep their protection and explicitly permit table filtering/sorting. */
const protectedBook=new ExcelJS.Workbook(),pws=protectedBook.addWorksheet('MAGAZZINO');
pws.addRows(aoa);await pws.protect('test-password',{autoFilter:false,sort:false});
const protectedRaw=await protectedBook.xlsx.writeBuffer();
const protectedFinal=await enhance(protectedRaw,{masterSheet:'MAGAZZINO',masterHeaderRow:1});
const pzip=await JSZip.loadAsync(protectedFinal),ptableFile=Object.keys(pzip.files).find(n=>/^xl\/tables\/table\d+\.xml$/.test(n));
const ptableXml=await pzip.file(ptableFile).async('string');
assert.match(ptableXml,/totalsRowShown="0"/);
assert.doesNotMatch(ptableXml,/hiddenButton="1"/);
assert.doesNotMatch(ptableXml,/<filterColumn/);
const psheetXml=await pzip.file('xl/worksheets/sheet1.xml').async('string');
assert.match(psheetXml,/<sheetProtection[^>]*sheet="1"/);
assert.match(psheetXml,/<sheetProtection[^>]*autoFilter="0"/);
assert.match(psheetXml,/<sheetProtection[^>]*sort="0"/);
assert.match(psheetXml,/<tableParts count="1">/);

console.log('NOVA V18 final OOXML matches reference table behavior: visible filters + no totals + Medium2: OK');
