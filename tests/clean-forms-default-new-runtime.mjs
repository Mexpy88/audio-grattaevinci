import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('clean-forms-default-new.js','utf8');
for(const bad of ['MutationObserver','touchstart','touchmove','touchend']){
  if(src.includes(bad))throw new Error(`Forbidden UI/navigation hook introduced: ${bad}`);
}
if(!src.includes("state:'NUOVO'"))throw new Error('Manual rows must default to NUOVO');
if(!src.includes('removeAttribute(\'placeholder\')'))throw new Error('Field placeholders are not removed');
if(!src.includes('uxOptionalNote'))throw new Error('Field helper notes are not suppressed');

const removed=[];
const placeholderEls=[
  {removeAttribute(name){if(name==='placeholder')removed.push('p1')}},
  {removeAttribute(name){if(name==='placeholder')removed.push('p2')}}
];
const helperEls=[{remove(){removed.push('h1')}},{remove(){removed.push('h2')}}];
const styleNode={id:'',textContent:''};
const doc={
  head:{appendChild(){}},
  getElementById(){return null},
  createElement(tag){return tag==='style'?styleNode:{id:'',textContent:''}},
  createTextNode(text){return {nodeType:3,textContent:text}},
  querySelectorAll(sel){
    if(sel==='input[placeholder],textarea[placeholder]')return placeholderEls;
    if(sel==='label .uxOptionalNote,label .msv4PosHelp')return helperEls;
    return [];
  },
  addEventListener(){},
};
let renderCount=0,shown='';
const ctx={
  window:null,document:doc,console,setTimeout:fn=>{fn();return 1},clearTimeout(){},
  importedPhotos:[],
  requireLogin:()=>true,validateLocation:()=>true,
  renderResults:()=>{renderCount++},show:id=>{shown=id},
  startManualEntry(){},addGroup(){},addVariant(){},
  openOperation(){},openStockEdit(){},openSearch(){},openRegistry(){},openRequests(){},renderStockEditRows(){},renderRequestDetail(){},renderExtraStockSearch(){}
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(src,ctx,{filename:'clean-forms-default-new.js'});

if(!ctx.WarehouseCleanFormsDefaultNew)throw new Error('Clean forms module not installed');
if(!removed.includes('p1')||!removed.includes('p2'))throw new Error('Placeholders were not removed');
if(!removed.includes('h1')||!removed.includes('h2'))throw new Error('Helper notes were not removed');

ctx.startManualEntry();
if(shown!=='results')throw new Error('Manual entry no longer opens results');
if(ctx.importedPhotos?.[0]?.groups?.[0]?.variants?.[0]?.state!=='NUOVO')throw new Error('First manual row is not NUOVO');

ctx.addGroup(0);
const groups=ctx.importedPhotos[0].groups;
if(groups.at(-1)?.variants?.[0]?.state!=='NUOVO')throw new Error('New manual article does not default to NUOVO');

ctx.addVariant(0,0);
if(groups[0].variants.at(-1)?.state!=='NUOVO')throw new Error('New manual variant does not default to NUOVO');
if(renderCount<3)throw new Error('Manual changes did not render');

console.log('Clean forms/default NUOVO runtime OK: no helper placeholders, manual rows default to NUOVO.');
