import fs from 'node:fs';

await import('./build-v17.mjs');

let html=fs.readFileSync('index.html','utf8');
const mustReplace=(from,to,label)=>{if(!html.includes(from))throw new Error(`NOVA V18 build contract missing: ${label}`);html=html.replace(from,to)};
const mustRegex=(re,to,label)=>{if(!re.test(html))throw new Error(`NOVA V18 build contract missing: ${label}`);html=html.replace(re,to)};

mustReplace('<title>Magazzino NOVA · Teramo · V17</title>','<title>Magazzino NOVA · Teramo · V18</title>','V18 title');

/* The real Master uses SCAFFALE / FILA. Header detection must be order-independent for the combined location column. */
mustReplace(
  "location:['FILA SCAFFALE','FILA/SCAFFALE','POSIZIONE']",
  "location:['FILA SCAFFALE','FILA/SCAFFALE','SCAFFALE FILA','SCAFFALE/FILA','POSIZIONE','UBICAZIONE']",
  'SCAFFALE / FILA alias'
);

/* Preserve every physical Master row for future exports, including rows whose quantities are currently all zero. */
const parseMaster=`function parseMaster(wb){const sheetName=wb.SheetNames.includes('MAGAZZINO')?'MAGAZZINO':wb.SheetNames.find(n=>!['APP_DATI','NOVA_DATI'].includes(n))||wb.SheetNames[0],ws=wb.Sheets[sheetName];if(!ws)throw new Error('Foglio Master non trovato.');const matrix=X().utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:false}),det=detectHeader(matrix),mode=det.cols.state>=0&&det.cols.quantity>=0?'long':'wide',rows=[],excelRows=[];
  for(let r=det.row+1;r<matrix.length;r++){const row=matrix[r]||[],article=normalizeArticle(row[det.cols.article]);if(!article)continue;const size=det.cols.size>=0?norm(row[det.cols.size]):'',location=readLocation(row,det.cols),pallet=det.cols.pallet>=0?norm(row[det.cols.pallet]):'',description=det.cols.description>=0?String(row[det.cols.description]||'').trim():'';
    if(mode==='long'){const state=norm(row[det.cols.state]),quantity=Number(row[det.cols.quantity]||0)||0;if(!state)continue;const rec={article,size,state,quantity,location,pallet,description,sourceRow:r};excelRows.push(rec);if(quantity)rows.push(rec)}
    else{let found=false;for(const state of CONFIG.states){const c=det.cols[state];if(c<0)continue;const quantity=Number(row[c]||0)||0;if(quantity){const rec={article,size,state,quantity,location,pallet,description,sourceRow:r};rows.push(rec);excelRows.push(rec);found=true}}if(!found)excelRows.push({article,size,state:'NUOVO',quantity:0,location,pallet,description,sourceRow:r})}
  }
  return{rows:normalizeMasterRows(rows),excelRows:normalizeMasterRows(excelRows),sheetName,headerRow:det.row,columns:det.cols,mode,rowCount:Math.max(0,matrix.length-det.row-1)}}`;
mustRegex(/function parseMaster\(wb\)\{[\s\S]*?\n\}/,parseMaster,'Master parser preserving zero rows');

