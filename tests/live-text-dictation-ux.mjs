import fs from 'node:fs';
import vm from 'node:vm';
const client=fs.readFileSync('voice-top-broker-client.js','utf8');
const top=fs.readFileSync('top-level-live-dictation.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const gboard=fs.readFileSync('gboard-voice-normalizer.js','utf8');
const gboardUx=fs.readFileSync('top-level-gboard-ux.js','utf8');
for(const forbidden of ['window.SpeechRecognition','window.webkitSpeechRecognition','new SpeechRecognition','new webkitSpeechRecognition','WarehouseSpeechBroker.start','facoltativo','obbligatorio']){
  if(client.includes(forbidden)||top.includes(forbidden))throw new Error(`Live dictation must not contain/use: ${forbidden}`);
}
for(const required of ['wtldDialog','wtldText','wtldRun','wtldClear','PULISCI','ANNULLA','ELABORA','microfono della tastiera','addEventListener(\'input\'','TESTO ACQUISITO','inputmode="text"','autocomplete="on"','autocorrect="on"','spellcheck="true"','WarehouseTopLevelDictation']){
  if(!top.includes(required))throw new Error(`Top-level dictation UX missing: ${required}`);
}
if(/readonly|type="password"/i.test(top))throw new Error('Top-level dictation editor must be a normal editable text field');
if(!client.includes('window.parent')||!client.includes('WarehouseTopLevelDictation.open'))throw new Error('Iframe voice client must delegate capture to top-level editor');
if(index.includes('top-level-speech-broker.js'))throw new Error('Browser SpeechRecognition broker must not be loaded anymore');
if(index.includes('optional-pallet-fix.js'))throw new Error('Obsolete optional-pallet layer must not be loaded');
for(const required of ['top-level-live-dictation.js','top-level-gboard-ux.js','gboard-voice-normalizer.js','flex-position-v2.js','voice-top-broker-client.js'])if(!index.includes(required))throw new Error(`Required dictation module not loaded: ${required}`);
if(!client.includes("if(!p.location&&!p.pallet)return 'Inserisci Fila/Scaffale oppure Bancale/Carrello.'"))throw new Error('Voice context must accept either shelf or pallet');
new vm.Script(gboard);new vm.Script(gboardUx);
for(const required of ['INTERPRETAZIONE LIVE','WarehouseGboardNormalizer','compositionend','gboardLivePreview'])if(!gboardUx.includes(required))throw new Error(`Gboard live UX missing ${required}`);
if(/\.value\s*=\s*[^;]*normalized/.test(gboardUx))throw new Error('Gboard UX must not rewrite the live textarea with normalized text');

let forwarded='';
const sandbox={window:{WarehouseVoiceCommands:{executeTranscript(raw){forwarded=raw;return raw}}},db:{master:{rows:[{article_base:'I30872MUHF'},{article_base:'I30871AGUHF'}]}},stockBuckets(){return []},normalizeArticle(v){return String(v||'').toUpperCase()}};
sandbox.window.window=sandbox.window;vm.createContext(sandbox);vm.runInContext(gboard,sandbox);
const api=sandbox.window.WarehouseGboardNormalizer;if(!api)throw new Error('Gboard normalizer not installed');
const cases=[
 ['I30872 m u HF','I30872MUHF'],
 ['i30872 muhf','I30872MUHF'],
 ['I 3 0 8 7 2 M U H F taglia L pezzi 50 nuovo','I30872MUHF taglia L pezzi 50 nuovo'],
 ['I tre zero otto sette due emme u acca effe taglia L','I30872MUHF taglia L'],
 ['I30872 m u HF taglia L 50 nuovo, i30871 a g u h f taglia M 40 scaricato','I30872MUHF taglia L 50 nuovo, I30871AGUHF taglia M 40 scaricato']
];
for(const [raw,expected] of cases){const got=api.normalize(raw);if(got!==expected)throw new Error(`Gboard normalization failed: ${raw} -> ${got}; expected ${expected}`)}
const preview=api.preview('I30872 m u HF');if(preview.normalized!=='I30872MUHF'||!preview.knownCodes.includes('I30872MUHF'))throw new Error('Live interpretation must identify known Master code');
sandbox.window.WarehouseVoiceCommands.executeTranscript('I30872 m u HF taglia L 50 nuovo','CARICA');if(!forwarded.startsWith('I30872MUHF'))throw new Error('Normalized Gboard text was not forwarded to warehouse parser');
console.log('Top-level live/Gboard UX OK: non-destructive realtime interpretation and Master-aware article normalization verified.');