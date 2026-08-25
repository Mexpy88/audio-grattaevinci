import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('request-interaction-performance-fix.js','utf8');
for(const required of ['applyDraftValue','cacheDraftNow','hydrateDraft','patchAllocationCard','__warehouseFastRequest','CACHE_KEY'])if(!source.includes(required))throw new Error(`Missing request performance guard: ${required}`);
if(source.includes('saveDb('))throw new Error('Fast request interaction module must never serialize the full warehouse DB on a field tap/change');

const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const context={window:null,console,document:undefined,localStorage,setTimeout,clearTimeout,db:{rectifications:[]}};context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'request-interaction-performance-fix.js'});
const api=context.WarehouseRequestInteractionPerformanceFix;if(!api)throw new Error('Request performance API missing');

const a={available:23,quantity:0,cartons:0,checked:false,note:''};
api.applyDraftValue(a,'quantity',99);if(a.quantity!==23)throw new Error('Piece quantity must clamp to current availability without rerendering');
api.applyDraftValue(a,'cartons',2);if(a.cartons!==2)throw new Error('Carton count update failed');
api.applyDraftValue(a,'checked',true);if(!a.checked)throw new Error('Checkbox update failed');

const req={id:'R1',quantity_unit:'CARTONI',request_schema:2,deliveries:[],draft:{allocations:[{id:'A1',available:23,quantity:23,cartons:1,checked:true}],extraAllocations:[],note:'continua'}};
if(!api.cacheDraftNow(req))throw new Error('Small draft cache write failed');
req.draft={allocations:[],extraAllocations:[],note:'perso'};
if(!api.hydrateDraft(req))throw new Error('Draft cache hydration failed');
if(req.draft.allocations[0]?.quantity!==23||req.draft.allocations[0]?.cartons!==1||req.draft.note!=='continua')throw new Error('Cached operator input was not restored');

context.db.rectifications.push({id:'X1'});req.draft={allocations:[],extraAllocations:[],note:'nuovo'};
if(api.hydrateDraft(req))throw new Error('A cache created before a rectification must not overwrite refreshed real-stock data');

console.log('Request interaction performance OK: checkbox/cartons/pieces update in memory, full DB save is avoided, and the small draft cache is safe across reloads/rectifications.');
