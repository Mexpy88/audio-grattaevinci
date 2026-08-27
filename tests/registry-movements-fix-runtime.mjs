import fs from 'node:fs';
import assert from 'node:assert/strict';

const fix=fs.readFileSync('registry-movements-fix-v1.js','utf8');
const polish=fs.readFileSync('ux-polish-v3.js','utf8');
const role=fs.readFileSync('role-dashboard-v1.js','utf8');

assert.match(fix,/2026\.08\.27-registry-movements-fix1/);
assert.match(fix,/window\.openRoleRegistryMovementsV1=openMovements/);
assert.match(fix,/setRegistryTab\('MOVIMENTI'\)/);
assert.match(fix,/show\('registryScreen'\)/);
assert.match(fix,/renderRegistry/);
assert.match(fix,/REGISTRY_VIEW/);
assert.match(fix,/Registro movimenti/);
assert.match(fix,/tabs\.style\.display='none'/);
assert.match(fix,/rdReadOnly/);

// Dashboard still points to the role action; fix overrides that live global function.
assert.match(role,/openRoleRegistryMovementsV1\(\)/);
assert.match(polish,/registry-movements-fix-v1\.js/);
assert.match(polish,/loadRegistryFix/);
assert.match(polish,/loadFloatingConfirm[\s\S]*loadRegistryFix/);

// Repair must not replace registry data engine or persistence.
assert.ok(!/window\.renderRegistry\s*=(?!=)/.test(fix));
assert.ok(!/window\.saveDb\s*=(?!=)/.test(fix));
assert.ok(!/window\.setRegistryTab\s*=(?!=)/.test(fix));

console.log('Registry Movimenti direct-opening fix OK');
