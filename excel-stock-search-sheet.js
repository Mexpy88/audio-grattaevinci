/* Excel CERCA_GIACENZE — dynamic article+size lookup in exported workbook.
   Adds a visible CERCA_GIACENZE sheet and a veryHidden GIACENZE_RICERCA_DATI helper.
   Does not alter the official MAGAZZINO A:I structure or app stock semantics. */
(function installExcelStockSearchSheet(){
  'use strict';
  if(window.WarehouseExcelStockSearch)return;

  const VERSION='2026.08.24-search-sheet1';
  const SEARCH_SHEET='CERCA_GIACENZE';
  const DATA_SHEET='GIACENZE_RICERCA_DATI';
  const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const DOCREL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const PKGREL='http://schemas.openxmlformats.org/package/2006/relationships';
  const CT='http://schemas.openxmlformats.org/package/2006/content-types';
  const WORKSHEET_REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
  const WORKSHEET_CT='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
  const VALID_STATES=['NUOVO','USATO','SCARICATO'];
  const STATE_ORDER={NUOVO:0,USATO:1,SCARICATO:2,DISMESSO:3};
  const parser=typeof DOMParser!=='undefined'?new DOMParser():null;
  const serializer=typeof XMLSerializer!=='undefined'?new XMLSerializer():null;

  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const article=v=>window.WarehouseMasterSchemaV4?.normalizeArticle?.(v)||norm(v);
  const locationOfRow=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const isDismissed=(loc,pal)=>/DISMESS/i.test(`${text(loc)} ${text(pal)}`);
  const mergeNote=(a,b)=>[...new Set([text(a).trim(),text(b).trim()].filter(Boolean))].join(' | ');
  const xmlEsc=v=>text(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

  function buildSearchRows(source){
    const map=new Map();
    for(const r of (source||[])){
      const q=Number(r?.quantity||0);if(!(q>0))continue;
      const a=article(r?.article_base),s=norm(r?.size),loc=locationOfRow(r),pal=norm(r?.bancale),rawState=norm(r?.state);
      if(!a||!VALID_STATES.includes(rawState))continue;
      const state=isDismissed(loc,pal)?'DISMESSO':rawState;
      const k=[loc,pal,a,s,state].join('|');
      if(!map.has(k))map.set(k,{location:loc,pallet:pal,article:a,size:s,state,quantity:0,note:''});
      const x=map.get(k);x.quantity+=q;x.note=mergeNote(x.note,r?.master_note||r?.note||'');
    }
    return [...map.values()].sort((a,b)=>(a.article.localeCompare(b.article)||a.size.localeCompare(b.size)||(STATE_ORDER[a.state]??99)-(STATE_ORDER[b.state]??99)||a.location.localeCompare(b.location)||a.pallet.localeCompare(b.pallet)));
  }

  function dataRowsArray(source){return buildSearchRows(source).map(r=>[r.location,r.pallet,r.article,r.size,r.state,Number(r.quantity||0),r.note])}

  function searchFormulas(lastDataRow){
    const n=Math.max(2,Number(lastDataRow)||2),ds=`'${DATA_SHEET}'`;
    const sumFor=row=>`IF(OR($B$3="",$B$4=""),"",SUMIFS(${ds}!$F$2:$F$${n},${ds}!$C$2:$C$${n},TRIM($B$3),${ds}!$D$2:$D$${n},TRIM($B$4),${ds}!$E$2:$E$${n},$A$${row}))`;
    const detail=`IF(OR($B$3="",$B$4=""),"INSERISCI ARTICOLO E TAGLIA",_xlfn._xlws.FILTER(${ds}!$A$2:$G$${n},(${ds}!$C$2:$C$${n}=TRIM($B$3))*(${ds}!$D$2:$D$${n}=TRIM($B$4)),"NESSUNA GIACENZA"))`;
    return {B7:sumFor(7),B8:sumFor(8),B9:sumFor(9),B10:sumFor(10),B11:'IF(OR($B$3="",$B$4=""),"",SUM($B$7:$B$10))',A15:detail};
  }

  function colName(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
  function local(n){return n?.localName||n?.nodeName?.split(':').pop()||''}
  function kids(n,name){return [...(n?.childNodes||[])].filter(x=>x.nodeType===1&&(!name||local(x)===name))}
  function first(n,name){return kids(n,name)[0]||null}
  function parseXml(value){const d=parser.parseFromString(value,'application/xml');if(d.getElementsByTagName('parsererror')[0])throw new Error('XML Excel non valido');return d}
  function xmlText(d){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+serializer.serializeToString(d.documentElement)}
  function dir(path){const i=path.lastIndexOf('/');return i<0?'':path.slice(0,i)}
  function joinPath(base,target){if(!target)return '';if(target.startsWith('/'))return target.slice(1);const out=[];for(const p of `${base}/${target}`.split('/')){if(!p||p==='.')continue;if(p==='..')out.pop();else out.push(p)}return out.join('/')}
  function colIndex(ref){const m=text(ref).match(/^([A-Z]+)\d+$/i);if(!m)return -1;let n=0;for(const c of m[1].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1}
  function cellIn(row,col){return kids(row,'c').find(c=>colIndex(c.getAttribute('r'))===col)||null}

  function workbookContext(workbookDoc,relsDoc){
    const relMap=new Map(kids(relsDoc.documentElement,'Relationship').map(r=>[r.getAttribute('Id'),joinPath('xl',r.getAttribute('Target'))]));
    const sheets=first(workbookDoc.documentElement,'sheets'),map=new Map();
    for(const s of kids(sheets,'sheet')){const rid=s.getAttributeNS(DOCREL,'id')||s.getAttribute('r:id'),path=relMap.get(rid)||'';map.set(s.getAttribute('name'),{el:s,rid,path,sheetId:Number(s.getAttribute('sheetId')||0)})}
    return {sheets,map};
  }
  function nextSheetPath(ctx){let n=1;for(const s of ctx.map.values()){const m=text(s.path).match(/sheet(\d+)\.xml$/i);if(m)n=Math.max(n,Number(m[1])+1)}return `xl/worksheets/sheet${n}.xml`}
  function nextRelId(relsDoc){let n=1;for(const r of kids(relsDoc.documentElement,'Relationship')){const m=text(r.getAttribute('Id')).match(/^rId(\d+)$/i);if(m)n=Math.max(n,Number(m[1])+1)}return `rId${n}`}
  function nextSheetId(ctx){return Math.max(0,...[...ctx.map.values()].map(x=>Number(x.sheetId||0)))+1}
  function ensureContentType(ctDoc,path){const part='/'+path;if(kids(ctDoc.documentElement,'Override').some(o=>o.getAttribute('PartName')===part))return;const o=ctDoc.createElementNS(CT,'Override');o.setAttribute('PartName',part);o.setAttribute('ContentType',WORKSHEET_CT);ctDoc.documentElement.appendChild(o)}
  function ensureCalc(workbookDoc){let calc=first(workbookDoc.documentElement,'calcPr');if(!calc){calc=workbookDoc.createElementNS(MAIN,'calcPr');workbookDoc.documentElement.appendChild(calc)}calc.setAttribute('calcMode','auto');calc.setAttribute('fullCalcOnLoad','1');calc.setAttribute('forceFullCalc','1')}

  async function upsertSheet(zip,name,content,state,ctx,relsDoc,ctDoc){
    let item=ctx.map.get(name);
    if(!item){
      const path=nextSheetPath(ctx),rid=nextRelId(relsDoc),sid=nextSheetId(ctx),rel=relsDoc.createElementNS(PKGREL,'Relationship');
      rel.setAttribute('Id',rid);rel.setAttribute('Type',WORKSHEET_REL);rel.setAttribute('Target',path.replace(/^xl\//,''));relsDoc.documentElement.appendChild(rel);
      const s=ctx.sheets.ownerDocument.createElementNS(MAIN,'sheet');s.setAttribute('name',name);s.setAttribute('sheetId',String(sid));s.setAttributeNS(DOCREL,'r:id',rid);ctx.sheets.appendChild(s);
      item={el:s,rid,path,sheetId:sid};ctx.map.set(name,item);ensureContentType(ctDoc,path);
    }
    if(state)item.el.setAttribute('state',state);else item.el.removeAttribute('state');zip.file(item.path,content);return item;
  }
  function moveAfter(ctx,name,afterName){const item=ctx.map.get(name),after=ctx.map.get(afterName);if(!item?.el||!after?.el||item.el===after.el)return;const list=kids(ctx.sheets,'sheet'),i=list.indexOf(after.el),next=list[i+1];ctx.sheets.removeChild(item.el);if(next&&next!==item.el)ctx.sheets.insertBefore(item.el,next);else ctx.sheets.appendChild(item.el)}

  async function mainStyles(zip,ctx){
    const name=db?.master?.sheet||'MAGAZZINO',item=ctx.map.get(name)||ctx.map.get('MAGAZZINO');if(!item?.path)return {header:'',body:'',number:''};const sf=zip.file(item.path);if(!sf)return {header:'',body:'',number:''};
    try{const d=parseXml(await sf.async('string')),data=first(d.documentElement,'sheetData'),rows=kids(data,'row'),r1=rows.find(r=>Number(r.getAttribute('r'))===1)||rows[0],r2=rows.find(r=>Number(r.getAttribute('r'))===2)||rows[1];return {header:cellIn(r1,0)?.getAttribute('s')||'',body:cellIn(r2,2)?.getAttribute('s')||'',number:cellIn(r2,4)?.getAttribute('s')||cellIn(r2,2)?.getAttribute('s')||''}}catch{return {header:'',body:'',number:''}}
  }

  function cellXml(ref,value,style='',kind='string'){
    const sa=style?` s="${xmlEsc(style)}"`:'';
    if(kind==='blank')return `<c r="${ref}"${sa}/>`;
    if(kind==='number')return `<c r="${ref}"${sa}><v>${Number(value)||0}</v></c>`;
    if(kind==='formula')return `<c r="${ref}"${sa}><f>${xmlEsc(value)}</f></c>`;
    return `<c r="${ref}" t="inlineStr"${sa}><is><t${/^\s|\s$/.test(text(value))?' xml:space="preserve"':''}>${xmlEsc(value)}</t></is></c>`;
  }

  function helperSheetXml(rows,styles={}){
    const headers=['FILA / SCAFFALE','BANCALE','ARTICOLO','TAGLIA','STATO','QUANTITÀ','NOTE'],all=[headers,...rows],last=Math.max(1,all.length),cols=[18,18,28,12,16,14,42].map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
    const body=all.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>cellXml(`${colName(ci)}${ri+1}`,v,ri===0?styles.header:(ci===5?styles.number:styles.body),typeof v==='number'?'number':'string')).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${MAIN}" xmlns:r="${DOCREL}"><dimension ref="A1:G${last}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${body}</sheetData><autoFilter ref="A1:G${last}"/></worksheet>`;
  }

  function searchSheetXml(lastDataRow,styles={}){
    const f=searchFormulas(lastDataRow),rows=[];
    const row=(n,cells)=>rows.push(`<row r="${n}">${cells.join('')}</row>`);
    row(1,[cellXml('A1','CERCA GIACENZE MAGAZZINO',styles.header)]);
    row(2,[cellXml('A2','INSERISCI ARTICOLO E TAGLIA: I TOTALI E LE POSIZIONI SI AGGIORNANO AUTOMATICAMENTE.',styles.body)]);
    row(3,[cellXml('A3','ARTICOLO',styles.header),cellXml('B3','',styles.body,'blank')]);
    row(4,[cellXml('A4','TAGLIA',styles.header),cellXml('B4','',styles.body,'blank')]);
    row(6,[cellXml('A6','STATO',styles.header),cellXml('B6','TOTALE',styles.header)]);
    for(const [n,state] of [[7,'NUOVO'],[8,'USATO'],[9,'SCARICATO'],[10,'DISMESSO']])row(n,[cellXml(`A${n}`,state,styles.body),cellXml(`B${n}`,f[`B${n}`],styles.number,'formula')]);
    row(11,[cellXml('A11','TOTALE GENERALE',styles.header),cellXml('B11',f.B11,styles.number,'formula')]);
    row(12,[cellXml('A12','NOTA: DISMESSO = GIACENZA IN UNA FILA O BANCALE/CARRELLO CHE CONTIENE LA PAROLA “DISMESS”.',styles.body)]);
    row(14,['FILA / SCAFFALE','BANCALE','ARTICOLO','TAGLIA','STATO','QUANTITÀ','NOTE'].map((v,i)=>cellXml(`${colName(i)}14`,v,styles.header)));
    row(15,[cellXml('A15',f.A15,styles.body,'formula')]);
    const cols=[18,18,28,12,16,14,42].map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${MAIN}" xmlns:r="${DOCREL}"><dimension ref="A1:G15"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="14" topLeftCell="A15" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="B3" sqref="B3"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${cols}</cols><sheetData>${rows.join('')}</sheetData><mergeCells count="3"><mergeCell ref="A1:G1"/><mergeCell ref="A2:G2"/><mergeCell ref="A12:G12"/></mergeCells></worksheet>`;
  }

  async function patchWorkbookSearchSheets(zip){
    if(!parser||!serializer||!zip?.file)return false;
    const wbFile=zip.file('xl/workbook.xml'),relsFile=zip.file('xl/_rels/workbook.xml.rels'),ctFile=zip.file('[Content_Types].xml');if(!wbFile||!relsFile||!ctFile)return false;
    const stock=typeof stockBuckets==='function'?stockBuckets():[];const dataRows=dataRowsArray(stock);
    const workbookDoc=parseXml(await wbFile.async('string')),relsDoc=parseXml(await relsFile.async('string')),ctDoc=parseXml(await ctFile.async('string')),ctx=workbookContext(workbookDoc,relsDoc),styles=await mainStyles(zip,ctx);
    await upsertSheet(zip,DATA_SHEET,helperSheetXml(dataRows,styles),'veryHidden',ctx,relsDoc,ctDoc);
    await upsertSheet(zip,SEARCH_SHEET,searchSheetXml(dataRows.length+1,styles),'',ctx,relsDoc,ctDoc);
    moveAfter(ctx,SEARCH_SHEET,db?.master?.sheet||'MAGAZZINO');ensureCalc(workbookDoc);
    zip.file('xl/workbook.xml',xmlText(workbookDoc));zip.file('xl/_rels/workbook.xml.rels',xmlText(relsDoc));zip.file('[Content_Types].xml',xmlText(ctDoc));return true;
  }

  function install(){
    if(!window.JSZip?.prototype?.generateAsync||!parser||!serializer)return false;const base=JSZip.prototype.generateAsync;if(base.__warehouseExcelStockSearch)return true;
    const wrapped=async function(options,onUpdate){
      if(String(options?.type||'').toLowerCase()==='blob'&&this.file?.('xl/workbook.xml')){try{await patchWorkbookSearchSheets(this)}catch(e){console.error('Creazione CERCA_GIACENZE',e)}}
      return base.call(this,options,onUpdate);
    };
    wrapped.__warehouseExcelStockSearch=true;wrapped.__warehousePrevious=base;JSZip.prototype.generateAsync=wrapped;return true;
  }

  window.WarehouseExcelStockSearch={version:VERSION,searchSheet:SEARCH_SHEET,dataSheet:DATA_SHEET,buildSearchRows,dataRowsArray,searchFormulas,helperSheetXml,searchSheetXml,patchWorkbookSearchSheets,install};
  if(typeof document!=='undefined')install();
})();
