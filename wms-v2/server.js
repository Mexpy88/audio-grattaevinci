import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {openWarehouseDb,ROLE} from './db.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PUBLIC=path.join(__dirname,'public');
const PORT=Number(process.env.PORT||8787);
const HOST=process.env.HOST||'0.0.0.0';
const store=openWarehouseDb(path.join(__dirname,'data'));
const sessions=new Map();
const clients=new Set();
const SESSION_MS=12*60*60*1000;
const VERSION='0.2.0';

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const send=(res,status,data,headers={})=>{const body=typeof data==='string'?data:JSON.stringify(data);res.writeHead(status,{'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8',...headers});res.end(body)};
const ok=(res,data)=>send(res,200,{ok:true,data});
const fail=(res,status,message)=>send(res,status,{ok:false,error:message});

async function bodyJson(req){let raw='';for await(const c of req){raw+=c;if(raw.length>2_000_000)throw new Error('Payload troppo grande.')}if(!raw)return {};try{return JSON.parse(raw)}catch{throw new Error('JSON non valido.')}}
function tokenFrom(req,url){const h=req.headers.authorization||'';if(h.startsWith('Bearer '))return h.slice(7);return url.searchParams.get('token')||''}
function auth(req,url){const token=tokenFrom(req,url),s=sessions.get(token);if(!s)return null;if(s.expiresAt<Date.now()){sessions.delete(token);return null}s.expiresAt=Date.now()+SESSION_MS;return {token,user:s.user}}
function requireAuth(req,res,url){const a=auth(req,url);if(!a){fail(res,401,'Sessione non valida.');return null}return a}
function canWork(user){return user.role===ROLE.ADMIN||user.role===ROLE.OPERATOR}
function canReadAll(user){return [ROLE.ADMIN,ROLE.OPERATOR,ROLE.SUPERVISOR,ROLE.GLOBAL].includes(user.role)}
function broadcast(type,payload={}){const msg=`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;for(const c of [...clients]){try{c.write(msg)}catch{clients.delete(c)}}}

function isPrivateIpv4(ip){
  if(/^10\./.test(ip)||/^192\.168\./.test(ip))return true;
  const m=ip.match(/^172\.(\d+)\./);return !!(m&&Number(m[1])>=16&&Number(m[1])<=31);
}
function interfaceScore(name,ip){
  const n=String(name||'').toLowerCase();let score=isPrivateIpv4(ip)?100:30;
  if(/wi-?fi|wireless|wlan|hotspot/.test(n))score+=35;
  if(/ethernet|lan/.test(n))score+=20;
  if(/virtual|vmware|vbox|docker|wsl|hyper-v|tailscale|zerotier|vpn|loopback|bluetooth/.test(n))score-=80;
  if(/^169\.254\./.test(ip))score-=60;
  return score;
}
function networkInfo(){
  const items=[];
  for(const [name,rows] of Object.entries(os.networkInterfaces()))for(const n of rows||[]){
    const family=typeof n.family==='string'?n.family:String(n.family);
    if(family!=='IPv4'&&family!=='4')continue;if(n.internal)continue;
    const ip=n.address;if(!ip)continue;
    items.push({name,ip,url:`http://${ip}:${PORT}`,private:isPrivateIpv4(ip),score:interfaceScore(name,ip)});
  }
  const seen=new Set(),interfaces=items.filter(x=>{if(seen.has(x.ip))return false;seen.add(x.ip);return true}).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  const preferred=interfaces.find(x=>x.score>0)||interfaces[0]||null;
  return {version:VERSION,port:PORT,host:HOST,pcUrl:`http://localhost:${PORT}`,preferredUrl:preferred?.url||'',preferredInterface:preferred?.name||'',interfaces:interfaces.map(({score,...x})=>x)};
}

