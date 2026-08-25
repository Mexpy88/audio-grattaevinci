import fs from 'node:fs';
const client=fs.readFileSync('voice-top-broker-client.js','utf8');
const top=fs.readFileSync('top-level-live-dictation.js','utf8');
const index=fs.readFileSync('index.html','utf8');
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
if(!index.includes('top-level-live-dictation.js')||!index.includes('flex-position-v2.js')||!index.includes('voice-top-broker-client.js'))throw new Error('Top-level dictation/flexible position modules are not loaded');
if(!client.includes("if(!p.location&&!p.pallet)return 'Inserisci Fila/Scaffale oppure Bancale/Carrello.'"))throw new Error('Voice context must accept either shelf or pallet');
console.log('Top-level live dictation UX OK: editable Gboard-friendly textarea outside iframe, realtime text and flexible position context.');
