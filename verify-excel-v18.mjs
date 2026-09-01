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

const start=direct.indexOf('async function enhanceWorkbookTables');
const end=direct.indexOf('\nlet xlsxPromise=null;',start);
assert.ok(start>=0&&end>start,'Excel finalizer missing');
const fnCode=direct.slice(start,end);
const excelText=v=>{if(v==null)return'';if(v instanceof Date)return v;return typeof v==='object'&&v.result!=null?v.result:v};
const excelTableName=s=>('NOVA_'+String(s||'TABELLA').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_]/g,'_').replace(/^([^A-Za-z_])/,'T_$1')).slice(0,240);
const context=vm.createContext({ExcelJS,ensureExcelJs:async()=>ExcelJS,excelText,excelTableName,structuredClone,Map,String,Number,Math,Date,Array,Object,console});
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
const finalBook=new ExcelJS.Workbook();await finalBook.xlsx.load(finalBytes);
const ws=finalBook.getWorksheet('MAGAZZINO');assert.ok(ws);
const tables=ws.getTables();assert.equal(tables.length,1);
assert.equal(tables[0].table.name,'Tabella1');
assert.equal(tables[0].table.style?.theme,'TableStyleMedium2');
assert.equal(ws.getRow(1).height,28.5);
assert.equal(ws.getRow(2).height,15);
assert.ok(Math.abs(ws.getColumn(1).width-58.28515625)<0.01);
assert.ok(Math.abs(ws.getColumn(2).width-20.140625)<0.01);
assert.ok(Math.abs(ws.getColumn(3).width-40.140625)<0.01);
assert.equal(ws.getCell('A1').fill?.fgColor?.argb,'FF4472C4');
assert.equal(ws.getCell('A1').font?.color?.argb,'FFFFFFFF');
assert.equal(ws.getCell('A1').font?.bold,true);
assert.equal(ws.views?.[0]?.state,'frozen');
assert.equal(ws.views?.[0]?.ySplit,1);

const persisted=await finalBook.xlsx.writeBuffer();
const zip=await JSZip.loadAsync(persisted);
const tableFiles=Object.keys(zip.files).filter(n=>/^xl\/tables\/table\d+\.xml$/.test(n));
assert.equal(tableFiles.length,1);
const tableXml=await zip.file(tableFiles[0]).async('string');
assert.match(tableXml,/name="Tabella1"/);
assert.match(tableXml,/ref="A1:I4"/);
assert.match(tableXml,/<autoFilter ref="A1:I4"/);
assert.match(tableXml,/tableStyleInfo name="TableStyleMedium2"/);
assert.doesNotMatch(tableXml,/hiddenButton="1"/,'filter arrows must not be hidden');
assert.doesNotMatch(tableXml,/<filterColumn/,'default visible table filters must not be overridden');
assert.ok(/totalsRowShown="0"/.test(tableXml)||(!/totalsRowShown=/.test(tableXml)&&!/totalsRowCount=/.test(tableXml)),'totals row must be disabled');
const sheetXml=await zip.file('xl/worksheets/sheet1.xml').async('string');
assert.match(sheetXml,/<tableParts count="1">/);
assert.doesNotMatch(sheetXml,/<autoFilter ref=/,'reference-style Master relies on the table AutoFilter, not a second worksheet AutoFilter');
assert.match(sheetXml,/<pane[^>]*ySplit="1"/);

const protectedBook=new ExcelJS.Workbook(),pws=protectedBook.addWorksheet('MAGAZZINO');
pws.addRows(aoa);await pws.protect('test-password',{autoFilter:false,sort:false});
const protectedRaw=await protectedBook.xlsx.writeBuffer();
const protectedFinal=await enhance(protectedRaw,{masterSheet:'MAGAZZINO',masterHeaderRow:1});
const protectedCheck=new ExcelJS.Workbook();await protectedCheck.xlsx.load(protectedFinal);
const pfinal=protectedCheck.getWorksheet('MAGAZZINO');
assert.equal(pfinal.getTables().length,1);
assert.equal(pfinal.sheetProtection?.sheet,true);
assert.equal(pfinal.sheetProtection?.autoFilter,true);
assert.equal(pfinal.sheetProtection?.sort,true);
const pzip=await JSZip.loadAsync(protectedFinal),ptableFile=Object.keys(pzip.files).find(n=>/^xl\/tables\/table\d+\.xml$/.test(n));
const ptableXml=await pzip.file(ptableFile).async('string');
assert.doesNotMatch(ptableXml,/hiddenButton="1"/);
const psheetXml=await pzip.file('xl/worksheets/sheet1.xml').async('string');
assert.match(psheetXml,/<sheetProtection[^>]*sheet="1"/);
assert.match(psheetXml,/<sheetProtection[^>]*autoFilter="0"/);
assert.match(psheetXml,/<sheetProtection[^>]*sort="0"/);

console.log('NOVA V18 reference-style REAL Excel table + visible filters: OK');
