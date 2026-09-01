import fs from 'node:fs';

await import('./build-v14.mjs');

let html=fs.readFileSync('index.html','utf8');
const re=/async function enhanceWorkbookTables\(bytes,\{masterSheet='',masterHeaderRow=1,registryOnly=false\}=\{\}\)\{[\s\S]*?\n\}\nlet xlsxPromise=null;/;
if(!re.test(html))throw new Error('NOVA V15 build contract missing: V14 Excel finalizer');

const finalizer=`async function enhanceWorkbookTables(bytes,{masterSheet='',masterHeaderRow=1,registryOnly=false}={}){
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
    for(let c=1;c<=lastCol;c++){
      let base=String(excelText(headerRow.getCell(c).value)||\`COLONNA \${c}\`).trim()||\`COLONNA \${c}\`;
      const n=(seen.get(base)||0)+1;seen.set(base,n);if(n>1)base=\`\${base} (\${n})\`;columns.push({name:base,filterButton:true});
    }
    const rows=[];for(let r=spec.headerRow+1;r<=lastRow;r++){const row=[];for(let c=1;c<=lastCol;c++)row.push(excelText(ws.getCell(r,c).value));rows.push(row)}
    const protection=ws.sheetProtection?structuredClone(ws.sheetProtection):null;
    if(protection)ws.sheetProtection=null;
    if(typeof ws.getTables==='function'&&typeof ws.removeTable==='function'){
      for(const table of [...ws.getTables()]){const name=table?.name||table?.table?.name;if(name)ws.removeTable(name)}
    }
    ws.autoFilter=null;
    const table=ws.addTable({
      name:excelTableName(spec.key),
      ref:headerRow.getCell(1).address,
      headerRow:true,
      totalsRow:false,
      style:{theme:'TableStyleMedium4',showFirstColumn:false,showLastColumn:false,showRowStripes:true,showColumnStripes:false},
      columns,rows
    });
    if(table?.commit)table.commit();
    const headerFill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1D6B50'}},headerFont={bold:true,color:{argb:'FFFFFFFF'}},sage={type:'pattern',pattern:'solid',fgColor:{argb:'FFF1FAF4'}},cream={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF9ED'}},edge={style:'thin',color:{argb:'FFD8E5DD'}};
    for(let c=1;c<=lastCol;c++){const cell=ws.getCell(spec.headerRow,c);cell.fill=headerFill;cell.font=headerFont;cell.alignment={vertical:'middle',horizontal:'left'};cell.border={top:edge,left:edge,bottom:edge,right:edge}}
    for(let r=spec.headerRow+1;r<=lastRow;r++)for(let c=1;c<=lastCol;c++){const cell=ws.getCell(r,c);cell.fill=(r-spec.headerRow)%2?sage:cream;cell.border={top:edge,left:edge,bottom:edge,right:edge}}
    ws.autoFilter={from:{row:spec.headerRow,column:1},to:{row:Math.max(spec.headerRow,lastRow),column:lastCol}};
    ws.views=[{state:'frozen',ySplit:spec.headerRow,topLeftCell:\`A\${spec.headerRow+1}\`,activeCell:\`A\${spec.headerRow+1}\`}];
    for(let c=1;c<=lastCol;c++){let max=String(columns[c-1].name).length;for(let r=spec.headerRow+1;r<=Math.min(lastRow,spec.headerRow+300);r++)max=Math.max(max,String(excelText(ws.getCell(r,c).value)??'').length);ws.getColumn(c).width=Math.min(44,Math.max(11,max+2))}
    if(protection)ws.sheetProtection={...protection,autoFilter:true,sort:true,selectLockedCells:true,selectUnlockedCells:true};
  }
  return await book.xlsx.writeBuffer();
}
let xlsxPromise=null;`;

html=html.replace(re,finalizer);
html=html.replace('<title>Magazzino NOVA · Teramo · V14</title>','<title>Magazzino NOVA · Teramo · V15</title>');
html=html.split('EXPORT EXCEL V14').join('EXPORT EXCEL V15');
html=html.split('ricostruisce automaticamente tabelle Excel reali, intestazioni, filtri e range anche se il file importato li ha persi.').join('ricostruisce da zero le tabelle Excel reali, forza i filtri visibili, aggiorna il range e mantiene la protezione anche se il file importato li ha persi.');
fs.writeFileSync('index.html',html,'utf8');
console.log(`NOVA V15 Excel table rebuild generated: ${Buffer.byteLength(html)} bytes`);
