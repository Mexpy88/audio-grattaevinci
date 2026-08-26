import fs from 'node:fs';
import assert from 'node:assert/strict';

const nav=fs.readFileSync('sticky-top-back.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const base=fs.readFileSync('base.html','utf8');

assert.ok(fs.existsSync('logo-transparent.png'),'Transparent logo asset must exist');
assert.match(index,/logo-transparent\.png\?v=/);
assert.doesNotMatch(index,/logo-full\.svg\?v=20260814-0756/);
assert.match(index,/sticky-top-back\.js\?v=/);
assert.match(index,/WarehouseStickyTopBack\?\.install\?\.\(\)/);
assert.match(nav,/sticky-top-back2-passive/);
assert.match(nav,/currentScreen\(\)/);
assert.match(nav,/screen\.querySelector\(':scope > \.back'\)/);
assert.match(nav,/nativeBack\.click\(\)/);
assert.match(nav,/screen\.id==='home'/);
assert.match(nav,/body\.stickyTopBackReady main>\.screen>\.back\{display:none!important\}/);

// Critical regression guard: sticky navigation must never replace app/auth globals.
assert.doesNotMatch(nav,/window\.show\s*=/);
assert.doesNotMatch(nav,/window\.submitLogin\s*=/);
assert.doesNotMatch(nav,/window\.logout\s*=/);
assert.doesNotMatch(nav,/MutationObserver/);
assert.match(nav,/setInterval\(\(\)=>sync\(false\),250\)/);
assert.match(nav,/document\.addEventListener\('click'/);

// Base authentication lifecycle must remain intact.
assert.match(base,/currentUser=user;[\s\S]*closeLogin\(\);syncAuthUI\(\);/);
assert.match(base,/function logout\(\)[\s\S]*currentUser='';[\s\S]*show\('home'\);syncAuthUI\(\);/);

console.log('sticky top back passive + transparent logo + auth lifecycle OK');
