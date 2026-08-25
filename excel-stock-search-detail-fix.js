/* Excel CERCA_GIACENZE detail compatibility fix.
   Replaces FILTER spill with deterministic INDEX + AGGREGATE formulas in every
   visible cell and every matching row. The search sheet and the detail formulas
   are patched in the SAME workbook package before the final download. */
(function installExcelStockSearchDetailFix(){
  'use strict';
  if(window.WarehouseExcelStockSearchDetailFix)return;

  const VERSION='2026.08.25-search-detail-fix3';
  const SEARCH_SHEET='CERCA_GIACENZE';
  const DATA_SHEET='GIACENZE_RICERCA_DATI';
  const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const DOCREL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const parser=typeof DOMParser!=='undefined'?new DOMParser():null;
  const serializer=typeof XMLSerializer!=='undefined'?new XMLSerializer():null;

  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  function local(n){return n?.localName||n?.nodeName?.split(':').pop()||''}
  function kids(n,name){return [...(n?.childNodes||[])].filter(x=>x.nodeType===1&&(!name||local(x)===name))}
  function first(n,name){return kids(n,name)[0]||null}
  function parseXml(value){const d=parser.parseFromString(value,'application/xml');if(d.getElementsByTagName('parsererror')[0])throw new Error('XML Excel non valido');return d}
  function xmlText(d){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+serializer.serializeToString(d.documentElement)}
  function joinPath(base,target){if(!target)return '';if(target.startsWith('/'))return target.slice(1);const out=[];for(const p of `${base}/${target}`.split('/')){if(!p||p==='.')continue;if(p==='..')out.pop();else out.push(p)}return out.join('/')}
  function colName(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
  function colIndex(ref){const m=text(ref).match(/^([A-Z]+)\d+$/i);if(!m)return -1;let n=0;for(const c of m[1].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1}
  function cellIn(row,col){return kids(row,'c').find(c=>colIndex(c.getAttribute('r'))===col)||null}
  function clearCell(c){for(const ch of [...c.childNodes])if(ch.nodeType===1&&['v','f','is'].includes(local(ch)))c.removeChild(ch);c.removeAttribute('t')}
  function ensureCell(doc,row,col,rowNum){let c=cellIn(row,col);if(c)return c;c=doc.createElementNS(MAIN,'c');c.setAttribute('r',`${colName(col)}${rowNum}`);const next=kids(row,'c').find(x=>colIndex(x.getAttribute('r'))>col);if(next)row.insertBefore(c,next);else row.appendChild(c);return c}
  function ensureRow(doc,data,rowNum){let row=kids(data,'row').find(r=>Number(r.getAttribute('r')||0)===rowNum);if(row)return row;row=doc.createElementNS(MAIN,'row');row.setAttribute('r',String(rowNum));const next=kids(data,'row').find(r=>Number(r.getAttribute('r')||0)>rowNum);if(next)data.insertBefore(row,next);else data.appendChild(row);return row}
  function setFormula(doc,row,col,rowNum,formula,style=''){const c=ensureCell(doc,row,col,rowNum);clearCell(c);c.setAttribute('r',`${colName(col)}${rowNum}`);if(style)c.setAttribute('s',style);const f=doc.createElementNS(MAIN,'f');f.textContent=formula;c.appendChild(f)}
  function cellText(row,col){const c=cellIn(row,col);if(!c)return '';const t=c.getAttribute('t')||'';if(t==='inlineStr')return first(c,'is')?.textContent||'';return first(c,'v')?.textContent||''}

  function workbookSheets(workbookDoc,relsDoc){
    const rels=new Map(kids(relsDoc.documentElement,'Relationship').map(r=>[r.getAttribute('Id'),joinPath('xl',r.getAttribute('Target'))]));
    const sheets=first(workbookDoc.documentElement,'sheets'),map=new Map();
    for(const s of kids(sheets,'sheet')){const rid=s.getAttributeNS(DOCREL,'id')||s.getAttribute('r:id');map.set(s.getAttribute('name'),{el:s,path:rels.get(rid)||''})}
    return map;
  }

  function maxMatchesFromHelperRows(rows){
    const counts=new Map();let max=0;
    for(const r of rows||[]){const a=norm(r?.article),s=norm(r?.size);if(!a)continue;const k=a+'|'+s,n=(counts.get(k)||0)+1;counts.set(k,n);if(n>max)max=n}
    return max;
  }
  function detailOrdinal(row){return Math.max(1,Math.trunc(Number(row)||15)-14)}
  function detailIndexFormula(row,lastDataRow){
    const n=Math.max(2,Number(lastDataRow)||2),ds=`'${DATA_SHEET}'`,k=detailOrdinal(row);
    /* IMPORTANT: k is emitted as a literal number. Never use ROWS($A$15:A15)
       here: in column A that would reference the formula cell itself and create
       a circular reference which IFERROR would hide as an apparently empty row. */
    return `AGGREGATE(15,6,(ROW(${ds}!$C$2:$C$${n})-ROW(${ds}!$C$2)+1)/((${ds}!$C$2:$C$${n}=TRIM($B$3))*(${ds}!$D$2:$D$${n}=TRIM($B$4))),${k})`;
  }
  function detailFormula(sourceCol,row,lastDataRow){
    const n=Math.max(2,Number(lastDataRow)||2),ds=`'${DATA_SHEET}'`,letter=colName(Number(sourceCol)||0),idx=detailIndexFormula(row,n);
    return `IF(OR($B$3="",$B$4=""),"",IFERROR(INDEX(${ds}!$${letter}$2:$${letter}$${n},${idx}),""))`;
  }

  async function patchDetailSheet(zip){
    if(!parser||!serializer||!zip?.file)return false;
    const wbFile=zip.file('xl/workbook.xml'),relsFile=zip.file('xl/_rels/workbook.xml.rels');if(!wbFile||!relsFile)return false;
    const wbDoc=parseXml(await wbFile.async('string')),relsDoc=parseXml(await relsFile.async('string')),map=workbookSheets(wbDoc,relsDoc),search=map.get(SEARCH_SHEET),helper=map.get(DATA_SHEET);if(!search?.path||!helper?.path)return false;
    const sf=zip.file(search.path),hf=zip.file(helper.path);if(!sf||!hf)return false;
    const searchDoc=parseXml(await sf.async('string')),helperDoc=parseXml(await hf.async('string')),searchData=first(searchDoc.documentElement,'sheetData'),helperData=first(helperDoc.documentElement,'sheetData');if(!searchData||!helperData)return false;

    const helperRows=kids(helperData,'row').filter(r=>Number(r.getAttribute('r')||0)>=2),helperLast=Math.max(2,...helperRows.map(r=>Number(r.getAttribute('r')||0)));
    const parsed=helperRows.map(r=>({article:cellText(r,2),size:cellText(r,3)})),detailCount=Math.max(1,maxMatchesFromHelperRows(parsed)),lastDetail=14+detailCount;
    const templateRow=kids(searchData,'row').find(r=>Number(r.getAttribute('r')||0)===15),bodyStyle=cellIn(templateRow,0)?.getAttribute('s')||'',headerRow=kids(searchData,'row').find(r=>Number(r.getAttribute('r')||0)===14),numberStyle=cellIn(headerRow,5)?.getAttribute('s')||bodyStyle;

    for(let rn=15;rn<=lastDetail;rn++){
      const row=ensureRow(searchDoc,searchData,rn);
      for(let col=0;col<7;col++)setFormula(searchDoc,row,col,rn,detailFormula(col,rn,helperLast),col===5?numberStyle:bodyStyle);
    }
    for(const row of [...kids(searchData,'row')]){const rn=Number(row.getAttribute('r')||0);if(rn>lastDetail)searchData.removeChild(row)}
    const dim=first(searchDoc.documentElement,'dimension');if(dim)dim.setAttribute('ref',`A1:G${lastDetail}`);
    zip.file(search.path,xmlText(searchDoc));return true;
  }

  async function patchSearchAndDetailSamePackage(zip){
    const searchApi=window.WarehouseExcelStockSearch;
    if(!searchApi?.patchWorkbookSearchSheets)return false;
    await searchApi.patchWorkbookSearchSheets(zip);
    return await patchDetailSheet(zip);
  }

  function install(){
    if(!window.JSZip?.prototype?.generateAsync||!parser||!serializer)return false;
    const base=JSZip.prototype.generateAsync;if(base.__warehouseExcelStockSearchDetailFix)return true;
    const previous=base.__warehousePrevious||base;
    const wrapped=async function(options,onUpdate){
      if(String(options?.type||'').toLowerCase()==='blob'&&this.file?.('xl/workbook.xml')){
        try{
          const changed=await patchSearchAndDetailSamePackage(this);
          if(changed)return await previous.call(this,options,onUpdate);
        }catch(e){console.error('Correzione dettaglio CERCA_GIACENZE',e)}
      }
      return base.call(this,options,onUpdate);
    };
    wrapped.__warehouseExcelStockSearchDetailFix=true;wrapped.__warehousePrevious=base;JSZip.prototype.generateAsync=wrapped;return true;
  }

  window.WarehouseExcelStockSearchDetailFix={version:VERSION,maxMatchesFromHelperRows,detailOrdinal,detailIndexFormula,detailFormula,patchDetailSheet,patchSearchAndDetailSamePackage,install};
  if(typeof document!=='undefined')install();
})();