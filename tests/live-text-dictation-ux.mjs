import fs from 'node:fs';
const client=fs.readFileSync('voice-top-broker-client.js','utf8');
const index=fs.readFileSync('index.html','utf8');
for(const forbidden of ['window.SpeechRecognition','window.webkitSpeechRecognition','new SpeechRecognition','new webkitSpeechRecognition','WarehouseSpeechBroker.start','facoltativo','obbligatorio']){
  if(client.includes(forbidden))throw new Error(`Live dictation client must not contain/use: ${forbidden}`);
}
for(const required of ['voiceLiveDialog','voiceLiveText','voiceLiveRun','voiceLiveClear','PULISCI','ANNULLA','ELABORA','microfono della tastiera','addEventListener(\'input\'','TESTO ACQUISITO','openCapture']){
  if(!client.includes(required))throw new Error(`Live dictation UX missing: ${required}`);
}
if(index.includes('top-level-speech-broker.js'))throw new Error('Top-level browser speech broker must not be loaded anymore');
if(index.includes('optional-pallet-fix.js'))throw new Error('Obsolete optional-pallet layer must not be loaded');
if(!index.includes('flex-position-v2.js')||!index.includes('voice-top-broker-client.js'))throw new Error('New flexible position/live text modules are not loaded');
if(!client.includes("if(!p.location&&!p.pallet)return 'Inserisci Fila/Scaffale oppure Bancale/Carrello.'"))throw new Error('Voice context must accept either shelf or pallet');
console.log('Live text dictation UX OK: no browser speech engine calls, realtime textarea capture, clean actions and flexible position context.');
