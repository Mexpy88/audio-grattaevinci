import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('mobile-navigation-hotfix.js','utf8');
const scheduled=[];
const elements=new Map();
function el(id){return {id,value:'',textContent:'',innerHTML:''};}
for(const id of ['searchInput','uxSearchState','uxSearchSummary','stockList'])elements.set(id,el(id));

let heavyRenderCalls=0;
function baseShow(id){return 'SHOW:'+id;}
function wrappedShow(id){return 'WRAPPED:'+id;}
wrappedShow.__msv3Original=baseShow;

const context={
  window:null,
  document:{getElementById(id){return elements.get(id)||null;}},
  console,
  setTimeout(fn){scheduled.push(fn);return scheduled.length;},
  clearTimeout(){},
  show:wrappedShow,
  renderStock(){heavyRenderCalls++;}
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'mobile-navigation-hotfix.js'});

if(context.show!==baseShow)throw new Error('Base show router was not restored');

// Empty search must not invoke the heavy renderer.
context.renderStock();
if(heavyRenderCalls!==0)throw new Error('Empty search invoked heavy renderer');
if(!elements.get('stockList').innerHTML.includes('I00215-S'))throw new Error('Empty-search helper not rendered');

// A real query must delegate to Mobile Search V3.
elements.get('searchInput').value='I00215-S';
context.renderStock();
if(heavyRenderCalls!==1)throw new Error('Real query did not delegate to stock renderer');

// Delayed re-install must keep navigation stable.
for(const fn of scheduled)fn();
if(context.show!==baseShow)throw new Error('Delayed install re-broke base navigation');

console.log('Mobile navigation hotfix runtime OK: base HOME routing preserved and empty-search overload prevented.');
