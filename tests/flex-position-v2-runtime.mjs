import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('flex-position-v2.js','utf8');
for(const forbidden of ['(facoltativo)','obbligatorio']){
  if(source.toLowerCase().includes(forbidden.toLowerCase()))throw new Error(`Visible position wording must not contain: ${forbidden}`);
}
const stock=[
  {article_base:'I10001',size:'M',quantity:30,state:'NUOVO',fila_scaffale:'63',bancale:'134'},
  {article_base:'I10002',size:'L',quantity:40,state:'NUOVO',fila_scaffale:'63',bancale:'135'},
  {article_base:'I10003',size:'S',quantity:20,state:'USATO',fila_scaffale:'64',bancale:'134'},
  {article_base:'I10004',size:'M',quantity:10,state:'NUOVO',fila_scaffale:'63',bancale:'134'},
  {article_base:'I10004',size:'M',quantity:15,state:'NUOVO',fila_scaffale:'63',bancale:'135'}
];
const context={window:null,console,document:undefined,stockBuckets:()=>stock,locationOf:r=>r.fila_scaffale||'',normalizeArticle:v=>String(v||'').toUpperCase()};
context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'flex-position-v2.js'});
const api=context.WarehouseFlexPositionV2;if(!api)throw new Error('Flexible position API missing');
if(api.hasPosition('',''))throw new Error('Empty+empty position must be invalid');
if(!api.hasPosition('63','')||!api.hasPosition('','134')||!api.hasPosition('63','134'))throw new Error('Shelf-only, pallet-only and combined positions must be valid');
if(api.positionRows('63','').length!==4)throw new Error('Shelf-only filter must include all stock on that shelf');
if(api.positionRows('','134').length!==3)throw new Error('Pallet-only filter must include all stock on that pallet');
if(api.positionRows('63','134').length!==2)throw new Error('Combined filter must use intersection');
let r=api.resolveDischargeSource({article_base:'I10002',size:'L',state:'NUOVO',quantity:5},'63','');
if(r.error||r.row.bancale!=='135'||r.row.fila_scaffale!=='63')throw new Error('Shelf-only discharge did not resolve the concrete pallet');
r=api.resolveDischargeSource({article_base:'I10003',size:'S',state:'USATO',quantity:5},'','134');
if(r.error||r.row.bancale!=='134'||r.row.fila_scaffale!=='64')throw new Error('Pallet-only discharge did not resolve the concrete shelf');
r=api.resolveDischargeSource({article_base:'I10004',size:'M',state:'NUOVO',quantity:5},'63','');
if(!r.error||!r.error.includes('più posizioni'))throw new Error('Ambiguous partial position must be rejected instead of guessed');
console.log('Flexible position runtime OK: shelf-only, pallet-only, combined and ambiguous-source safeguards work.');
