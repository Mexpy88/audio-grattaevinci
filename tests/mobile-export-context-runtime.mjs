import fs from 'node:fs';
import assert from 'node:assert/strict';

const patch=fs.readFileSync('role-dashboard-v1-patch.js','utf8');

assert.match(patch,/2026\.08\.27-role-dashboard-patch1\.3-contextual-export/);
assert.match(patch,/function mobileExportVisible\(\)/);
assert.match(patch,/!smartphoneMode\(\)\|\|!can\('EXPORT'\)/);
assert.match(patch,/db\?\.master\?\.rows/);
assert.match(patch,/dirtyCount\(\)<=0/);
assert.match(patch,/document\.querySelector\('\.screen\.on'\)\?\.id==='home'/);
assert.match(patch,/rdMobileExportContextHidden/);
assert.match(patch,/bar\.classList\.toggle\('rdMobileExportContextHidden',mobile&&!visible\)/);
assert.match(patch,/if\(!mobileExportVisible\(\)\)return false/);
assert.match(patch,/document\.addEventListener\('click',[\s\S]*patchMobileExport/);

// Contextual export must remain a presentation layer only.
assert.ok(!/window\.renderRegistry\s*=/.test(patch));
assert.ok(!/window\.setRegistryTab\s*=/.test(patch));
assert.ok(!/window\.syncAuthUI\s*=/.test(patch));
assert.ok(!/window\.saveDb\s*=/.test(patch));

console.log('Contextual smartphone export visibility OK');