function staticFile(req,res,url){let rel=decodeURIComponent(url.pathname);if(rel==='/'||rel==='')rel='/index.html';const file=path.normalize(path.join(PUBLIC,rel));if(!file.startsWith(PUBLIC)){res.writeHead(403);res.end('Forbidden');return true}if(!fs.existsSync(file)||!fs.statSync(file).isFile())return false;const ext=path.extname(file);res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=300'});fs.createReadStream(file).pipe(res);return true}

async function api(req,res,url){
  const p=url.pathname;
  if(p==='/api/health'&&req.method==='GET')return ok(res,{status:'ok',version:VERSION,time:new Date().toISOString()});
  if(p==='/api/network'&&req.method==='GET')return ok(res,networkInfo());
  if(p==='/api/login'&&req.method==='POST'){
    const b=await bodyJson(req),user=store.authenticate(b.pin||'');if(!user)return fail(res,401,'PIN non valido.');
    const token=randomBytes(32).toString('hex');sessions.set(token,{user,expiresAt:Date.now()+SESSION_MS});return ok(res,{token,user});
  }
  const a=requireAuth(req,res,url);if(!a)return;
  if(p==='/api/logout'&&req.method==='POST'){sessions.delete(a.token);return ok(res,true)}
  if(p==='/api/me'&&req.method==='GET')return ok(res,a.user);
  if(p==='/api/events'&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`event: ready\ndata: ${JSON.stringify({user:a.user.name})}\n\n`);clients.add(res);const ping=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},25000);req.on('close',()=>{clearInterval(ping);clients.delete(res)});return;
  }
  if(p==='/api/dashboard'&&req.method==='GET')return ok(res,store.dashboard(a.user));
  if(p==='/api/users'&&req.method==='GET'){
    if(a.user.role!==ROLE.ADMIN&&a.user.role!==ROLE.GLOBAL)return fail(res,403,'Permesso negato.');return ok(res,store.listUsers());
  }
  if(p==='/api/stock'&&req.method==='GET'){
    if(a.user.role===ROLE.REQUESTER)return fail(res,403,'Permesso negato.');const wh=a.user.warehouseScope==='ALL'?(url.searchParams.get('warehouse')||'TERAMO'):a.user.warehouseScope;return ok(res,store.listStock({q:url.searchParams.get('q')||'',warehouse:wh}));
  }
  if(p==='/api/availability'&&req.method==='GET'){
    const wh=a.user.warehouseScope==='ALL'?(url.searchParams.get('warehouse')||'TERAMO'):a.user.warehouseScope;const rows=store.availability(url.searchParams.get('article')||'',url.searchParams.get('size')||'',wh);if(a.user.role===ROLE.REQUESTER)return ok(res,{available:rows.reduce((s,r)=>s+r.quantity,0)>0});return ok(res,rows);
  }
  if(p==='/api/requests'&&req.method==='GET')return ok(res,store.listRequests(a.user));
  if(p==='/api/requests'&&req.method==='POST'){
    if(![ROLE.REQUESTER,ROLE.ADMIN].includes(a.user.role))return fail(res,403,'Solo un richiedente o amministratore può creare richieste.');const r=store.createRequest(a.user,await bodyJson(req));broadcast('request-created',{id:r.id,number:r.number,requester:r.requesterName});return ok(res,r);
  }
  const m=p.match(/^\/api\/requests\/(\d+)(?:\/(take|pick|complete))?$/);
  if(m){const id=Number(m[1]),action=m[2]||'';
    if(!action&&req.method==='GET'){const r=store.getRequest(id);if(!r)return fail(res,404,'Richiesta non trovata.');if(a.user.role===ROLE.REQUESTER&&r.requesterId!==a.user.id)return fail(res,403,'Permesso negato.');return ok(res,r)}
    if(!canWork(a.user))return fail(res,403,'Utente in sola lettura.');
    if(action==='take'&&req.method==='POST'){const r=store.takeRequest(a.user,id);broadcast('request-updated',{id:r.id,number:r.number,status:r.status});return ok(res,r)}
    if(action==='pick'&&req.method==='POST'){const r=store.pickRequestLine(a.user,id,await bodyJson(req));broadcast('request-updated',{id:r.id,number:r.number,status:r.status});return ok(res,r)}
    if(action==='complete'&&req.method==='POST'){const r=store.completeRequest(a.user,id,await bodyJson(req));broadcast('request-completed',{id:r.id,number:r.number,status:r.status});return ok(res,r)}
  }
  if(p==='/api/audit'&&req.method==='GET'){if(!canReadAll(a.user))return fail(res,403,'Permesso negato.');return ok(res,store.listAudit(url.searchParams.get('limit')||100))}
  if(p==='/api/demo/reset'&&req.method==='POST'){if(a.user.role!==ROLE.ADMIN)return fail(res,403,'Solo Mattia/Admin può azzerare la demo.');store.resetDemo(a.user.id);broadcast('demo-reset',{});return ok(res,true)}
  return fail(res,404,'API non trovata.');
}

const server=http.createServer(async(req,res)=>{
  try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname.startsWith('/api/'))return await api(req,res,url);if(staticFile(req,res,url))return;res.writeHead(404);res.end('Not found')}catch(e){console.error(e);if(!res.headersSent)fail(res,400,e.message||'Errore');else res.end()}
});

server.listen(PORT,HOST,()=>{
  const net=networkInfo();
  console.log('\nMAGAZZINO SO WMS V2 — DEMO');
  console.log(`PC: ${net.pcUrl}`);
  if(net.preferredUrl)console.log(`Tablet/Telefono: ${net.preferredUrl}${net.preferredInterface?`  [${net.preferredInterface}]`:''}`);
  for(const x of net.interfaces.filter(x=>x.url!==net.preferredUrl))console.log(`Alternativa rete: ${x.url}  [${x.name}]`);
  console.log('La rete può cambiare tra Wi-Fi di casa e hotspot: /api/network viene ricalcolato dinamicamente.');
  console.log('PIN: Mattia 1111 · Massimo 2222 · Alessandra 3333 · Lina 4444 · Luca 5555\n');
});

process.on('SIGINT',()=>{store.close();process.exit(0)});
