/* Rectification/export cleanup + global uppercase input policy.
   Keeps MASTER V4 as the source of truth and prevents quantity-only rectifications
   from exporting as old-row=0 + new-row=value duplicates. */
(function installRectificationUppercaseFix(){
  'use strict';
  if(window.WarehouseRectificationUppercaseFix)return;

  const VERSION='2026.08.24-rect-uppercase1';
  const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const DOCREL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const TABLE_REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/table';
  const parser=typeof DOMParser!=='undefined'?new DOMParser():null;
  const serializer=typeof XMLSerializer!=='undefined'?new XMLSerializer():null;
  let regenerating=false;

  const text=v=>String(v??'');
  const norm=v=>text(v).trim().toUpperCase();
  const articleKey=v=>window.WarehouseMasterSchemaV4?.normalizeArticle?.(v)||norm(v);
  const locOf=r=>norm(typeof locationOf==='function'?locationOf(r):(r?.fila_scaffale||r?.fila||''));
  const identityKey=(article,size,loc,pal)=>[articleKey(article),norm(size),norm(loc),norm(pal)].join('|');

  function currentIdentityQuantitiesV4(){
    const map=new Map();
    const rows=typeof stockBuckets==='function'?stockBuckets():[];
    for(const s of rows){
      const k=identityKey(s.article_base,s.size,locOf(s),s.bancale);
      if(!map.has(k))map.set(k,{article:articleKey(s.article_base),size:norm(s.size),location:locOf(s),pallet:norm(s.bancale),NUOVO:0,SCARICATO:0,USATO:0,note:text(s.master_note||'').trim()});
      const m=map.get(k),state=norm(s.state);if(['NUOVO','SCARICATO','USATO'].includes(state))m[state]+=Number(s.quantity||0);
      if(!m.note&&s.master_note)m.note=text(s.master_note).trim();
    }
    return map;
  }

  function parseXml(value){
    if(!parser)throw new Error('DOMParser non disponibile');
    const d=parser.parseFromString(value,'application/xml');
    if(d.getElementsByTagName('parsererror')[0])throw new Error('XML Excel non valido');
    return d;
  }
  function xmlText(d){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+serializer.serializeToString(d.documentElement)}
  function local(n){return n?.localName||n?.nodeName?.split(':').pop()||''}
  function kids(n,name){return [...(n?.childNodes||[])].filter(x=>x.nodeType===1&&(!name||local(x)===name))}
  function first(n,name){return kids(n,name)[0]||null}
  function dir(path){const i=path.lastIndexOf('/');return i<0?'':path.slice(0,i)}
  function joinPath(base,target){if(!target)return '';if(target.startsWith('/'))return target.slice(1);const out=[];for(const p of `${base}/${target}`.split('/')){if(!p||p==='.')continue;if(p==='..')out.pop();else out.push(p)}return out.join('/')}
  function sheetPath(workbook,rels,name){
    const relMap=new Map(kids(rels.documentElement,'Relationship').map(r=>[r.getAttribute('Id'),joinPath('xl',r.getAttribute('Target'))]));
    const sheets=first(workbook.documentElement,'sheets'),s=kids(sheets,'sheet').find(x=>x.getAttribute('name')===name);if(!s)return '';
    const id=s.getAttributeNS(DOCREL,'id')||s.getAttribute('r:id');return relMap.get(id)||'';
  }
  function colName(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
  function colIndex(ref){const m=text(ref).match(/^([A-Z]+)\d+$/i);if(!m)return -1;let n=0;for(const c of m[1].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1}
  function findCell(row,col){return kids(row,'c').find(c=>colIndex(c.getAttribute('r'))===col)||null}
  function sharedStrings(doc){if(!doc)return [];return kids(doc.documentElement,'si').map(si=>{let out='';const walk=n=>{for(const ch of n.childNodes||[]){if(ch.nodeType===1){if(local(ch)==='t')out+=ch.textContent||'';else walk(ch)}}};walk(si);return out})}
  function cellText(row,col,shared){const c=findCell(row,col);if(!c)return '';const t=c.getAttribute('t')||'';if(t==='inlineStr')return first(c,'is')?.textContent||'';const v=first(c,'v')?.textContent||'';if(t==='s')return shared[Number(v)]??'';return v}
  function clearValue(c){for(const ch of [...c.childNodes])if(ch.nodeType===1&&['v','f','is'].includes(local(ch)))c.removeChild(ch);c.removeAttribute('t')}
  function ensureCell(doc,row,col,rowNum){let c=findCell(row,col);if(c)return c;c=doc.createElementNS(MAIN,'c');c.setAttribute('r',`${colName(col)}${rowNum}`);const next=kids(row,'c').find(x=>colIndex(x.getAttribute('r'))>col);if(next)row.insertBefore(c,next);else row.appendChild(c);return c}
  function setNumber(doc,row,col,rowNum,value){const c=ensureCell(doc,row,col,rowNum);clearValue(c);c.setAttribute('r',`${colName(col)}${rowNum}`);const v=doc.createElementNS(MAIN,'v');v.textContent=String(Math.max(0,Number(value)||0));c.appendChild(v)}
  function setInline(doc,row,col,rowNum,value){const c=ensureCell(doc,row,col,rowNum);clearValue(c);c.setAttribute('r',`${colName(col)}${rowNum}`);c.setAttribute('t','inlineStr');const is=doc.createElementNS(MAIN,'is'),t=doc.createElementNS(MAIN,'t');t.textContent=text(value);is.appendChild(t);c.appendChild(is)}

  function updateRangeEnd(ref,lastRow){const m=text(ref).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);if(!m)return ref;return `${m[1]}${m[2]}:${m[3]}${Math.max(Number(m[2]),lastRow)}`}
  async function shrinkTrailingRanges(zip,sheetPathValue,doc,lastRow){
    const dim=first(doc.documentElement,'dimension');if(dim?.getAttribute('ref')?.includes(':'))dim.setAttribute('ref',updateRangeEnd(dim.getAttribute('ref'),lastRow));
    const af=first(doc.documentElement,'autoFilter');if(af?.getAttribute('ref'))af.setAttribute('ref',updateRangeEnd(af.getAttribute('ref'),lastRow));
    const relPath=`${dir(sheetPathValue)}/_rels/${sheetPathValue.slice(sheetPathValue.lastIndexOf('/')+1)}.rels`,rf=zip.file(relPath);if(!rf)return;
    const relDoc=parseXml(await rf.async('string'));
    for(const r of kids(relDoc.documentElement,'Relationship')){
      const type=r.getAttribute('Type')||'';if(type!==TABLE_REL&&!type.endsWith('/table'))continue;
      const tablePath=joinPath(dir(sheetPathValue),r.getAttribute('Target')),tf=zip.file(tablePath);if(!tf)continue;
      const td=parseXml(await tf.async('string')),root=td.documentElement,ref=root.getAttribute('ref');if(ref)root.setAttribute('ref',updateRangeEnd(ref,lastRow));const taf=first(root,'autoFilter');if(taf?.getAttribute('ref'))taf.setAttribute('ref',updateRangeEnd(taf.getAttribute('ref'),lastRow));zip.file(tablePath,xmlText(td));
    }
  }

  function removeDuplicateExportRowsV4(data,duplicates){for(const row of duplicates)if(row?.parentNode===data)data.removeChild(row)}

  async function consolidateMainSheetV4(zip){
    if(!window.WarehouseMasterSchemaV4||!db?.master?.rows?.length)return false;
    const wbFile=zip.file('xl/workbook.xml'),relFile=zip.file('xl/_rels/workbook.xml.rels');if(!wbFile||!relFile)return false;
    const wbDoc=parseXml(await wbFile.async('string')),relDoc=parseXml(await relFile.async('string'));
    const sheetName=db.master?.sheet||'MAGAZZINO',path=sheetPath(wbDoc,relDoc,sheetName)||sheetPath(wbDoc,relDoc,'MAGAZZINO');if(!path)return false;
    const sf=zip.file(path);if(!sf)return false;const doc=parseXml(await sf.async('string')),data=first(doc.documentElement,'sheetData');if(!data)return false;
    let shared=[];const ss=zip.file('xl/sharedStrings.xml');if(ss)shared=sharedStrings(parseXml(await ss.async('string')));
    const rows=kids(data,'row');let headerRow=0;
    for(const row of rows.slice(0,20)){const a=norm(cellText(row,0,shared)),b=norm(cellText(row,1,shared)),c=norm(cellText(row,2,shared)),d=norm(cellText(row,3,shared));if((a.includes('SCAFFALE')||a.includes('FILA'))&&b==='BANCALE'&&c==='ARTICOLO'&&d==='TAGLIA'){headerRow=Number(row.getAttribute('r')||0);break}}
    if(!headerRow)return false;

    const current=currentIdentityQuantitiesV4(),canonical=new Map(),duplicates=[];let changed=false;
    for(const row of rows){const rn=Number(row.getAttribute('r')||0);if(rn<=headerRow)continue;const article=text(cellText(row,2,shared)).trim();if(!article)continue;const size=norm(cellText(row,3,shared)),loc=norm(cellText(row,0,shared)),pal=norm(cellText(row,1,shared)),k=identityKey(article,size,loc,pal);
      if(canonical.has(k)){duplicates.push(row);changed=true;continue}canonical.set(k,row);
    }

    for(const [k,item] of current){const row=canonical.get(k);if(!row)continue;const rn=Number(row.getAttribute('r')||0);const before=[cellText(row,4,shared),cellText(row,5,shared),cellText(row,6,shared)].map(Number);const after=[item.NUOVO,item.SCARICATO,item.USATO].map(Number);if(before.some((v,i)=>Number(v||0)!==Number(after[i]||0)))changed=true;setNumber(doc,row,4,rn,item.NUOVO);setNumber(doc,row,5,rn,item.SCARICATO);setNumber(doc,row,6,rn,item.USATO);if(item.note)setInline(doc,row,7,rn,item.note)}

    if(duplicates.length)removeDuplicateExportRowsV4(data,duplicates);
    if(!changed)return false;
    const remaining=kids(data,'row'),lastRow=Math.max(headerRow,...remaining.map(r=>Number(r.getAttribute('r')||0)));await shrinkTrailingRanges(zip,path,doc,lastRow);zip.file(path,xmlText(doc));return true;
  }

  function installExportConsolidationV4(){
    if(!window.JSZip?.prototype?.generateAsync)return;const base=JSZip.prototype.generateAsync;if(base.__warehouseRectUppercaseFix)return;
    const wrapped=async function(options,onUpdate){
      const result=await base.call(this,options,onUpdate);if(regenerating||String(options?.type||'').toLowerCase()!=='blob'||!db?.master?.rows?.length)return result;
      try{const zip=await JSZip.loadAsync(result),changed=await consolidateMainSheetV4(zip);if(!changed)return result;regenerating=true;try{return await base.call(zip,options,onUpdate)}finally{regenerating=false}}
      catch(e){console.error('Consolidamento export rettifica V4',e);return result}
    };
    wrapped.__warehouseRectUppercaseFix=true;wrapped.__warehousePrevious=base;JSZip.prototype.generateAsync=wrapped;
  }

  function uppercaseTarget(el){
    if(!el||el.disabled||el.readOnly)return false;if(el.id==='jsonInput'||el.classList?.contains('textarea'))return false;
    if(el.tagName==='TEXTAREA')return true;if(el.tagName!=='INPUT')return false;const type=norm(el.getAttribute('type')||'text').toLowerCase();return ['text','search','tel'].includes(type);
  }
  function uppercaseElement(el){
    if(!uppercaseTarget(el))return;const value=text(el.value),upper=value.toUpperCase();if(value===upper)return;let start=null,end=null;try{start=el.selectionStart;end=el.selectionEnd}catch{}el.value=upper;try{if(start!==null&&end!==null)el.setSelectionRange(start,end)}catch{}
  }
  function installGlobalUppercaseV4(){
    if(document.documentElement.dataset.globalUppercaseV4==='1')return;document.documentElement.dataset.globalUppercaseV4='1';
    let style=document.getElementById('globalUppercaseV4Style');if(!style){style=document.createElement('style');style.id='globalUppercaseV4Style';style.textContent='input:not([type]),input[type="text"],input[type="search"],input[type="tel"],textarea:not(#jsonInput):not(.textarea){text-transform:uppercase}';document.head.appendChild(style)}
    const handler=e=>uppercaseElement(e.target);document.addEventListener('input',handler,true);document.addEventListener('change',handler,true);document.addEventListener('focusin',handler,true);
    document.querySelectorAll('input,textarea').forEach(uppercaseElement);
  }

  installExportConsolidationV4();installGlobalUppercaseV4();
  window.WarehouseRectificationUppercaseFix={version:VERSION,currentIdentityQuantitiesV4,consolidateMainSheetV4,removeDuplicateExportRowsV4,installGlobalUppercaseV4};
})();
