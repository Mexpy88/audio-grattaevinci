import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

const wb=new ExcelJS.Workbook();
const ws=wb.addWorksheet('MAGAZZINO');
ws.addRow(['SCAFFALE / FILA','BANCALE','ARTICOLO','TAGLIA','NUOVO','SCARICATO','USATO','NOTE']);
ws.addRow(['1','A','I0001','M',10,0,0,'']);
ws.addRow(['1','A','I0002','L',5,2,0,'']);
ws.addTable({
  name:'NOVA_MAGAZZINO',
  ref:'A1',
  headerRow:true,
  totalsRow:false,
  style:{theme:'TableStyleMedium4',showFirstColumn:false,showLastColumn:false,showRowStripes:true,showColumnStripes:false},
  columns:['SCAFFALE / FILA','BANCALE','ARTICOLO','TAGLIA','NUOVO','SCARICATO','USATO','NOTE'].map(name=>({name})),
  rows:[['1','A','I0001','M',10,0,0,''],['1','A','I0002','L',5,2,0,'']]
});
ws.autoFilter={from:{row:1,column:1},to:{row:3,column:8}};
const buf=await wb.xlsx.writeBuffer();

const check=new ExcelJS.Workbook();
await check.xlsx.load(buf);
const sheet=check.getWorksheet('MAGAZZINO');
assert.ok(sheet,'MAGAZZINO missing after roundtrip');
assert.ok((sheet.model.tables||[]).length===1,'Excel structured table missing after roundtrip');
assert.equal(sheet.model.tables[0].name,'NOVA_MAGAZZINO');
assert.ok(sheet.autoFilter,'AutoFilter missing after roundtrip');
assert.equal(sheet.getCell('C2').value,'I0001');
console.log('ExcelJS structured table + filter roundtrip: OK');
