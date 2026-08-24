import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('m365-live.js','utf8');
for(const forbidden of ['touchstart','touchmove','touchend','window.show=','window.show =','passwordInput','clientSecret','client_secret']){
  if(source.includes(forbidden))throw new Error(`Forbidden LIVE pattern: ${forbidden}`);
}
for(const required of [
  "EXCEL MAGAZZINO",
  "COLLEGA ACCOUNT MICROSOFT",
  "SELEZIONA FILE EXCEL",
  "SALVA MODIFICHE",
  "SALVA ORA",
  "Files.ReadWrite",
  "User.Read",
  "verifyRemoteVersion",
  "If-Match",
  "downloadSelectedFile",
  "saveToMicrosoft365",
  "@azure/msal-browser@4.30.0/+esm"
])if(!source.includes(required))throw new Error(`Required LIVE feature missing: ${required}`);

const store=new Map();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const context={window:null,console,localStorage,document:undefined,setTimeout,clearTimeout,URL,Blob,Headers,structuredClone:globalThis.structuredClone};context.window=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'m365-live.js'});
const api=context.WarehouseM365Live;if(!api)throw new Error('WarehouseM365Live API missing');
if(api.callbackUri!=='https://raw.githack.com/Mexpy88/audio-grattaevinci/warehouse-app-live/auth-callback.html')throw new Error('Stable LIVE callback URI changed');
if(JSON.stringify(api.scopes)!==JSON.stringify(['User.Read','Files.ReadWrite']))throw new Error('Microsoft Graph scopes are not minimal/expected');
if(!api.isXlsxName('GIACENZE.xlsx')||!api.isXlsxName('giacenze.XLSX')||api.isXlsxName('~$GIACENZE.xlsx')||api.isXlsxName('GIACENZE.xls'))throw new Error('Excel file filter failed');
const desc=api.fileDescriptor({id:'item1',name:'MAGAZZINO.xlsx',eTag:'etag1',size:123,lastModifiedDateTime:'2026-08-24T10:00:00Z',webUrl:'https://example.test/file',parentReference:{driveId:'drive1',path:'/drive/root:/Magazzino'}});
if(desc.itemId!=='item1'||desc.driveId!=='drive1'||desc.name!=='MAGAZZINO.xlsx'||desc.eTag!=='etag1')throw new Error('Drive item descriptor failed');
const url=api.graphItemUrl(desc,'/content');
if(url!=='https://graph.microsoft.com/v1.0/drives/drive1/items/item1/content')throw new Error(`Wrong Graph content URL: ${url}`);
const cfg=api.readConfig();if(cfg.tenant!=='organizations'||cfg.clientId!=='')throw new Error('Default Microsoft config is unsafe/wrong');
console.log('M365 LIVE runtime OK: stable callback, public SPA config, OneDrive XLSX selection, Graph download/save endpoints, conflict guard, no password/client-secret handling.');
