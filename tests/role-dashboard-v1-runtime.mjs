import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('role-dashboard-v1.js','utf8');
const patch=fs.readFileSync('role-dashboard-v1-patch.js','utf8');
const css=fs.readFileSync('role-dashboard-v1.css','utf8');
const polish=fs.readFileSync('ux-polish-v3.js','utf8');

assert.match(js,/2026\.08\.27-role-dashboard1/);
assert.match(js,/accessLandingV1/);
assert.match(js,/>ACCEDI</);
assert.match(js,/Gestione Magazzino/);

// PIN hash extensions: 4444 = Lina, 5555 = Luca.
assert.match(js,/affce9023143d551660fdacd5a3c8c827c31fd3e521331e38bc8a375ef4cedc2'\]='Lina'/);
assert.match(js,/549df9b2f2268e5c381ff04aa5019cf4f5eb6c8768821c23a7b42cb5c31fa2ff'\]='Luca'/);

// Role matrix.
assert.match(js,/Mattia:\{role:'ADMIN'/);
assert.match(js,/Massimo:\{role:'OPERATORE_FULL'/);
assert.match(js,/Alessandra:\{role:'SUPERVISORE'/);
assert.match(js,/Lina:\{role:'RICHIEDENTE'/);
assert.match(js,/Luca:\{role:'SUPERVISORE'/);
assert.match(js,/REQUEST_CREATE/);
assert.match(js,/REQUEST_PROCESS/);
assert.match(js,/MASTER/);
assert.match(js,/guard\(cap,label,fn\)/);
assert.match(js,/installPermissionGuards/);
assert.match(js,/rdReadOnly/);

// Approved dashboard structure.
for(const label of ['MOVIMENTA','GIACENZE','RICHIESTE','REGISTRO','NUOVA RICHIESTA','AVANZAMENTO','COMPLETAMENTO','MOVIMENTI','AUDIT','ESPORTA MOVIMENTI','RIEPILOGO ATTIVITÀ'])assert.ok(js.includes(label),`missing ${label}`);
assert.match(js,/MASTER EXCEL/);
assert.match(js,/DETTAGLI/);
assert.match(js,/renderRequestProgress/);
assert.match(js,/renderRequestCompletion/);
assert.match(js,/renderAudit/);
assert.match(js,/exportRoleMovementsV1/);
assert.match(js,/stock_transfers/);
assert.match(js,/rectifications/);

// Lina gets only stock search + request creation/progress at Home.
assert.match(js,/if\(!isLina\(\)\)\{[\s\S]*MOVIMENTA/);
assert.match(js,/if\(!isLina\(\)\)cards\.push\(moduleCard\('registry'/);
assert.match(js,/const stockActions=\[action\('CERCA'/);
assert.match(js,/if\(!isLina\(\)\)\{stockActions\.push/);

// Responsive / visual system: one brand logo in topbar, home hero hidden, subtle graphics.
assert.match(css,/#home>\.hero/);
assert.match(css,/display:none!important/);
assert.match(css,/body::after/);
assert.match(css,/opacity:\.035/);
assert.match(css,/rdModules\{display:grid;grid-template-columns:repeat\(4/);
assert.match(css,/@media\(max-width:899px\)/);
assert.match(css,/rdModules\{grid-template-columns:1fr/);
assert.match(css,/rdMaster/);
assert.match(css,/rdActivity/);

// Mobile/desktop switch lives in topbar as compact icons.
assert.match(js,/rdViewIconsV1/);
assert.match(js,/rdDesktopViewV1/);
assert.match(js,/rdPhoneViewV1/);
assert.match(patch,/@media\(max-width:899px\)/);
assert.match(patch,/\.rdViewIcons\{display:flex!important/);

// Minimal operational screens and new absence wording.
assert.match(css,/mgrModeHint/);
assert.match(css,/scaUnverified\{display:none!important/);
assert.match(patch,/NON PRESENTE/);
assert.match(patch,/NON È PRESENTE/);
assert.match(patch,/Atteso: \$\{expected\} · Contato: 0/);

// Existing final UX layer loads the new modules without touching the data engines.
assert.match(polish,/role-dashboard-v1\.js/);
assert.match(polish,/role-dashboard-v1-patch\.js/);
assert.ok(!/window\.saveDb\s*=/.test(js),'role dashboard must not replace saveDb');
assert.ok(!/window\.stockBuckets\s*=/.test(js),'role dashboard must not replace stock engine');

console.log('Role Dashboard V1 integrity OK');
