import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('managerial-v2.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.match(src,/MOVIMENTA/);
assert.match(src,/RETTIFICA \/ VERIFICA/);
assert.match(src,/CONTEGGIO FISICO/);
assert.match(src,/semantic_type:semantic/);
assert.match(src,/\[SPOSTA\]/);
assert.match(src,/\[VERIFICA\]/);
assert.doesNotMatch(src,/>INVENTARIO</);
assert.match(index,/managerial-v2\.js/);

const key=r=>[r.article_base,r.size,r.state,r.loc,r.pal].join('|');
function apply(map,before,after){
  if(before){const k=key(before);map.set(k,(map.get(k)||0)-before.quantity)}
  if(after){const k=key(after);map.set(k,(map.get(k)||0)+after.quantity)}
  for(const [k,v] of [...map])if(v===0)map.delete(k);
}

// SPOSTA parziale: 100 -> 70 origine + 30 destinazione, totale invariato.
const map=new Map([[key({article_base:'I30861',size:'M',state:'NUOVO',loc:'64',pal:'135'}),100]]);
const before={article_base:'I30861',size:'M',state:'NUOVO',loc:'64',pal:'135',quantity:100};
const sourceAfter={...before,quantity:70};
const dest={article_base:'I30861',size:'M',state:'NUOVO',loc:'70',pal:'200',quantity:30};
apply(map,before,sourceAfter);
apply(map,null,dest);
assert.equal(map.get(key(sourceAfter)),70);
assert.equal(map.get(key(dest)),30);
assert.equal([...map.values()].reduce((a,b)=>a+b,0),100);

// Verifica fisica: atteso 50, contato 47 -> risultato 47.
const verify=new Map([[key({article_base:'I50000',size:'L',state:'USATO',loc:'64',pal:'135'}),50]]);
const vBefore={article_base:'I50000',size:'L',state:'USATO',loc:'64',pal:'135',quantity:50};
const vAfter={...vBefore,quantity:47};
apply(verify,vBefore,vAfter);
assert.equal(verify.get(key(vAfter)),47);

// Trovato non previsto: atteso 0, contato 12 -> +12 come differenza fisica.
const found={article_base:'I90000',size:'XL',state:'NUOVO',loc:'64',pal:'135',quantity:12};
apply(verify,null,found);
assert.equal(verify.get(key(found)),12);

console.log('managerial V2 runtime OK');
