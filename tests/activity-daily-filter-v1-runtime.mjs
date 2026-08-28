import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('activity-daily-filter-v1.js','utf8');
const polish=fs.readFileSync('ux-polish-v3.js','utf8');

assert.match(js,/2026\.08\.28-activity-daily-filter1-lina-goods3/);
assert.match(js,/RIEPILOGO ATTIVITÀ/);
assert.match(js,/rdActivityCalendarV1/);
assert.match(js,/type=\"date\"/);
assert.match(js,/max=\"\$\{h\(todayKey\(\)\)\}\"/);
assert.match(js,/setRoleActivityDateV1/);
assert.match(js,/resetRoleActivityDateV1/);
assert.match(js,/OGGI/);

// Every activity metric is evaluated against the same selected local calendar key.
assert.match(js,/sameDay\(m\?\.operation_at\|\|m\?\.registered_at,key\)/);
assert.match(js,/sameDay\(t\?\.created_at\|\|t\?\.operation_at\|\|t\?\.registered_at,key\)/);
assert.match(js,/sameDay\(requestCreatedAt\(r\),key\)/);
assert.match(js,/sameDay\(completionAt\(r,audits\),key\)/);
assert.match(js,/completion\?\.closed_at/);
assert.match(js,/Richieste ricevute/);
assert.match(js,/Richieste completate/);
assert.match(js,/dayAudits=audits\.filter\(a=>sameDay\(a\?\.at,key\)\)/);

// Lina wording is user-facing only and is re-applied whenever the receipt hub renderer replaces its direct children.
assert.match(js,/function decorateLinaGoodsLabel/);
assert.match(js,/if\(!isLina\(\)\)return false/);
assert.match(js,/ARRIVI MERCE/);
assert.match(js,/MERCE ARRIVATA/);
assert.match(js,/rdGoodsReceiptModuleV1/);
assert.match(js,/grHubAction b/);
assert.match(js,/function observeGoodsHub/);
assert.match(js,/goodsHubObserver\.observe\(host,\{childList:true\}\)/);
assert.ok(!/goodsHubObserver\.observe\([^\n]*subtree:true/.test(js));
assert.match(js,/function wrapGoodsHub/);
assert.match(js,/function wrapGoodsList/);
assert.match(js,/__grGoodsListReturnV1/);
assert.match(js,/from==='home'\?'home':'grHubV1'/);

// The dashboard observer is restricted to direct children: changing the activity card itself cannot self-trigger.
assert.match(js,/rootObserver\.observe\(root,\{childList:true\}\)/);
assert.ok(!/rootObserver\.observe\([^\n]*subtree:true/.test(js));

// Loader integration.
assert.match(polish,/activity-daily-filter-v1\.js/);
assert.match(polish,/loadActivityDailyFilter/);
assert.match(polish,/WarehouseActivityDailyFilterV1\?\.decorate/);

// Presentation-only layer: never replace warehouse persistence or stock/request engines.
assert.ok(!/window\.saveDb\s*=/.test(js));
assert.ok(!/window\.stockBuckets\s*=/.test(js));
assert.ok(!/window\.confirmPicking\s*=/.test(js));
assert.ok(!/db\s*=/.test(js));

console.log('Daily activity + persistent Lina goods-arrived wording contract OK');
