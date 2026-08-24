import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('validation-sounds.js','utf8');
for(const required of ['WarehouseValidationSounds','AudioContext','pointerdown','classifyMessage','wrapSubmitLogin','saveMovementEdit','cancelMovement','saveRequestFromReview','deleteRequest']){
  if(!source.includes(required))throw new Error(`Required validation-sound feature missing: ${required}`);
}
if(/audioSession\s*\.\s*type\s*=/.test(source))throw new Error('Validation sounds must not force a playback audio session; silent/ringer behavior must remain OS-controlled.');

let clock=0;
let starts=0;
const alerts=[];
const statuses=[];
const toasts=[];
const store=new Map();
const session=new Map();
const elements={
  loginError:{classList:{contains:()=>true}},
  deleteMasterError:{classList:{contains:()=>true}}
};

class FakeAudioContext{
  constructor(){this.state='running';this.currentTime=1;this.destination={}}
  resume(){this.state='running';return Promise.resolve()}
  createOscillator(){return {type:'sine',frequency:{setValueAtTime(){}},connect(){},start(){starts++},stop(){}}}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}
}

const context={
  window:null,
  console,
  setTimeout:(fn)=>{fn();return 1},
  performance:{now:()=>{clock+=500;return clock}},
  document:{visibilityState:'visible',getElementById:id=>elements[id]||null},
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
  sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)},
  AudioContext:FakeAudioContext,
  addEventListener(){},
  alert(message){alerts.push(String(message))},
  setStatus(id,message,type){statuses.push({id,message,type})},
  warehouseToast(message,type){toasts.push({message,type})},
  currentUser:'',
  db:{master:{rows:[],imported_at:null},movements:[],documents:[],requests:[{id:'R1'}],audits:[]},
  async submitLogin(){context.currentUser='Mattia';session.set('so_current_user','Mattia')},
  async confirmDeleteMaster(){},
  saveMovementEdit(){context.db.audits.unshift({action:'UPDATE'})},
  cancelMovement(){context.db.audits.unshift({action:'CANCEL'})},
  saveRequestFromReview(){context.db.requests.unshift({id:'R2'})},
  deleteRequest(){context.db.requests.pop()}
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'validation-sounds.js'});

const api=context.WarehouseValidationSounds;
if(!api)throw new Error('Validation sound API missing');
if(api.classifyMessage('Scarico SC-2026-00001 registrato.')!=='success')throw new Error('Success alert classification failed');
if(api.classifyMessage('Inserisci Fila/Scaffale e Bancale.')!=='error')throw new Error('Validation error classification failed');
if(api.classifyMessage('Condivisione annullata.')!==null)throw new Error('Neutral/cancelled message must not create a validation sound');

let before=starts;
api.play('success');
if(starts-before!==2)throw new Error(`Success cue should use two short tones, got ${starts-before}`);
before=starts;
context.alert('Giacenza insufficiente per una delle righe.');
if(starts-before!==2||alerts.at(-1)!=='Giacenza insufficiente per una delle righe.')throw new Error('Wrapped error alert did not preserve alert and play the error cue');
before=starts;
context.setStatus('importStatus','Risultato importato.','good');
if(starts-before!==2||statuses.length!==1)throw new Error('Good status did not produce one success cue');

before=starts;
await context.submitLogin();
if(starts-before!==2||context.currentUser!=='Mattia')throw new Error('Successful PIN login did not produce a success cue');
before=starts;
context.saveMovementEdit();
if(starts-before!==2)throw new Error('Movement edit did not produce a success cue');
before=starts;
context.cancelMovement();
if(starts-before!==2)throw new Error('Movement cancellation did not produce a success cue');
before=starts;
context.saveRequestFromReview();
if(starts-before!==2)throw new Error('Request creation did not produce a success cue');
before=starts;
context.deleteRequest();
if(starts-before!==2)throw new Error('Request deletion did not produce a success cue');

context.document.visibilityState='hidden';
before=starts;
if(api.play('success')!==false||starts!==before)throw new Error('Hidden/background page must not play feedback sounds');
context.document.visibilityState='visible';
api.setEnabled(false);
before=starts;
if(api.play('error')!==false||starts!==before)throw new Error('Disabled feedback sounds must remain silent');
api.setEnabled(true);

console.log('Validation sounds runtime OK: success/error cues work, wrappers preserve app behavior, background/disabled states stay silent, and OS audio-session behavior is not overridden.');
