import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync('gboard-voice-normalizer.js','utf8');
let forwarded='';
const sandbox={
  window:{WarehouseVoiceCommands:{executeTranscript(raw){forwarded=raw;return raw}}},
  db:{master:{rows:[
    {article_base:'I30872MUHF'},
    {article_base:'I30871AGUHF'},
    {article_base:'I30871NERUHF'}
  ]}},
  stockBuckets(){return []},
  normalizeArticle(v){return String(v||'').toUpperCase()}
};
sandbox.window.window=sandbox.window;
vm.createContext(sandbox);vm.runInContext(src,sandbox);
const api=sandbox.window.WarehouseGboardNormalizer;
if(!api)throw new Error('Gboard normalizer not installed');
const cases=[
  ['I30872 m u HF','I30872MUHF'],
  ['i30872 muhf','I30872MUHF'],
  ['I 3 0 8 7 2 M U H F taglia L pezzi 50 nuovo','I30872MUHF taglia L pezzi 50 nuovo'],
  ['1 3 0 8 7 2 m u h f taglia M 40 scaricato','I30872MUHF taglia M 40 scaricato'],
  ['I tre zero otto sette due emme u acca effe taglia L','I30872MUHF taglia L'],
  ['I30872 m u HF taglia L 50 nuovo, i30871 a g u h f taglia M 40 scaricato','I30872MUHF taglia L 50 nuovo, I30871AGUHF taglia M 40 scaricato']
];
for(const [raw,expected] of cases){const got=api.normalize(raw);if(got!==expected)throw new Error(`Normalize failed\nraw: ${raw}\nexpected: ${expected}\ngot: ${got}`)}
const p=api.preview('I30872 m u HF');
if(p.normalized!=='I30872MUHF'||!p.knownCodes.includes('I30872MUHF'))throw new Error('Live preview must expose recognized Master article');
sandbox.window.WarehouseVoiceCommands.executeTranscript('I30872 m u HF taglia L 50 nuovo','CARICA');
if(!forwarded.startsWith('I30872MUHF taglia L 50 nuovo'))throw new Error('Final parser wrapper did not receive normalized Gboard text');
console.log('Gboard normalizer runtime OK: spaced, mixed-case, spoken-character and multi-article codes normalize against the loaded Master.');