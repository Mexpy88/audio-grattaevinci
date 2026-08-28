import fs from 'node:fs';

const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
let html=manifest.parts.map(p=>fs.readFileSync(p,'utf8')).join('');
if(!html.includes('bundle/mobile-v4.css')){
  html=html.replace('</head>','<link rel="stylesheet" href="bundle/mobile-v4.css?v=20260828-v5"></head>');
}
fs.writeFileSync('index.html',html,'utf8');
console.log(`NOVA direct static shell generated: ${Buffer.byteLength(html)} bytes`);
