import Database from 'better-sqlite3';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROLE={ADMIN:'ADMIN',OPERATOR:'OPERATOR',SUPERVISOR:'SUPERVISOR_READONLY',REQUESTER:'REQUESTER',GLOBAL:'GLOBAL_READONLY'};
const DEMO_USERS=[
  ['Mattia',ROLE.ADMIN,'1111','ALL'],
  ['Massimo',ROLE.OPERATOR,'2222','TERAMO'],
  ['Alessandra',ROLE.SUPERVISOR,'3333','TERAMO'],
  ['Lina',ROLE.REQUESTER,'4444','TERAMO'],
  ['Luca',ROLE.GLOBAL,'5555','ALL']
];
const DEMO_STOCK=[
  ['TERAMO','I30872MUHF','M','NUOVO','68','12',166],
  ['TERAMO','I30872MUHF','M','NUOVO','69','41',82],
  ['TERAMO','I00215','S','NUOVO','63','SC1',315],
  ['TERAMO','I00215','S','USATO','64','18',50],
  ['TERAMO','I00215','S','SCARICATO','68','12',63],
  ['TERAMO','I62470LUNUHF','L','NUOVO','70','7',420],
  ['TERAMO','I62470LUNUHF','L','SCARICATO','71','9',171]
];

const now=()=>new Date().toISOString();
const norm=v=>String(v??'').trim().toUpperCase();
const hashPin=(pin,salt)=>scryptSync(String(pin),salt,32).toString('hex');

