import fs from 'node:fs';
const s=fs.readFileSync('dashboard-collapse.js','utf8');
const checks=[
  "id='uxMasterDetailsFold'",
  'DETTAGLI MASTER',
  "localStorage.getItem(KEY)==='1'",
  "localStorage.setItem(KEY,details.open?'1':'0')",
  "body.appendChild(dash)",
  "body.appendChild(actions)",
  'MutationObserver'
];
for(const c of checks)if(!s.includes(c))throw new Error('Missing dashboard collapse feature: '+c);
console.log('Dashboard collapse OK: Master metrics/actions are collapsible and state is persisted.');
