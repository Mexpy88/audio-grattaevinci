import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('validation-sounds.js','utf8');
for(const forbidden of ['window.alert=','window.alert =','window.confirm=','window.confirm =','window.show=','window.show =','MutationObserver','audioSession.type']){
  if(source.includes(forbidden))throw new Error(`Unsafe global/audio hook found: ${forbidden}`);
}
for(const required of ['WarehouseValidationSounds','confirmOperation','submitLogin','confirmPicking','importMappedMaster','pointerdown','AudioContext']){
  if(!source.includes(required))throw new Error(`Required safe sound feature missing: ${required}`);
}

let ticks=0,oscillators=0;
class FakeParam{
  setValueAtTime(){}
  exponentialRampToValueAtTime(){}
}
class FakeOscillator{
  constructor(){this.frequency=new FakeParam()}
  connect(){}
  start(){oscillators++}
  stop(){}
}
class FakeGain{
  constructor(){this.gain=new FakeParam()}
  connect(){}
}
class FakeAudioContext{
  constructor(){this.state='running';this.currentTime=1;this.destination={}}
  createOscillator(){return new FakeOscillator()}
  createGain(){return new FakeGain()}
  resume(){this.state='running';return Promise.resolve()}
}
const store=new Map();
const listeners=[];
const loginError={classList:{contains:()=>true}};
const deleteMasterError={classList:{contains:()=>true}};
const document={
  visibilityState:'visible',
  addEventListener:(name,fn)=>listeners.push([name,fn]),
  getElementById:id=>id==='loginError'?loginError:id==='deleteMasterError'?deleteMasterError:null
};
const context={
  window:null,
  console,
  document,
  performance:{now:()=>{ticks+=500;return ticks}},
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))},
  AudioContext:FakeAudioContext,
  db:{master:{rows:[{id:1}],imported_at:'2026-08-24T10:00:00Z'},movements:[],documents:[],requests:[],audits:[]},
  currentUser:'',
  confirmOperation(){this.db.movements.push({id:'M1'})},
  saveMovementEdit(){this.db.audits.push({id:'A1'})},
  cancelMovement(){this.db.audits.push({id:'A2'})},
  saveRequestFromReview(){this.db.requests.push({id:'R1'})},
  deleteRequest(){this.db.requests.pop()},
  confirmPicking(){this.db.documents.push({id:'D1'})},
  importMappedMaster(){this.db.master.imported_at='2026-08-24T11:00:00Z'},
  async submitLogin(){this.currentUser='Mattia'},
  async confirmDeleteMaster(){this.db.master.rows=[]}
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'validation-sounds.js'});
const api=context.WarehouseValidationSounds;
if(!api)throw new Error('Validation sound API missing');
if(!listeners.some(([n])=>n==='pointerdown'))throw new Error('Audio unlock is not tied to a user gesture');

const beforeOperation=oscillators;
context.confirmOperation();
if(oscillators-beforeOperation!==2)throw new Error('Verified warehouse operation did not emit exactly one two-tone success cue');

const beforeEdit=oscillators;
context.saveMovementEdit();
if(oscillators-beforeEdit!==2)throw new Error('Movement edit did not emit success cue');

const beforeLogin=oscillators;
await context.submitLogin();
if(context.currentUser!=='Mattia')throw new Error('Wrapped login changed original login behavior');
if(oscillators-beforeLogin!==2)throw new Error('Successful PIN login did not emit success cue');

const beforePick=oscillators;
context.confirmPicking();
if(context.db.documents.length!==1||oscillators-beforePick!==2)throw new Error('Picking wrapper changed behavior or missed success cue');

const beforeHidden=oscillators;
document.visibilityState='hidden';
context.saveMovementEdit();
if(oscillators!==beforeHidden)throw new Error('Sound played while app was in background');
document.visibilityState='visible';

api.setEnabled(false);
const beforeDisabled=oscillators;
context.cancelMovement();
if(oscillators!==beforeDisabled)throw new Error('Disabled validation sounds still played');
api.setEnabled(true);

const beforeError=oscillators;
api.error();
if(oscillators-beforeError!==2)throw new Error('Error cue is not a two-tone sound');

console.log('Validation sounds runtime OK: no global UI overrides, verified state-change cues work, PIN success works, background/disabled states are silent.');
