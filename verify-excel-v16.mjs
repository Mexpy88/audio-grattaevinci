import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import JSZip from 'jszip';

const direct=fs.readFileSync('index.html','utf8');
assert.match(direct,/<title>Magazzino NOVA · Teramo · V16<\/title>/);
assert.match(direct,/columns\.push\(\{name:base,filterButton:true\}\)/);
assert.match(direct,/ws\.getTables\(\)/);
assert.match(direct,/ws\.removeTable\(name\)/);
assert.match(direct,/ws\.sheetProtection=\{\.\.\.protection,autoFilter:true,sort:true/);
assert.match(direct,/FF1D6B50/);
assert.match(direct,/FFF1FAF4/);
assert.match(direct,/FFFFF9ED/);
assert.match(direct,/EXPORT EXCEL V15/);

const start=direct.indexOf('async function enhanceWorkbookTables');
const end=direct.indexOf('\nlet xlsxPromise=null;',start);
assert.ok(start>=0&&end>start,'Excel finalizer missing from built app');
const fnCode=direct.slice(start,end);
const excelText=v=>{if(v==null)return'';if(v instanceof Date)return v;return typeof v==='object'&&v.result!=null?v.result:v};
const excelTableName=s=>('NOVA_'+String(s||'TABELLA').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_]/g,'_').replace(/^([^A-Za-z_])/,'T_$1')).slice(0,240);
const context=vm.createContext({ExcelJS,ensureExcelJs:async()=>ExcelJS,excelText,excelTableName,structuredClone,Map,String,Number,Math,Date,Array,Object,console});
vm.runInContext(`${fnCode};globalThis.__enhance=enhanceWorkbookTables`,context);
const enhance=context.__enhance;
assert.equal(typeof enhance,'function');

const aoa=[
  ['SCAFFALE / FILA','BANCALE','ARTICOLO','TAGLIA','NUOVO','SCARICATO','USATO','NOTE','DATA CONTROLLO QUANTITÀ'],
  ['1','','I30219UHF','2XL','','','','',''],
  ['1','','I30920NA','M',2,34,0,'',''],
  ['4','','I50821TRUHF','XL','',0,'','','']
];
const swb=XLSX.utils.book_new(),sws=XLSX.utils.aoa_to_sheet(aoa);
XLSX.utils.book_append_sheet(swb,sws,'MAGAZZINO');
const sheetJsBytes=XLSX.write(swb,{type:'buffer',bookType:'xlsx',compression:true});
const finalBytes=await enhance(sheetJsBytes,{masterSheet:'MAGAZZINO',masterHeaderRow:1});
const finalBook=new ExcelJS.Workbook();await finalBook.xlsx.load(finalBytes);
const ws=finalBook.getWorksheet('MAGAZZINO');assert.ok(ws,'MAGAZZINO missing');
const tables=ws.getTables();assert.equal(tables.length,1,'final workbook must contain exactly one structured table');
const table=tables[0];
assert.equal(table.table.name,'NOVA_MAGAZZINO');
assert.ok(table.table.columns.every(c=>c.filterButton!==false),'every table column must expose its filter button');
assert.ok(ws.autoFilter,'worksheet AutoFilter missing');
assert.equal(ws.getCell('A1').fill?.fgColor?.argb,'FF1D6B50');
assert.equal(ws.getCell('A2').fill?.fgColor?.argb,'FFF1FAF4');
assert.equal(ws.getCell('A3').fill?.fgColor?.argb,'FFFFF9ED');

const persisted=await finalBook.xlsx.writeBuffer();
const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(persisted);
assert.equal(reopened.getWorksheet('MAGAZZINO').getTables().length,1,'structured table lost after roundtrip');
const zip=await JSZip.loadAsync(persisted);
const tableFiles=Object.keys(zip.files).filter(n=>/^xl\/tables\/table\d+\.xml$/.test(n));
assert.equal(tableFiles.length,1,'OOXML table part missing');
const tableXml=await zip.file(tableFiles[0]).async('string');
assert.match(tableXml,/<autoFilter ref="A1:I4"/,'table AutoFilter range missing');
assert.match(tableXml,/tableStyleInfo name="TableStyleMedium4"/,'table style missing');
const sheetXml=await zip.file('xl/worksheets/sheet1.xml').async('string');
assert.match(sheetXml,/<tableParts count="1">/,'worksheet tableParts relationship missing');
assert.match(sheetXml,/<autoFilter ref="A1:I4"/,'worksheet AutoFilter missing');
const relsXml=await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
assert.match(relsXml,/relationships\/table/,'worksheet relationship to table missing');

const protectedBook=new ExcelJS.Workbook(),pws=protectedBook.addWorksheet('MAGAZZINO');
pws.addRows(aoa);await pws.protect('test-password',{autoFilter:false,sort:false});
const protectedRaw=await protectedBook.xlsx.writeBuffer();
const protectedFinal=await enhance(protectedRaw,{masterSheet:'MAGAZZINO',masterHeaderRow:1});
const protectedCheck=new ExcelJS.Workbook();await protectedCheck.xlsx.load(protectedFinal);
const pfinal=protectedCheck.getWorksheet('MAGAZZINO');
assert.equal(pfinal.getTables().length,1,'protected sheet must still contain a table');
assert.equal(pfinal.sheetProtection?.sheet,true,'sheet protection must survive');
assert.equal(pfinal.sheetProtection?.autoFilter,true,'protected sheet must allow AutoFilter');
assert.equal(pfinal.sheetProtection?.sort,true,'protected sheet must allow sorting');
const protectedZip=await JSZip.loadAsync(protectedFinal);
const protectedSheetXml=await protectedZip.file('xl/worksheets/sheet1.xml').async('string');
assert.match(protectedSheetXml,/<sheetProtection[^>]*sheet="1"/,'protected sheet OOXML missing');
assert.match(protectedSheetXml,/<sheetProtection[^>]*autoFilter="0"/,'protected sheet must explicitly allow filters');
assert.match(protectedSheetXml,/<sheetProtection[^>]*sort="0"/,'protected sheet must explicitly allow sorting');
assert.match(protectedSheetXml,/<tableParts count="1">/,'protected worksheet table relationship missing');

console.log('NOVA V16 preserves REAL SheetJS → ExcelJS → OOXML table export: OK');
