import fs from 'node:fs';
const fix=fs.readFileSync('xlsx-download-fix.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const checks=[
  ['official XLSX MIME',/application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/],
  ['wraps JSZip generateAsync',/JSZip\.prototype\.generateAsync=generateAsyncFixed/],
  ['generates uint8array before Blob',/opts\.type='uint8array'/],
  ['creates Excel Blob',/new Blob\(\[bytes\],\{type:XLSX_MIME\}\)/],
  ['index loads XLSX fix before exporter',/xlsxDownloadFixJs[\s\S]*localMasterOoxmlJs/]
];
const missing=[];
for(const [name,re] of checks){const src=name.startsWith('index')?index:fix;if(!re.test(src))missing.push(name)}
if(missing.length){console.error('XLSX download integrity FAILED:',missing.join(', '));process.exit(1)}
console.log('XLSX download integrity OK: exported workbook keeps .xlsx semantics and official Excel MIME.');
