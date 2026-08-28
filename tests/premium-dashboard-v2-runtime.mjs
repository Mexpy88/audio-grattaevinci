import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('premium-dashboard-v2.js','utf8');
const fix=fs.readFileSync('premium-dashboard-v2-fix.js','utf8');
const css=fs.readFileSync('premium-dashboard-v2.css','utf8');
const polish=fs.readFileSync('ux-polish-v3.js','utf8');

assert.match(js,/2026\.08\.27-premium-dashboard2/);
assert.match(js,/const PATHS=\{/);
for(const name of ['monitor','phone','inbox','search','requests','history','pencil','clipboard','filePlus','download','excel'])assert.match(js,new RegExp(name+":'"));
assert.match(js,/rdDesktopViewV1/);
assert.match(js,/rdPhoneViewV1/);
assert.match(js,/rdInboxBtnV2/);
assert.match(js,/rdInboxBadgeV2/);
assert.match(js,/Richiesta di prelievo · Lina/);

// Dashboard visual contract.
assert.match(css,/\.topbar \.logoButton\{pointer-events:none!important;cursor:default!important/);
assert.match(css,/#rdDashboardV1 \.rdMasterFile\{display:none!important/);
assert.match(css,/rdFooterPremiumV2/);
assert.match(js,/© 2026 Servizi Ospedalieri – Gestione Magazzino/);
assert.match(js,/rdPremiumBgV2/);
assert.match(css,/#rdPremiumBgV2/);
assert.match(js,/opacity="\.055"/);
assert.match(js,/opacity="\.042"/);

// Lina: search -> select article+size -> cartons -> save/review -> cancel/modify/transmit.
for(const token of ['linaDigitalRequestV2','linaRequestSearchV2','toggleLinaVariantV2','setLinaCartonsV2','openLinaRequestReviewV2','ANNULLA','MODIFICA','TRASMETTI'])assert.ok(js.includes(token),`missing ${token}`);
assert.match(js,/aggregateStock\(query\)/);
assert.match(js,/article_base:a,size:s/);
assert.match(js,/cartons:/);
assert.match(js,/source:'DIGITALE_LINA'/);
assert.match(js,/quantity_unit:'CARTONI'/);
assert.match(js,/request_schema:2/);
assert.match(js,/status:'DA PREPARARE'/);
assert.match(js,/recipients:\['Mattia','Massimo','Alessandra','Luca'\]/);

// One notification per intended recipient; per-user read state.
assert.match(js,/const recipients=\['Mattia','Massimo','Alessandra','Luca'\]/);
assert.match(js,/recipient,title:'Richiesta di prelievo · Lina'/);
assert.match(js,/read_at:null/);
assert.match(js,/n\.recipient===me&&!n\.read_at/);
assert.match(js,/n\.read_at=now\(\)/);
assert.match(js,/req\.status='IN PRELIEVO'/);
assert.match(js,/req\.assigned_to=actor\(\)/);

// Warehouse users keep paper scan flow name.
assert.match(js,/SCANSIONA RICHIESTA/);
assert.match(js,/Acquisisci richiesta cartacea/);

// Reusable review after a successful transmission and Lina status labels.
assert.match(fix,/reviewShell\(\)/);
assert.match(fix,/TRASMESSA/);
assert.match(fix,/SCANSIONA RICHIESTA/);

// Final loader order.
assert.match(polish,/premium-dashboard-v2\.js/);
assert.match(polish,/premium-dashboard-v2-fix\.js/);
assert.match(polish,/loadPremiumFix/);

// Performance contract: legacy body-wide observers and 1.2s polling remain in the old
// presentation modules for compatibility, but the loader must neutralize them at bootstrap.
assert.match(polish,/PremiumDashboardNoopObserver/);
assert.match(polish,/PremiumFixNoopObserver/);
assert.match(polish,/Number\(delay\)===1200/);
assert.match(polish,/installPremiumEventRefresh/);
assert.match(polish,/premiumRootObserver\.observe\(root,\{childList:true\}\)/);
assert.match(polish,/10000/);
assert.ok(!/premiumRootObserver\.observe\([^\n]*subtree:true/.test(polish),'premium replacement observer must not watch a subtree');

// Presentation layer must not replace warehouse stock/master engines.
assert.ok(!/window\.stockBuckets\s*=/.test(js));
assert.ok(!/window\.saveDb\s*=/.test(js));
assert.ok(!/window\.confirmPicking\s*=/.test(js));

console.log('Premium Dashboard V2 + notifications + Lina digital request + event-driven performance contract OK');
