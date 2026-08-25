import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('rectification-flags.js','utf8');
const index=fs.readFileSync('index.html','utf8');

for(const forbidden of ['touchstart','touchmove','touchend','window.show=','window.show =','MutationObserver']){
  if(source.includes(forbidden))throw new Error(`Rectification flags must not touch navigation: ${forbidden}`);
}
if(!source.includes("const STORE='rectification_flags'"))throw new Error('Persistent flag store missing');
if(!source.includes("['article_base','size','fila_scaffale','bancale']"))throw new Error('Identity migration guard missing');
if(!source.includes("node.querySelectorAll('.rectFlagMeta').forEach(x=>x.remove())"))throw new Error('Decorator must remove all previous operator/date metadata before inserting one');
if(!source.includes("head.querySelectorAll('.rectFlagWrap').forEach(x=>x.remove())"))throw new Error('Decorator must remove previous flag controls before inserting one');
if(!index.includes("rectification-flags.js?v="))throw new Error('Rectification flags module is not loaded by index.html');
if(index.indexOf('rectification-flags.js?v=')<index.indexOf('rectification-uppercase-fix.js?v='))throw new Error('Flags module must load after the stable rectification/uppercase fix');

let saves=0;
const context={
  window:null,console,document:undefined,
  db:{rectification_flags:{}},
  saveDb(){saves++},operatorName(){return 'MATTIA'},
  locationOf:r=>r?.fila_scaffale||r?.fila||'',
  WarehouseMasterSchemaV4:{normalizeArticle:v=>String(v??'').trim().toUpperCase().replace(/\s+/g,' ')},
  stockEditRowsDraft:[]
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'rectification-flags.js'});
const api=context.WarehouseRectificationFlags;if(!api)throw new Error('Rectification flags API missing');

const nuovo={article_base:'I00215',size:'L',state:'NUOVO',fila_scaffale:'23',bancale:'38'};
const usato={...nuovo,state:'USATO'};
if(api.flagKey(nuovo)!==api.flagKey(usato))throw new Error('Flag must belong to physical Master identity, not state');
api.setFlag(nuovo,true);
if(!api.isFlagged(nuovo)||!api.isFlagged(usato))throw new Error('Flag must apply to all state buckets of the same Master row');
if(context.db.rectification_flags[api.flagKey(nuovo)]?.operator!=='MATTIA')throw new Error('Flag operator metadata missing');
if(saves<1)throw new Error('Flag change was not persisted');

context.stockEditRowsDraft=[nuovo,usato,{article_base:'I00999',size:'S',state:'NUOVO',fila_scaffale:'23',bancale:'38'}];
let st=api.uniqueDraftStats();if(st.total!==2||st.flagged!==1)throw new Error(`Expected 1/2 flagged Master identities, got ${st.flagged}/${st.total}`);

const moved={...nuovo,fila_scaffale:'24'};
context.stockEditRowsDraft=[moved];
api.moveFlag(nuovo,moved);
if(api.isFlagged(nuovo))throw new Error('Old identity flag should be removed when no old draft remains');
if(!api.isFlagged(moved))throw new Error('Flag must follow an identity change');

api.setFlag(moved,false);
if(api.isFlagged(moved))throw new Error('Unchecking must remove the persistent flag');

console.log('Rectification flags runtime OK: persistent checkbox, identity migration and idempotent single operator/date decoration.');
