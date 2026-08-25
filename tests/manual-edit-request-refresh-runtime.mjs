import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('manual-edit-request-refresh-fix.js','utf8');
for(const required of ['safeManualRowHtml','renderManualRows','syncCartonDraft','refreshActiveRequestAfterRectification','window.renderStockEditRows=renderManualRows','window.loadStockPallet=loadManualPosition']){
  if(!source.includes(required))throw new Error(`Missing manual edit/live refresh guard: ${required}`);
}
if(source.includes('stockEditRowsDraft.map(stockEditRowHtml)'))throw new Error('Manual editor fix must not depend on the renderer that disappeared in production');

let stock=[
  {article_base:'I5614UHF',size:'XL',quantity:23,state:'NUOVO',fila_scaffale:'61',bancale:'113'},
  {article_base:'I5614UHF',size:'XL',quantity:12,state:'SCARICATO',fila_scaffale:'61',bancale:'113'}
];
const context={
  window:null,console,document:undefined,
  stockBuckets:()=>stock,
  normalizeArticle:v=>String(v||'').replace(/\s+/g,'').toUpperCase(),
  locationOf:r=>r?.fila_scaffale||r?.fila||'',
  uid:(()=>{let n=0;return()=>`U${++n}`})()
};
context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'manual-edit-request-refresh-fix.js'});
const api=context.WarehouseManualEditRequestRefreshFix;if(!api)throw new Error('Fix API missing');

const req={
  id:'R1',quantity_unit:'CARTONI',request_schema:2,
  lines:[{article_base:'I5614UHF',size:'XL',cartons:1,quantity:1}],
  deliveries:[],
  draft:{note:'continua',extraAllocations:[],allocations:[
    {id:'OLD-N',requestedKey:'I5614UHF|XL',article_base:'I5614UHF',size:'XL',state:'NUOVO',fila_scaffale:'61',fila:'61',bancale:'113',available:33,remainingCartons:1,cartons:1,quantity:23,checked:true,note:'preserva',extra:false},
    {id:'OLD-S',requestedKey:'I5614UHF|XL',article_base:'I5614UHF',size:'XL',state:'SCARICATO',fila_scaffale:'61',fila:'61',bancale:'113',available:12,remainingCartons:1,cartons:0,quantity:0,checked:false,note:'',extra:false}
  ]}
};
api.syncCartonDraft(req,stock);
const nuovo=req.draft.allocations.find(a=>a.state==='NUOVO');
if(!nuovo)throw new Error('NUOVO allocation disappeared after stock refresh');
if(nuovo.available!==23)throw new Error(`Expected live availability 23 after rectification, got ${nuovo.available}`);
if(nuovo.quantity!==23||nuovo.cartons!==1||!nuovo.checked)throw new Error('Still-valid operator input was not preserved after rectification');
if(nuovo.id!=='OLD-N'||nuovo.note!=='preserva')throw new Error('Draft identity/note should be preserved when physical row is unchanged');
if(req.draft.note!=='continua')throw new Error('General request note was lost during refresh');

stock=[{article_base:'I5614UHF',size:'XL',quantity:10,state:'NUOVO',fila_scaffale:'61',bancale:'113'}];
api.syncCartonDraft(req,stock);
const clamped=req.draft.allocations.find(a=>a.state==='NUOVO');
if(clamped.available!==10||clamped.quantity!==10)throw new Error('Pieces must clamp to the new real availability when stock falls below the typed quantity');

const html=api.safeManualRowHtml({edit_id:'E1',original:{article_base:'I5614UHF',size:'XL',quantity:33,state:'NUOVO',fila_scaffale:'61',bancale:'113'},deleted:false,article_base:'I5614UHF',size:'XL',quantity:23,state:'NUOVO',fila_scaffale:'61',bancale:'113'},0);
for(const label of ['Articolo','Taglia','Quantità','Stato','Fila/Scaffale','Bancale/Carrello','ELIMINA'])if(!html.includes(label))throw new Error(`Manual stock card missing ${label}`);
if(!html.includes("editStockDraft('E1'"))throw new Error('Manual row fields are not editable');

console.log('Manual MODIFICA + request live-stock refresh OK: all manual fields render and carton drafts refresh 33→23 while preserving valid 1 carton / 23 pieces.');
