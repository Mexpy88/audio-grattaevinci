import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('voice-mic-runtime-fix.js','utf8');
for(const forbidden of ['getUserMedia','AudioContext','window.alert=','window.confirm=']){
  if(source.includes(forbidden))throw new Error(`Microphone runtime fix must not use competing capture/audio path: ${forbidden}`);
}
for(const required of ['SpeechRecognition','webkitSpeechRecognition','aborted','retryAfterEnd','executeTranscript','stopImmediatePropagation','noTapSound']){
  if(!source.includes(required))throw new Error(`Required microphone handoff safeguard missing: ${required}`);
}

const listeners=[];
const status={textContent:'',className:''};
const locationInput={value:'63'};
const palletInput={value:'134'};
const control={
  id:'voiceSpeakMore',disabled:false,dataset:{},classList:{add(){},remove(){}},innerHTML:'🎙 PARLA ANCORA',
  closest(selector){return selector.includes('#voiceSpeakMore')?this:null}
};
const document={
  addEventListener:(name,fn,capture)=>listeners.push([name,fn,capture]),
  querySelectorAll:selector=>selector==='.voiceStatus'?[status]:selector.includes('.voiceBtn')?[control]:[],
  getElementById:id=>id==='stockEditLocation'?locationInput:id==='stockEditPallet'?palletInput:null
};
let recognitions=0;
let executions=[];
class FakeRecognition{
  constructor(){this.instance=++recognitions}
  start(){
    this.onstart?.();
    if(this.instance===1){this.onerror?.({error:'aborted'});this.onend?.();return}
    this.onaudiostart?.();
    this.onresult?.({results:[[{transcript:'elimina articolo I30871NERUHF taglia S pezzi 10 scaricato'}]]});
    this.onend?.();
  }
  stop(){this.onend?.()}
}
const context={
  window:null,document,console,setTimeout,clearTimeout,
  performance:{now:(()=>{let n=0;return()=>n+=100})()},
  isSecureContext:true,
  SpeechRecognition:FakeRecognition,
  WarehouseVoiceCommands:{currentHint:()=> 'MODIFICA',executeTranscript:(text,hint)=>executions.push([text,hint])}
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'voice-mic-runtime-fix.js'});
const api=context.WarehouseVoiceMicRuntimeFix;if(!api)throw new Error('Microphone runtime fix API missing');
const click=listeners.find(([name])=>name==='click');if(!click||click[2]!==true)throw new Error('Voice click must be intercepted in capture phase before legacy handler');
let prevented=false,stopped=false;
click[1]({target:control,preventDefault:()=>prevented=true,stopImmediatePropagation:()=>stopped=true,stopPropagation(){}});
await new Promise(r=>setTimeout(r,360));
if(!prevented||!stopped)throw new Error('Legacy voice click was not intercepted safely');
if(recognitions!==2)throw new Error(`Immediate aborted startup should retry exactly once, got ${recognitions} recognitions`);
if(executions.length!==1||executions[0][1]!=='MODIFICA')throw new Error(`Transcript was not routed to contextual MODIFICA parser: ${JSON.stringify(executions)}`);
if(control.dataset.noTapSound!=='1')throw new Error('Voice control was not marked silent for UI tap audio');
console.log('Voice microphone runtime fix OK: no getUserMedia handoff, voice click stays synchronous, one immediate aborted retry, transcript reaches contextual parser.');
