import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('request-completion-workflow.js','utf8');
const context={window:null,console,document:undefined,Date,Math,Number,String,Map,JSON,Promise,setTimeout,clearTimeout,normalizeArticle:v=>String(v??'').trim().toUpperCase().replace(/^1(?=[A-Z0-9])/,'I')};
context.window=context;
context.RequestCartons={isCartonRequest:req=>!!req&&(req.quantity_unit==='CARTONI'||Number(req.request_schema||0)>=2)};
vm.createContext(context);vm.runInContext(source,context,{filename:'request-completion-workflow.js'});
const api=context.WarehouseRequestCompletionWorkflow;if(!api)throw new Error('Request completion API missing');

const lines=Array.from({length:47},(_,i)=>({article_base:`I${String(10000+i).padStart(5,'0')}`,size:'M',cartons:1,quantity:1}));
const picked=lines.slice(0,5).map(l=>({article_base:l.article_base,size:l.size,cartons:1,quantity:1,pieces:40,extra:false}));
const req={id:'RQ-2026-00001',quantity_unit:'CARTONI',request_schema:2,status:'PARZIALE',lines,deliveries:[{documentId:'SC-1',items:picked}],draft:{allocations:[],extraAllocations:[],note:''}};

let s=api.requestSummary(req);
if(s.requested!==47||s.picked!==5||s.unpicked!==42||s.pieces!==200)throw new Error(`47/5/42 completion summary wrong: ${JSON.stringify(s)}`);
if(api.hasPendingDraft(req))throw new Error('Empty request draft incorrectly treated as pending');
req.draft.allocations=[{checked:true,cartons:1,quantity:12}];
if(!api.hasPendingDraft(req))throw new Error('Pending pick draft was not detected');
req.draft={allocations:[],extraAllocations:[],note:''};

const closedAt='2026-08-25T09:20:00.000Z';
const change=api.applyCompletion(req,'Mattia',closedAt,'CHIUSA_OPERATORE');
if(req.status!=='COMPLETATA')throw new Error('Operator close must set COMPLETATA even with unavailable cartons');
if(req.completion.requested_cartons!==47||req.completion.picked_cartons!==5||req.completion.unpicked_cartons!==42)throw new Error(`Completion record lost shortages: ${JSON.stringify(req.completion)}`);
if(req.completion.closed_by!=='Mattia'||req.completion.closed_at!==closedAt)throw new Error('Completion operator/timestamp missing');
if(change.before.status!=='PARZIALE'||change.after.status!=='COMPLETATA')throw new Error('Completion audit transition wrong');
if(req.draft.allocations.length||req.draft.extraAllocations.length)throw new Error('Completed request must not keep editable draft allocations');

const reopenedAt='2026-08-25T09:30:00.000Z';
const reopen=api.applyReopen(req,'Mattia',reopenedAt);
if(req.status!=='PARZIALE')throw new Error(`Reopened request with 5 picked cartons should return PARZIALE, got ${req.status}`);
if(req.completion!==null||req.completion_history?.length!==1)throw new Error('Reopen must archive and clear completion record');
if(req.reopened_by!=='Mattia'||req.reopened_at!==reopenedAt)throw new Error('Reopen operator/timestamp missing');
if(reopen.before.status!=='COMPLETATA'||reopen.after.status!=='PARZIALE')throw new Error('Reopen audit transition wrong');

const full={quantity_unit:'CARTONI',request_schema:2,status:'PARZIALE',lines:[{article_base:'I1',size:'S',cartons:2}],deliveries:[{items:[{article_base:'I1',size:'S',cartons:2,pieces:30,extra:false}]}],draft:{allocations:[],extraAllocations:[],note:''}};
api.applyCompletion(full,'Mattia','2026-08-25T09:40:00.000Z','TUTTI_PRELEVATI');
s=api.requestSummary(full);if(s.unpicked!==0||full.completion.reason!=='TUTTI_PRELEVATI')throw new Error('Automatic full completion semantics broken');

for(const required of ['CHIUDI / COMPLETA RICHIESTA','MODIFICA / RIAPRI','VEDI DETTAGLI','requestCompletionBanner','requestReadonlySummary','COMPLETE','REOPEN'])if(!source.includes(required))throw new Error(`Missing completion workflow behavior: ${required}`);
const css=fs.readFileSync('request-cartons.css','utf8');
for(const required of ['.requestStatus','align-items:center','justify-content:center','.requestClosedCard','.requestCloseTotals'])if(!css.includes(required))throw new Error(`Missing request status/completion UX style: ${required}`);
const index=fs.readFileSync('index.html','utf8');
const perf=index.indexOf("request-interaction-performance-fix.js?v=");
const workflow=index.indexOf("request-completion-workflow.js?v=");
if(perf<0||workflow<0||workflow<perf)throw new Error('Request completion workflow must load after request performance compatibility layer');
console.log('Request completion workflow OK: 47 requested / 5 picked can be explicitly closed as COMPLETATA with 42 unpicked, read-only state is reversible only through audited reopen, and status badge is centered.');