/* A NOVA reimport must use the visible MAGAZZINO sheet as the new stock baseline. Hidden history is retained, identity/version are preserved, but stale hidden positions may never overwrite the repaired physical sheet. */
mustRegex(
  /if\(restoreHistory&&nova\?\.db\)\{[\s\S]*?\n    \}else if\(restoreHistory&&legacy\?\.db\)\{/,
  `if(restoreHistory&&nova?.db){
      next={...createEmptyDb(),...clone(nova.db)};
      next.ledger=(next.ledger||[]).map(e=>({...e,affectsStock:false}));
      next.master={...createEmptyDb().master,...(next.master||{}),rows:parsed.rows,excelRows:parsed.excelRows,filename:file.name,sheetName:parsed.sheetName,importedAt,headerRow:parsed.headerRow,columns:parsed.columns,mode:parsed.mode,rowCount:parsed.rowCount,source:'NOVA_REIMPORT',masterId:next.master?.masterId||masterIdFor(file.name,importedAt),version:Math.max(1,Number(next.master?.version)||1),versionAt:next.master?.versionAt||next.master?.importedAt||importedAt};
    }else if(restoreHistory&&legacy?.db){`,
  'NOVA reimport visible baseline'
);
html=html.split('rows:parsed.rows,excelRows:parsed.rows').join('rows:parsed.rows,excelRows:parsed.excelRows');
html=html.split("mode:parsed.mode,source:'REMOTO_XLSX_MIGRATION',masterId:").join("mode:parsed.mode,rowCount:parsed.rowCount,source:'REMOTO_XLSX_MIGRATION',masterId:");
html=html.split("mode:parsed.mode,source:'FRESH_IMPORT',masterId:").join("mode:parsed.mode,rowCount:parsed.rowCount,source:'FRESH_IMPORT',masterId:");
mustReplace("{rows:parsed.rows.length,source:next.master.source,masterId:next.master.masterId,version:next.master.version}","{rows:parsed.rowCount,stockRows:parsed.rows.length,source:next.master.source,masterId:next.master.masterId,version:next.master.version}",'Master import audit row counts');
mustReplace("return{rows:parsed.rows.length,source:next.master.source,filename:file.name,restored:!!(nova||legacy)}","return{rows:parsed.rowCount,stockRows:parsed.rows.length,source:next.master.source,filename:file.name,restored:!!(nova||legacy)}",'Master import result row count');

/* ExcelJS 4.4 serializes hidden table filter buttons and totalsRowShown incorrectly for our reference contract. Load JSZip only during export, then normalize the final OOXML package. */
mustReplace(
  "const EXCELJS_URL='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';\nconst X=()=>globalThis.XLSX;",
  "const EXCELJS_URL='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';\nconst JSZIP_URL='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';\nconst X=()=>globalThis.XLSX;\nconst JZ=()=>globalThis.JSZip;",
  'JSZip export engine URL'
);
mustReplace(
  "const excelText=v=>",
  `let jsZipPromise=null;
async function ensureJsZip(){
  if(JZ())return JZ();
  if(typeof document==='undefined')throw new Error('Motore pacchetto Excel non disponibile.');
  if(!jsZipPromise)jsZipPromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-nova-jszip]');
    if(existing){existing.addEventListener('load',()=>JZ()?resolve(JZ()):reject(new Error('Motore pacchetto Excel non disponibile.')),{once:true});existing.addEventListener('error',()=>reject(new Error('Impossibile caricare il motore pacchetto Excel.')),{once:true});return}
    const s=document.createElement('script');s.src=JSZIP_URL;s.async=true;s.dataset.novaJszip='1';s.onload=()=>JZ()?resolve(JZ()):reject(new Error('Motore pacchetto Excel non disponibile.'));s.onerror=()=>reject(new Error('Impossibile caricare il motore pacchetto Excel. Verifica la connessione.'));document.head.appendChild(s);
  }).catch(e=>{jsZipPromise=null;throw e});
  return jsZipPromise;
}
const excelText=v=>`,
  'Lazy JSZip loader'
);

/* Rebuild Excel tables to match the user's reference workbook. */
const finalizerRe=/async function enhanceWorkbookTables\(bytes,\{masterSheet='',masterHeaderRow=1,registryOnly=false\}=\{\}\)\{[\s\S]*?\n\}\nlet xlsxPromise=null;/;
if(!finalizerRe.test(html))throw new Error('NOVA V18 build contract missing: Excel finalizer');
const finalizer=`async function patchExcelTableXml(buffer){
  const JSZip=await ensureJsZip(),zip=await JSZip.loadAsync(buffer),tableFiles=Object.keys(zip.files).filter(name=>/^xl\\/tables\\/table\\d+\\.xml$/.test(name));
  for(const name of tableFiles){const entry=zip.file(name);if(!entry)continue;let xml=await entry.async('string');xml=xml.replace(/totalsRowShown="1"/g,'totalsRowShown="0"').replace(/<filterColumn\\b[^>]*\\bhiddenButton="1"[^>]*\\/>/g,'').replace(/\\s+totalsRowLabel="Total"/g,'').replace(/\\s+totalsRowFunction="none"/g,'');zip.file(name,xml)}
  return await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}})
}
async function enhanceWorkbookTables(bytes,{masterSheet='',masterHeaderRow=1,registryOnly=false}={}){
  const ExcelJS=await ensureExcelJs(),book=new ExcelJS.Workbook();
  await book.xlsx.load(bytes);
  const specs=registryOnly
    ?[{sheet:'MOVIMENTI',headerRow:1,key:'MOVIMENTI'},{sheet:'AUDIT',headerRow:1,key:'AUDIT'}]
    :[
      {sheet:masterSheet||'MAGAZZINO',headerRow:Math.max(1,Number(masterHeaderRow)||1),key:'MAGAZZINO'},
      {sheet:'REGISTRO_MOVIMENTI',headerRow:1,key:'REGISTRO_MOVIMENTI'},
      {sheet:'ENTRATE_MERCI',headerRow:1,key:'ENTRATE_MERCI'},
      {sheet:'RICHIESTE',headerRow:1,key:'RICHIESTE'},
      {sheet:'SCARICHI',headerRow:1,key:'SCARICHI'},
      {sheet:'AUDIT',headerRow:1,key:'AUDIT'}
    ];
  for(const spec of specs){
    const ws=book.getWorksheet(spec.sheet);if(!ws)continue;
    const headerRow=ws.getRow(spec.headerRow),maxCols=Math.max(ws.columnCount,headerRow.cellCount||0);
    let lastCol=0;for(let c=1;c<=maxCols;c++){const v=excelText(headerRow.getCell(c).value);if(String(v??'').trim())lastCol=c}
    if(!lastCol)continue;
    let lastRow=Math.max(spec.headerRow,ws.actualRowCount||spec.headerRow);
    while(lastRow>spec.headerRow){let any=false;for(let c=1;c<=lastCol;c++){const v=excelText(ws.getCell(lastRow,c).value);if(v!==''&&v!=null){any=true;break}}if(any)break;lastRow--}
    const seen=new Map(),columns=[];
    for(let c=1;c<=lastCol;c++){let base=String(excelText(headerRow.getCell(c).value)||\`COLONNA \${c}\`).trim()||\`COLONNA \${c}\`;const n=(seen.get(base)||0)+1;seen.set(base,n);if(n>1)base=\`\${base} (\${n})\`;columns.push({name:base})}
    const rows=[];for(let r=spec.headerRow+1;r<=lastRow;r++){const row=[];for(let c=1;c<=lastCol;c++)row.push(excelText(ws.getCell(r,c).value));rows.push(row)}
    const protection=ws.sheetProtection?structuredClone(ws.sheetProtection):null;if(protection)ws.sheetProtection=null;
    if(typeof ws.getTables==='function'&&typeof ws.removeTable==='function'){for(const table of [...ws.getTables()]){const name=table?.name||table?.table?.name;if(name)ws.removeTable(name)}}
    ws.autoFilter=null;
    if(rows.length){const table=ws.addTable({name:spec.key==='MAGAZZINO'?'Tabella1':excelTableName(spec.key),ref:headerRow.getCell(1).address,headerRow:true,totalsRow:false,style:{theme:'TableStyleMedium2',showFirstColumn:false,showLastColumn:false,showRowStripes:true,showColumnStripes:false},columns,rows});if(table?.commit)table.commit()}
    ws.views=[{state:'frozen',ySplit:spec.headerRow,topLeftCell:\`A\${spec.headerRow+1}\`,activeCell:\`A\${spec.headerRow+1}\`}];
    if(spec.key==='MAGAZZINO'){
      const widths=[58.28515625,20.140625,40.140625,48.7109375,17.85546875,19,11.7109375,34.42578125,32];
      for(let c=1;c<=lastCol;c++)ws.getColumn(c).width=widths[c-1]||Math.min(44,Math.max(11,String(columns[c-1]?.name||'').length+2));
      headerRow.height=28.5;
      for(let r=spec.headerRow+1;r<=lastRow;r++)ws.getRow(r).height=15;
      const edge={style:'thin',color:{argb:'FF000000'}};
      for(let c=1;c<=lastCol;c++){const cell=ws.getCell(spec.headerRow,c);cell.font={name:'Calibri',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF4472C4'}};cell.alignment={vertical:'middle',horizontal:'left'};cell.border={left:edge}}
      for(let r=spec.headerRow+1;r<=lastRow;r++)for(let c=1;c<=lastCol;c++){const cell=ws.getCell(r,c);cell.font={name:'Calibri',size:11,color:{argb:'FF000000'}};cell.alignment={vertical:'middle',horizontal:'left'};cell.border={left:edge,top:edge}}
      if(lastCol>=9)ws.getColumn(9).numFmt='[$-F800]dddd\\,\\ mmmm\\ dd\\,\\ yyyy';
    }else{
      for(let c=1;c<=lastCol;c++){let max=String(columns[c-1]?.name||'').length;for(let r=spec.headerRow+1;r<=Math.min(lastRow,spec.headerRow+300);r++)max=Math.max(max,String(excelText(ws.getCell(r,c).value)??'').length);ws.getColumn(c).width=Math.min(44,Math.max(11,max+2))}
    }
    if(protection)ws.sheetProtection={...protection,autoFilter:true,sort:true,selectLockedCells:true,selectUnlockedCells:true};
  }
  const serialized=await book.xlsx.writeBuffer();
  return await patchExcelTableXml(serialized)
}
let xlsxPromise=null;`;
html=html.replace(finalizerRe,finalizer);
html=html.split('EXPORT EXCEL V15').join('EXPORT EXCEL V18');
html=html.split('ricostruisce da zero le tabelle Excel reali, forza i filtri visibili, aggiorna il range e mantiene la protezione anche se il file importato li ha persi.').join('ricostruisce il Master come vera Tabella Excel nello stesso stile del file di riferimento, con filtri visibili, range aggiornato e righe del Master preservate.');

fs.writeFileSync('index.html',html,'utf8');
console.log(`NOVA V18 Master repair + reference Excel table generated: ${Buffer.byteLength(html)} bytes`);
