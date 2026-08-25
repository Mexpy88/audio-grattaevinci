import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openWarehouseDb,ROLE} from '../db.js';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wms-v2-'));
const store=openWarehouseDb(dir);
try{
  const mattia=store.authenticate('1111');
  const massimo=store.authenticate('2222');
  const alessandra=store.authenticate('3333');
  const lina=store.authenticate('4444');
  const luca=store.authenticate('5555');
  assert.equal(mattia.role,ROLE.ADMIN);
  assert.equal(massimo.role,ROLE.OPERATOR);
  assert.equal(alessandra.role,ROLE.SUPERVISOR);
  assert.equal(lina.role,ROLE.REQUESTER);
  assert.equal(luca.role,ROLE.GLOBAL);
  assert.equal(store.authenticate('9999'),null);

  const req=store.createRequest(lina,{destination:'LINA',lines:[{articleBase:'I30872MUHF',size:'M',cartonsRequested:47}]});
  assert.equal(req.status,'INVIATA');
  assert.equal(req.lines[0].cartonsRequested,47);

  const taken=store.takeRequest(massimo,req.id);
  assert.equal(taken.status,'PRESA_IN_CARICO');
  assert.equal(taken.takenByName,'Massimo');

  const stock=store.availability('I30872MUHF','M','TERAMO');
  const before=stock[0].quantity;
  const picked=store.pickRequestLine(massimo,req.id,{lineId:req.lines[0].id,stockId:stock[0].id,cartons:5,pieces:201});
  assert.equal(picked.status,'IN_PREPARAZIONE');
  assert.equal(picked.lines[0].cartonsPicked,5);
  assert.equal(picked.lines[0].piecesPicked,201);
  const after=store.availability('I30872MUHF','M','TERAMO').find(x=>x.id===stock[0].id)?.quantity ?? 0;
  assert.equal(after,before-201);

  const completed=store.completeRequest(massimo,req.id,{});
  assert.equal(completed.status,'COMPLETATA');
  assert.equal(completed.lines[0].cartonsPicked,5);
  assert.equal(completed.lines[0].cartonsRequested,47);
  assert.equal(completed.lines[0].missingReason,'NON DISPONIBILE');

  const linaList=store.listRequests(lina);
  assert.equal(linaList.length,1);
  assert.equal(linaList[0].status,'COMPLETATA');
  assert.ok(store.listAudit(50).some(a=>a.action==='COMPLETE'));
  console.log('WMS V2 smoke OK: roles, request, realtime domain flow, stock discharge and partial closure semantics are valid.');
} finally {
  store.close();
  fs.rmSync(dir,{recursive:true,force:true});
}
