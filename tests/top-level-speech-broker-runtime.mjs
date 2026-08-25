import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('top-level-speech-broker.js','utf8');
for(const forbidden of ['getUserMedia','AudioContext','webkitAudioContext']){
  if(source.includes(forbidden))throw new Error(`Top-level speech broker must not use competing capture/audio path: ${forbidden}`);
}
for(const required of ['WarehouseSpeechBroker','SpeechRecognition','webkitSpeechRecognition','warehouseApp','executeTranscript','openFallback']){
  if(!source.includes(required))throw new Error(`Top-level speech broker missing: ${required}`);
}

let executed=null,fallback=null;
const controls=[{dataset:{},classList:{add(){},remove(){}},disabled:false,innerHTML:'PARLA'}];
const childDocument={querySelectorAll:()=>controls};
const childWindow={
  WarehouseVoiceCommands:{executeTranscript:(text,hint)=>{executed={text,hint}}},
  WarehouseVoiceTopClient:{openFallback:(hint,message)=>{fallback={hint,message}}},
  warehouseToast(){}
};
const iframe={contentWindow:childWindow,contentDocument:childDocument};
const document={getElementById:id=>id==='warehouseApp'?iframe:null};
let lastRec=null;
class FakeRecognition{
  constructor(){lastRec=this}
  start(){this.started=true}
  stop(){this.stopped=true}
}
let tick=1000;
const context={window:null,document,console,SpeechRecognition:FakeRecognition,performance:{now:()=>tick},setTimeout:(fn)=>fn()};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'top-level-speech-broker.js'});
const api=context.WarehouseSpeechBroker;
if(!api)throw new Error('WarehouseSpeechBroker API missing');
if(!api.start('MODIFICA'))throw new Error('Top-level broker did not start');
if(!lastRec?.started)throw new Error('SpeechRecognition was not started in top-level document');
lastRec.onstart?.();
lastRec.onaudiostart?.();
lastRec.onresult?.({results:[[{transcript:'elimina articolo I30872 taglia L'}]]});
if(executed?.hint!=='MODIFICA'||executed?.text!=='elimina articolo I30872 taglia L')throw new Error(`Transcript was not routed back to iframe: ${JSON.stringify(executed)}`);
lastRec.onend?.();
if(fallback)throw new Error('Fallback opened during successful recognition');
console.log('Top-level speech broker runtime OK: recognition runs outside iframe and transcript is routed back safely.');