export function openWarehouseDb(dataDir=path.join(process.cwd(),'data')){
  fs.mkdirSync(dataDir,{recursive:true});
  const db=new Database(path.join(dataDir,'warehouse.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      warehouse_scope TEXT NOT NULL DEFAULT 'TERAMO',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stock(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse TEXT NOT NULL,
      article_base TEXT NOT NULL,
      size TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      pallet TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL CHECK(quantity>=0),
      updated_at TEXT NOT NULL,
      UNIQUE(warehouse,article_base,size,state,location,pallet)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_article ON stock(article_base,size);
    CREATE INDEX IF NOT EXISTS idx_stock_position ON stock(warehouse,location,pallet);
    CREATE TABLE IF NOT EXISTS requests(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE,
      requester_user_id INTEGER NOT NULL REFERENCES users(id),
      destination TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'INVIATA',
      taken_by_user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS request_lines(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      article_base TEXT NOT NULL,
      size TEXT NOT NULL DEFAULT '',
      cartons_requested INTEGER NOT NULL CHECK(cartons_requested>0),
      cartons_picked INTEGER NOT NULL DEFAULT 0 CHECK(cartons_picked>=0),
      pieces_picked INTEGER NOT NULL DEFAULT 0 CHECK(pieces_picked>=0),
      missing_reason TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS movements(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      warehouse TEXT NOT NULL,
      article_base TEXT NOT NULL,
      size TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      pallet TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL,
      request_id INTEGER REFERENCES requests(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS audit(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `);

  function seed(){
    if(db.prepare('SELECT COUNT(*) n FROM users').get().n===0){
      const ins=db.prepare('INSERT INTO users(name,role,pin_hash,pin_salt,warehouse_scope,created_at) VALUES(?,?,?,?,?,?)');
      for(const [name,role,pin,scope] of DEMO_USERS){const salt=randomBytes(16).toString('hex');ins.run(name,role,hashPin(pin,salt),salt,scope,now())}
    }
    if(db.prepare('SELECT COUNT(*) n FROM stock').get().n===0){
      const ins=db.prepare('INSERT INTO stock(warehouse,article_base,size,state,location,pallet,quantity,updated_at) VALUES(?,?,?,?,?,?,?,?)');
      const tx=db.transaction(()=>{for(const r of DEMO_STOCK)ins.run(...r,now())});tx();
    }
  }
  seed();

  const audit=(userId,action,entityType,entityId,payload={})=>db.prepare('INSERT INTO audit(user_id,action,entity_type,entity_id,payload_json,created_at) VALUES(?,?,?,?,?,?)').run(userId||null,action,entityType,String(entityId),JSON.stringify(payload),now());
  const publicUser=u=>u?{id:u.id,name:u.name,role:u.role,warehouseScope:u.warehouse_scope}:null;

  function authenticate(pin){
    for(const u of db.prepare('SELECT * FROM users WHERE active=1').all()){
      const a=Buffer.from(u.pin_hash,'hex'),b=Buffer.from(hashPin(pin,u.pin_salt),'hex');
      if(a.length===b.length&&timingSafeEqual(a,b))return publicUser(u);
    }
    return null;
  }
  function listUsers(){return db.prepare('SELECT id,name,role,warehouse_scope warehouseScope,active,created_at createdAt FROM users ORDER BY id').all()}
  function listStock({q='',warehouse='TERAMO'}={}){
    const term='%'+norm(q)+'%';
    return db.prepare(`SELECT id,warehouse,article_base articleBase,size,state,location,pallet,quantity,updated_at updatedAt FROM stock
      WHERE warehouse=? AND (?='%%' OR article_base LIKE ? OR size LIKE ? OR location LIKE ? OR pallet LIKE ?)
      ORDER BY article_base,size,state,location,pallet LIMIT 500`).all(warehouse,term,term,term,term,term);
  }
  function availability(articleBase,size='',warehouse='TERAMO'){
    return db.prepare(`SELECT id,warehouse,article_base articleBase,size,state,location,pallet,quantity FROM stock WHERE warehouse=? AND article_base=? AND size=? AND quantity>0 ORDER BY location,pallet,state`).all(warehouse,norm(articleBase),norm(size));
  }
  function nextRequestNumber(){const n=db.prepare('SELECT COALESCE(MAX(id),0)+1 n FROM requests').get().n;return `R-${String(n).padStart(4,'0')}`}
  function hydrateRequest(r){if(!r)return null;r.lines=db.prepare('SELECT id,article_base articleBase,size,cartons_requested cartonsRequested,cartons_picked cartonsPicked,pieces_picked piecesPicked,missing_reason missingReason,note FROM request_lines WHERE request_id=? ORDER BY id').all(r.id);return r}
  function getRequest(id){return hydrateRequest(db.prepare(`SELECT r.id,r.number,r.destination,r.status,r.created_at createdAt,r.updated_at updatedAt,r.completed_at completedAt,r.note,
    ru.id requesterId,ru.name requesterName,tu.id takenById,tu.name takenByName FROM requests r JOIN users ru ON ru.id=r.requester_user_id LEFT JOIN users tu ON tu.id=r.taken_by_user_id WHERE r.id=?`).get(id))}
  function listRequests(user){
    let rows;
    if(user.role===ROLE.REQUESTER) rows=db.prepare(`SELECT r.id,r.number,r.destination,r.status,r.created_at createdAt,r.updated_at updatedAt,r.completed_at completedAt,r.note,ru.id requesterId,ru.name requesterName,tu.id takenById,tu.name takenByName FROM requests r JOIN users ru ON ru.id=r.requester_user_id LEFT JOIN users tu ON tu.id=r.taken_by_user_id WHERE requester_user_id=? ORDER BY r.id DESC`).all(user.id);
    else rows=db.prepare(`SELECT r.id,r.number,r.destination,r.status,r.created_at createdAt,r.updated_at updatedAt,r.completed_at completedAt,r.note,ru.id requesterId,ru.name requesterName,tu.id takenById,tu.name takenByName FROM requests r JOIN users ru ON ru.id=r.requester_user_id LEFT JOIN users tu ON tu.id=r.taken_by_user_id ORDER BY r.id DESC`).all();
    return rows.map(hydrateRequest);
  }
  function createRequest(user,{destination='',note='',lines=[]}){
    const clean=(Array.isArray(lines)?lines:[]).map(l=>({articleBase:norm(l.articleBase),size:norm(l.size),cartonsRequested:Math.floor(Number(l.cartonsRequested)||0),note:String(l.note||'').trim()})).filter(l=>l.articleBase&&l.cartonsRequested>0);
    if(!clean.length)throw new Error('Inserisci almeno una riga valida.');
    return db.transaction(()=>{
      const t=now(),number=nextRequestNumber(),res=db.prepare('INSERT INTO requests(number,requester_user_id,destination,status,created_at,updated_at,note) VALUES(?,?,?,?,?,?,?)').run(number,user.id,String(destination||user.name).trim()||user.name,'INVIATA',t,t,String(note||''));
      const ins=db.prepare('INSERT INTO request_lines(request_id,article_base,size,cartons_requested,note) VALUES(?,?,?,?,?)');for(const l of clean)ins.run(res.lastInsertRowid,l.articleBase,l.size,l.cartonsRequested,l.note);
      audit(user.id,'CREATE','REQUEST',res.lastInsertRowid,{number,lines:clean.length});return getRequest(res.lastInsertRowid);
    })();
  }
  function takeRequest(user,id){return db.transaction(()=>{const r=getRequest(id);if(!r)throw new Error('Richiesta non trovata.');if(r.status==='COMPLETATA')throw new Error('Richiesta già completata.');const t=now();db.prepare("UPDATE requests SET status='PRESA_IN_CARICO',taken_by_user_id=?,updated_at=? WHERE id=?").run(user.id,t,id);audit(user.id,'TAKE','REQUEST',id);return getRequest(id)})()}
  function pickRequestLine(user,id,{lineId,stockId,cartons=0,pieces=0}){
    cartons=Math.floor(Number(cartons)||0);pieces=Math.floor(Number(pieces)||0);if(cartons<=0||pieces<=0)throw new Error('Cartoni e pezzi devono essere maggiori di zero.');
    return db.transaction(()=>{
      const r=getRequest(id);if(!r)throw new Error('Richiesta non trovata.');if(r.status==='COMPLETATA')throw new Error('Richiesta completata.');
      const line=db.prepare('SELECT * FROM request_lines WHERE id=? AND request_id=?').get(lineId,id);if(!line)throw new Error('Riga richiesta non trovata.');if(line.cartons_picked+cartons>line.cartons_requested)throw new Error('Cartoni superiori al residuo richiesto.');
      const s=db.prepare('SELECT * FROM stock WHERE id=?').get(stockId);if(!s)throw new Error('Giacenza non trovata.');if(s.article_base!==line.article_base||s.size!==line.size)throw new Error('La giacenza non corrisponde alla riga richiesta.');if(s.quantity<pieces)throw new Error(`Disponibili ${s.quantity} pezzi.`);
      const t=now();db.prepare('UPDATE stock SET quantity=quantity-?,updated_at=? WHERE id=?').run(pieces,t,stockId);db.prepare('UPDATE request_lines SET cartons_picked=cartons_picked+?,pieces_picked=pieces_picked+? WHERE id=?').run(cartons,pieces,lineId);db.prepare("UPDATE requests SET status='IN_PREPARAZIONE',taken_by_user_id=COALESCE(taken_by_user_id,?),updated_at=? WHERE id=?").run(user.id,t,id);
      db.prepare("INSERT INTO movements(type,warehouse,article_base,size,state,location,pallet,quantity,request_id,user_id,created_at,note) VALUES('SCARICA',?,?,?,?,?,?,?,?,?,?,?)").run(s.warehouse,s.article_base,s.size,s.state,s.location,s.pallet,pieces,id,user.id,t,`Richiesta ${r.number} · ${cartons} cartoni`);
      audit(user.id,'PICK','REQUEST',id,{lineId,stockId,cartons,pieces});return getRequest(id);
    })();
  }
  function completeRequest(user,id,{reasons={}}={}){
    return db.transaction(()=>{
      const r=getRequest(id);if(!r)throw new Error('Richiesta non trovata.');if(r.status==='COMPLETATA')return r;
      const upd=db.prepare('UPDATE request_lines SET missing_reason=? WHERE id=? AND request_id=?');for(const l of r.lines){if(l.cartonsPicked<l.cartonsRequested)upd.run(String(reasons[l.id]||'NON DISPONIBILE'),l.id,id)}
      const t=now();db.prepare("UPDATE requests SET status='COMPLETATA',completed_at=?,updated_at=?,taken_by_user_id=COALESCE(taken_by_user_id,?) WHERE id=?").run(t,t,user.id,id);audit(user.id,'COMPLETE','REQUEST',id,{missing:r.lines.filter(l=>l.cartonsPicked<l.cartonsRequested).length});return getRequest(id);
    })();
  }
  function dashboard(user){
    const stockQty=db.prepare('SELECT COALESCE(SUM(quantity),0) n FROM stock WHERE warehouse=?').get(user.warehouseScope==='ALL'?'TERAMO':user.warehouseScope).n;
    const where=user.role===ROLE.REQUESTER?' WHERE requester_user_id=?':'';const args=user.role===ROLE.REQUESTER?[user.id]:[];
    const open=db.prepare(`SELECT COUNT(*) n FROM requests${where}${where?' AND':' WHERE'} status<>'COMPLETATA'`).get(...args).n;
    const completed=db.prepare(`SELECT COUNT(*) n FROM requests${where}${where?' AND':' WHERE'} status='COMPLETATA'`).get(...args).n;
    const today=db.prepare("SELECT COUNT(*) n FROM movements WHERE substr(created_at,1,10)=substr(?,1,10)").get(now()).n;
    return {stockPieces:stockQty,openRequests:open,completedRequests:completed,movementsToday:today};
  }
  function listAudit(limit=100){return db.prepare(`SELECT a.id,a.action,a.entity_type entityType,a.entity_id entityId,a.payload_json payloadJson,a.created_at createdAt,u.name userName FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT ?`).all(Math.min(500,Math.max(1,Number(limit)||100)))}
  function resetDemo(userId){return db.transaction(()=>{db.exec('DELETE FROM movements; DELETE FROM request_lines; DELETE FROM requests; DELETE FROM audit; DELETE FROM stock;');const ins=db.prepare('INSERT INTO stock(warehouse,article_base,size,state,location,pallet,quantity,updated_at) VALUES(?,?,?,?,?,?,?,?)');for(const r of DEMO_STOCK)ins.run(...r,now());audit(userId,'RESET','DEMO','ALL');return true})()}

  return {db,ROLE,authenticate,listUsers,listStock,availability,getRequest,listRequests,createRequest,takeRequest,pickRequestLine,completeRequest,dashboard,listAudit,resetDemo,close:()=>db.close()};
}

export {ROLE};
