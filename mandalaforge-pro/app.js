import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/+esm';
import { TrackballControls } from 'https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/controls/TrackballControls.js/+esm';
import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const FRAME_LIBRARY = [
  ['circle','Cerchio'],['square','Quadrato'],['rectangle','Rettangolo'],['hexagon','Esagono'],['octagon','Ottagono'],
  ['oval','Ovale'],['rounded','Curvo'],['organic','Organico'],['custom','SVG personalizzato']
];
const STYLE_LIBRARY = [
  ['lotus','Lotus'],['floral','Floreale'],['arabesque','Arabesco'],['geometric','Geometrico'],['paisley','Paisley'],
  ['celtic','Celtico'],['artdeco','Art Déco'],['gothic','Gotico'],['moroccan','Marocchino'],['sunburst','Sunburst'],
  ['lace','Pizzo'],['leaf','Foglie'],['wave','Onde'],['star','Stellare'],['petal','Petali'],['honeycomb','Honeycomb'],
  ['baroque','Barocco'],['tribal','Tribale'],['zen','Zen'],['victorian','Vittoriano']
];
const MATERIALS = [
  {id:'painted',name:'Legno verniciato',rough:.64,metal:0,grain:'fine'},
  {id:'poplar',name:'Compensato di pioppo',rough:.78,metal:0,grain:'soft'},
  {id:'birch',name:'Compensato di betulla',rough:.72,metal:0,grain:'birch'},
  {id:'mdf',name:'MDF',rough:.9,metal:0,grain:'speckle'},
  {id:'acrylicGloss',name:'Acrilico lucido',rough:.16,metal:.05,grain:'none'},
  {id:'acrylicMatte',name:'Acrilico opaco',rough:.56,metal:.02,grain:'none'},
  {id:'walnut',name:'Noce',rough:.7,metal:0,grain:'dark'},
  {id:'oak',name:'Rovere',rough:.76,metal:0,grain:'oak'}
];
const ROLES = [['base','Fondo'],['pattern','Pattern'],['mass','Massa'],['focal','Focale'],['detail','Dettaglio'],['highlight','Highlight']];
const DEFAULT_COLORS = ['#172f36','#6b3f2d','#e86035','#f79a2f','#f0d54c','#efe2c9','#9caf77','#b15c43','#d7c4a6','#62504a','#e9c55a','#d86c48'];

const state = {
  mode:'radial', frame:'circle', width:350, height:350, layers:5, thickness:3, bridge:2, frameMargin:8,
  density:58, voidRatio:52, reveal:48, symmetry:12, composition:'balanced', flow:'radial', majorShapes:4,
  focal:'leaf', corners:'medium', seed:1307, selectedStyles:['lotus','arabesque'], layerData:[], motifs:[], customFrame:null,
  explode:0, reference:null, referenceAnalysis:null
};

let renderer, scene, camera, controls, stackGroup, resizeObserver;
let rebuildRAF = 0;

class RNG {
  constructor(seed=1){ this.s=(seed>>>0)||1; }
  next(){ this.s = (Math.imul(this.s,1664525)+1013904223)>>>0; return this.s/4294967296; }
  range(a,b){ return a+(b-a)*this.next(); }
  int(a,b){ return Math.floor(this.range(a,b+1)); }
  pick(arr){ return arr[Math.min(arr.length-1,Math.floor(this.next()*arr.length))]; }
}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const deepClone=o=>JSON.parse(JSON.stringify(o));
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove('show'),1900); }
function setStatus(title){ $('statusTitle').textContent=title; renderSummary(); }
function roleForIndex(i,n){ if(i===0)return 'base'; if(i===n-1)return 'highlight'; const t=i/(n-1); if(t<.28)return 'pattern'; if(t<.58)return 'mass'; if(t<.8)return 'focal'; return 'detail'; }
function makeLayerData(reset=false){
  const old=reset?[]:state.layerData.slice();
  state.layerData=Array.from({length:state.layers},(_,i)=>({
    color:old[i]?.color||DEFAULT_COLORS[i%DEFAULT_COLORS.length], material:old[i]?.material||(i===0?'birch':'painted'),
    visible:old[i]?.visible??true, style:old[i]?.style||state.selectedStyles[i%state.selectedStyles.length]||'lotus',
    role:old[i]?.role||roleForIndex(i,state.layers), offset:old[i]?.offset??1
  }));
}

function circleLoop(n=96,rx=1,ry=1,phase=0){ const a=[]; for(let i=0;i<n;i++){ const t=phase+i/n*TAU; a.push([Math.cos(t)*rx,Math.sin(t)*ry]); } return a; }
function regularPoly(n,inner=1,phase=-Math.PI/2){ return Array.from({length:n},(_,i)=>{const a=phase+i/n*TAU; return [Math.cos(a)*inner,Math.sin(a)*inner];}); }
function starLoop(points=8,inner=.48,phase=-Math.PI/2){ const out=[]; for(let i=0;i<points*2;i++){const a=phase+i/(points*2)*TAU,r=i%2?inner:1;out.push([Math.cos(a)*r,Math.sin(a)*r]);}return out; }
function rosetteLoop(lobes=8,depth=.18,n=120,phase=0){ const out=[]; for(let i=0;i<n;i++){const a=phase+i/n*TAU,r=1-depth+depth*Math.cos(lobes*a);out.push([Math.cos(a)*r,Math.sin(a)*r]);}return out; }
function leafLoop(n=72,bulge=.72,tip=.95){ const out=[]; for(let i=0;i<=n/2;i++){const t=i/(n/2),x=-1+2*t,y=Math.pow(Math.sin(Math.PI*t),.78)*bulge*(.86+.14*Math.cos(Math.PI*(t-.5)));out.push([x,y]);} for(let i=n/2;i>=0;i--){const t=i/(n/2),x=-1+2*t,y=-Math.pow(Math.sin(Math.PI*t),.78)*bulge;out.push([x,y]);} out[out.length-1][0]-=.001; return out.map(([x,y])=>[x*tip,y]); }
function teardropLoop(n=90,curl=.18){ const out=[]; for(let i=0;i<n;i++){const a=i/n*TAU;let r=.62+.30*(1-Math.sin(a));let x=Math.cos(a)*r,y=Math.sin(a)*r; x+=curl*(1-y)*Math.pow(Math.max(0,.4+y),2); out.push([x*.88,y]);} return out; }
function cloverLoop(lobes=4,n=112){ const out=[]; for(let i=0;i<n;i++){const a=i/n*TAU,r=.68+.27*Math.cos(lobes*a);out.push([Math.cos(a)*r,Math.sin(a)*r]);} return out; }
function scallopLoop(lobes=14,n=140){ const out=[]; for(let i=0;i<n;i++){const a=i/n*TAU,r=.83+.13*Math.cos(lobes*a)+.04*Math.cos(lobes*2*a);out.push([Math.cos(a)*r,Math.sin(a)*r]);}return out; }
function pebbleLoop(rng,n=96){ const p1=rng.range(2,5),p2=rng.range(5,8),ph=rng.range(0,TAU),out=[]; for(let i=0;i<n;i++){const a=i/n*TAU,r=.86+.08*Math.sin(p1*a+ph)+.05*Math.cos(p2*a-ph*.7);out.push([Math.cos(a)*r,Math.sin(a)*r]);}return out; }
function fanLoop(steps=5){ const pts=[[-1,.72],[-.82,.25],[-.62,-.22],[-.38,-.7],[0,-1],[.38,-.7],[.62,-.22],[.82,.25],[1,.72],[.62,.55],[.25,.25],[0,.05],[-.25,.25],[-.62,.55]]; return pts; }
function gothicLoop(){ return [[-0.72,.82],[-.76,.3],[-.64,-.2],[-.38,-.63],[0,-1],[.38,-.63],[.64,-.2],[.76,.3],[.72,.82],[.28,.58],[0,.34],[-.28,.58]]; }
function artDecoLoop(){ return [[-1,.72],[-.72,.72],[-.72,.38],[-.43,.38],[-.43,.05],[-.14,.05],[-.14,-.72],[.14,-1],[.14,.05],[.43,.05],[.43,.38],[.72,.38],[.72,.72],[1,.72],[1,1],[-1,1]]; }
function flameLoop(){ return [[-1,.78],[-.68,.18],[-.45,-.2],[-.28,-.74],[0,-1],[.12,-.38],[.42,-.72],[.35,-.08],[.82,-.48],[.62,.12],[1,.34],[.42,.62],[-.08,.88]]; }
function ribbonAround(points,width=.22){
  const left=[],right=[]; for(let i=0;i<points.length;i++){const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l,w=width*(.8+.2*Math.sin(Math.PI*i/(points.length-1)));left.push([p[0]+nx*w,p[1]+ny*w]);right.push([p[0]-nx*w,p[1]-ny*w]);} return left.concat(right.reverse());
}
function bezierRibbon(kind='s',rng=new RNG(1)){
  const pts=[],n=72; for(let i=0;i<n;i++){const t=i/(n-1),x=-1+2*t; let y;if(kind==='wave')y=.38*Math.sin(t*TAU*1.25+rng.range(-.2,.2));else if(kind==='baroque')y=.5*Math.sin(t*Math.PI*1.5)-.16*Math.sin(t*TAU*2);else y=.55*Math.sin((t-.12)*Math.PI*1.35); pts.push([x,y]);} return ribbonAround(pts,kind==='baroque'?.24:.2);
}
function styleLoop(style,rng=new RNG(1)){
  switch(style){
    case 'lotus': return teardropLoop(92,.04).map(([x,y])=>[x,y*.9]);
    case 'floral': return rosetteLoop(rng.pick([5,6,7]),rng.range(.16,.24),120,rng.range(0,TAU));
    case 'arabesque': return bezierRibbon('s',rng);
    case 'geometric': return [[0,-1],[.34,-.34],[1,0],[.34,.34],[0,1],[-.34,.34],[-1,0],[-.34,-.34]];
    case 'paisley': return teardropLoop(100,rng.range(.18,.34));
    case 'celtic': return cloverLoop(rng.pick([3,4,6]),120);
    case 'artdeco': return artDecoLoop();
    case 'gothic': return gothicLoop();
    case 'moroccan': return starLoop(rng.pick([8,10,12]),rng.range(.38,.52));
    case 'sunburst': return [[-1,.78],[0,-1],[1,.78],[.32,.45],[0,.1],[-.32,.45]];
    case 'lace': return scallopLoop(rng.int(10,18),144);
    case 'leaf': return leafLoop(78,rng.range(.48,.72),1);
    case 'wave': return bezierRibbon('wave',rng);
    case 'star': return starLoop(rng.pick([5,6,8,10]),rng.range(.35,.58));
    case 'petal': return teardropLoop(90,0).map(([x,y])=>[x*.72,y]);
    case 'honeycomb': return regularPoly(6);
    case 'baroque': return bezierRibbon('baroque',rng);
    case 'tribal': return flameLoop();
    case 'zen': return pebbleLoop(rng,100);
    case 'victorian': return rosetteLoop(rng.pick([8,10,12]),rng.range(.11,.19),132,rng.range(0,TAU));
    default: return circleLoop(80);
  }
}
function focalLoop(id,rng){ if(id==='none')return styleLoop('victorian',rng); if(id==='spiral')return bezierRibbon('baroque',rng); if(id==='diamond')return regularPoly(4,1,Math.PI/4); return styleLoop(id,rng); }
function transformLoop(loop,cx,cy,rx,ry,angle=0){ const ca=Math.cos(angle),sa=Math.sin(angle); return loop.map(([x,y])=>{const xx=x*rx,yy=y*ry;return[cx+xx*ca-yy*sa,cy+xx*sa+yy*ca]}); }
function scaleLoop(loop,cx,cy,s){ return loop.map(([x,y])=>[cx+(x-cx)*s,cy+(y-cy)*s]); }
function radiusOf(loop,cx,cy){ let r=0; for(const [x,y] of loop)r=Math.max(r,Math.hypot(x-cx,y-cy)); return r; }
function polyArea(p){ let a=0; for(let i=0,j=p.length-1;i<p.length;j=i++)a+=(p[j][0]*p[i][1]-p[i][0]*p[j][1]); return a/2; }
function pointInPoly(x,y,poly){ let inside=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];const hit=((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi+1e-12)+xi);if(hit)inside=!inside;} return inside; }
function scalePoly(poly,s,cx=500,cy=500){ return poly.map(([x,y])=>[cx+(x-cx)*s,cy+(y-cy)*s]); }
function roundedRectLoop(radius=.13,nc=10){ const r=radius*1000,x0=40,y0=40,x1=960,y1=960,pts=[]; const corners=[[x1-r,y0+r,-Math.PI/2,0],[x1-r,y1-r,0,Math.PI/2],[x0+r,y1-r,Math.PI/2,Math.PI],[x0+r,y0+r,Math.PI,Math.PI*1.5]]; for(const [cx,cy,a0,a1] of corners)for(let i=0;i<=nc;i++){const a=lerp(a0,a1,i/nc);pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);} return pts; }
function organicFrame(seed){ const rng=new RNG(seed*17+91),pts=[],n=160,ph=rng.range(0,TAU); for(let i=0;i<n;i++){const a=i/n*TAU,rx=455*(1+.025*Math.sin(3*a+ph)+.035*Math.sin(5*a-ph*.4)),ry=455*(1+.028*Math.cos(4*a-ph)+.025*Math.sin(7*a));pts.push([500+rx*Math.cos(a),500+ry*Math.sin(a)]);}return pts; }
function makeFrameOuter(){
  if(state.frame==='custom'&&state.customFrame?.length>8)return state.customFrame.map(p=>p.slice());
  if(state.frame==='circle'||state.frame==='oval')return transformLoop(circleLoop(144),500,500,455,state.frame==='oval'?370:455,0);
  if(state.frame==='square'||state.frame==='rectangle')return [[40,40],[960,40],[960,960],[40,960]];
  if(state.frame==='rounded')return roundedRectLoop(.16,12);
  if(state.frame==='hexagon')return transformLoop(regularPoly(6),500,500,455,455,0);
  if(state.frame==='octagon')return transformLoop(regularPoly(8),500,500,460,460,Math.PI/8);
  if(state.frame==='organic')return organicFrame(state.seed);
  return transformLoop(circleLoop(144),500,500,455,455,0);
}
function minPhysical(){ return Math.min(state.width,state.height); }
function safeFrameOuter(){ const outer=makeFrameOuter(), marginNorm=clamp(state.frameMargin/minPhysical()*1000,4,180),s=clamp(1-marginNorm/470,.58,.99); return scalePoly(outer,s); }
function styleForDepth(depth,rng){ const idx=clamp(depth<0?state.layers-1:depth,0,state.layers-1),candidate=state.layerData[idx]?.style; return candidate||rng.pick(state.selectedStyles); }
function roleScaleForDepth(depth){ const role=state.layerData[clamp(depth,0,state.layers-1)]?.role; return ({base:1.18,pattern:.9,mass:1.08,focal:1.28,detail:.72,highlight:.62})[role]||1; }
function chooseDepth(rng){ if(rng.next()<(.035+state.voidRatio/1300))return -1; const n=Math.max(1,state.layers-1),bias=state.reveal/100; const u=Math.pow(rng.next(),.7+bias*1.6); return clamp(Math.floor(u*n),0,n-1); }
function maxHoleScale(){ return 1+(state.layers+1)*(.012+state.reveal*.00028)*1.25; }
function addMotif(list,params,rng,safePoly){
  const {cx,cy,rx,ry,angle=0,depth,style,loop:customLoop}=params; const local=customLoop||styleLoop(style,rng),pts=transformLoop(local,cx,cy,rx,ry,angle),r=radiusOf(pts,cx,cy),grow=maxHoleScale();
  const grown=scaleLoop(pts,cx,cy,grow); if(!grown.every(([x,y])=>pointInPoly(x,y,safePoly)))return false;
  const bridgeNorm=state.bridge/minPhysical()*1000; for(const m of list){if(Math.hypot(cx-m.cx,cy-m.cy)<(r+m.radius)*grow+bridgeNorm*1.3)return false;}
  list.push({cx,cy,points:pts,radius:r,depth,style,angle,rx,ry}); return true;
}
function generateRadialMotifs(){
  const rng=new RNG(state.seed*991+31),list=[],safe=safeFrameOuter(),n=state.symmetry||8,rings=clamp(Math.round(1.5+state.density/34),2,4);
  if(state.focal!=='none')addMotif(list,{cx:500,cy:500,rx:78+state.majorShapes*8,ry:70+state.majorShapes*7,angle:rng.range(0,TAU),depth:chooseDepth(rng),style:state.focal,loop:focalLoop(state.focal,rng)},rng,safe);
  for(let ring=0;ring<rings;ring++){
    const count=ring===0?Math.max(4,Math.round(n/2)):n,rad=145+ring*(255/(Math.max(1,rings-1))),baseSize=clamp(72-ring*8+state.voidRatio*.24,54,105),off=(ring%2)*Math.PI/count;
    for(let k=0;k<count;k++){const a=off+k/count*TAU,depth=chooseDepth(rng),style=styleForDepth(depth,rng),rs=baseSize*roleScaleForDepth(Math.max(0,depth))*rng.range(.78,1.08),aspect=rng.range(.62,1.02);addMotif(list,{cx:500+rad*Math.cos(a),cy:500+rad*Math.sin(a),rx:rs,ry:rs*aspect,angle:a+Math.PI/2+rng.range(-.22,.22),depth,style},rng,safe);}
  }
  const extra=Math.round(state.density/18); for(let e=0;e<extra;e++){const a=rng.range(0,TAU),rad=rng.range(90,365),depth=chooseDepth(rng),style=styleForDepth(depth,rng),sz=rng.range(32,58);addMotif(list,{cx:500+rad*Math.cos(a),cy:500+rad*Math.sin(a),rx:sz,ry:sz*rng.range(.7,1),angle:a,depth,style},rng,safe);}
  return list;
}
function flowPoint(rng,t){
  if(state.flow==='vertical')return [500+Math.sin(t*TAU*1.3)*130+rng.range(-70,70),160+t*680];
  if(state.flow==='diagonal')return [160+t*680,760-t*560+rng.range(-80,80)];
  if(state.flow==='swirl'){const a=t*TAU*1.5+0.2,r=80+t*300;return[500+r*Math.cos(a),500+r*.72*Math.sin(a)];}
  return [150+t*700,500+Math.sin(t*TAU*1.15)*150+rng.range(-70,70)];
}
function generateOrnamentalMotifs(){
  const rng=new RNG(state.seed*787+73),list=[],safe=safeFrameOuter();
  const focalDepth=clamp(Math.round((state.layers-2)*.55),0,state.layers-2),focalStyle=state.focal==='none'?rng.pick(state.selectedStyles):state.focal;
  if(state.focal!=='none')addMotif(list,{cx:state.composition==='free'?rng.range(420,590):500,cy:rng.range(440,555),rx:150+state.majorShapes*13,ry:95+state.majorShapes*8,angle:rng.range(-.55,.55),depth:focalDepth,style:focalStyle,loop:focalLoop(state.focal,rng)},rng,safe);
  const target=clamp(Math.round(7+state.density*.16+state.majorShapes*1.7),10,28),attempts=target*18;
  for(let a=0;a<attempts&&list.length<target;a++){
    const t=rng.next();let [cx,cy]=flowPoint(rng,t); if(state.composition==='balanced'){cx=lerp(cx,500,.08);cy=lerp(cy,500,.08)}
    const depth=chooseDepth(rng),style=styleForDepth(depth,rng),sz=rng.range(52,116)*roleScaleForDepth(Math.max(0,depth)),aspect=rng.range(.48,1.08),angle=(state.flow==='vertical'?Math.PI/2:0)+rng.range(-.75,.75);
    const ok=addMotif(list,{cx,cy,rx:sz,ry:sz*aspect,angle,depth,style},rng,safe);
    if(ok&&(state.composition==='symmetric'||state.composition==='semi')&&list.length<target){if(state.composition==='symmetric'||rng.next()<.55){const mx=1000-cx;addMotif(list,{cx:mx,cy,rx:sz,ry:sz*aspect,angle:Math.PI-angle,depth,style},rng,safe);}}
  }
  const cornerCount={off:0,light:2,medium:4,rich:8}[state.corners]||0,corners=[[145,145],[855,145],[855,855],[145,855]]; for(let i=0;i<cornerCount;i++){const [cx,cy]=corners[i%4],depth=chooseDepth(rng),style=rng.pick(['artdeco','victorian','moroccan','lace','gothic']),sz=rng.range(42,72);addMotif(list,{cx:cx+rng.range(-24,24),cy:cy+rng.range(-24,24),rx:sz,ry:sz,angle:rng.range(0,TAU),depth,style},rng,safe);}
  return list;
}
function generateReferenceMotifs(){
  const a=state.referenceAnalysis;if(!a?.edgePoints?.length)return generateOrnamentalMotifs(); const rng=new RNG(state.seed*631+101),list=[],safe=safeFrameOuter(),target=clamp(Math.round(8+state.density*.17),10,26);
  for(const p of a.edgePoints){if(list.length>=target)break;const cx=60+p[0]*880,cy=60+p[1]*880,depth=clamp(p[3]??chooseDepth(rng),-1,state.layers-2),style=styleForDepth(depth,rng),sz=clamp(45+p[2]*95,45,125)*roleScaleForDepth(Math.max(0,depth));addMotif(list,{cx,cy,rx:sz,ry:sz*rng.range(.55,1.02),angle:p[4]||rng.range(0,TAU),depth,style},rng,safe);}
  return list.length>=6?list:generateOrnamentalMotifs();
}
function buildDesignModel(){
  if(!state.layerData.length||state.layerData.length!==state.layers)makeLayerData();
  state.motifs=state.mode==='radial'?generateRadialMotifs():state.mode==='reference'?generateReferenceMotifs():generateOrnamentalMotifs();
  if(state.motifs.length<6){const rng=new RNG(state.seed*313+17),safe=safeFrameOuter();for(let k=0;k<12&&state.motifs.length<6;k++){const a=k/12*TAU,rad=220+(k%2)*70,depth=chooseDepth(rng),style=styleForDepth(depth,rng);addMotif(state.motifs,{cx:500+rad*Math.cos(a),cy:500+rad*Math.sin(a),rx:38,ry:32,angle:a,depth,style},rng,safe);}}
  return state.motifs;
}
function geometryModel(i){
  const outer=makeFrameOuter(),holes=[]; const ld=state.layerData[i]||{offset:1}; const step=.012+state.reveal*.00028;
  for(const m of state.motifs){if(m.depth<i){const hops=i-m.depth,scale=(1+hops*step)*(ld.offset||1);holes.push(scaleLoop(m.points,m.cx,m.cy,scale));}}
  return {outer,holes};
}
function pathFromLoops(outer,holes,transform=p=>p){ let d=''; const add=loop=>{loop.forEach((p,j)=>{const q=transform(p);d+=(j?'L':'M')+q[0].toFixed(3)+' '+q[1].toFixed(3)+' ';});d+='Z ';}; add(outer); holes.forEach(add); return d; }
function toMm([x,y]){ return [x/1000*state.width,y/1000*state.height]; }
function pathFromModelMm(m){ return pathFromLoops(m.outer,m.holes,toMm); }
function layerSvgMarkup(i,forMini=false){ const ld=state.layerData[i],m=geometryModel(i); return `<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><path d="${pathFromLoops(m.outer,m.holes)}" fill="${ld.color}" fill-rule="evenodd" stroke="rgba(0,0,0,.28)" stroke-width="${forMini?5:2}"/></svg>`; }
function combinedSvgMarkup(){
  const paths=[]; for(let i=0;i<state.layers;i++){const ld=state.layerData[i];if(!ld.visible)continue;const m=geometryModel(i);paths.push(`<path d="${pathFromModelMm(m)}" fill="${ld.color}" fill-rule="evenodd" stroke="rgba(0,0,0,.22)" stroke-width="0.35"/>`);} return `<svg viewBox="0 0 ${state.width} ${state.height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`;
}
function exportLayerSVG(i){ const m=geometryModel(i); return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${state.width}mm" height="${state.height}mm" viewBox="0 0 ${state.width} ${state.height}">\n<title>MandalaForge Pro Layer ${i+1}</title>\n<path d="${pathFromModelMm(m)}" fill="none" stroke="#000000" stroke-width="0.10" fill-rule="evenodd" vector-effect="non-scaling-stroke"/>\n</svg>`; }
function dxfPolyline(loop){ const pts=loop.map(toMm); let s='0\nLWPOLYLINE\n8\nCUT\n90\n'+pts.length+'\n70\n1\n'; for(const [x,y] of pts)s+=`10\n${x.toFixed(4)}\n20\n${(state.height-y).toFixed(4)}\n`; return s; }
function exportLayerDXF(i){ const m=geometryModel(i); return `0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${dxfPolyline(m.outer)}${m.holes.map(dxfPolyline).join('')}0\nENDSEC\n0\nEOF\n`; }

function renderSummary(){ $('sumSize').textContent=`${Math.round(state.width)} × ${Math.round(state.height)} mm`; $('sumLayers').textContent=state.layers; $('sumHeight').textContent=`${state.layers*state.thickness} mm`; $('statusSub').textContent=`${state.layers} livelli · ${Math.round(state.width)} × ${Math.round(state.height)} mm · ${state.thickness} mm`; }
function renderFrames(){ $('frameGrid').innerHTML=FRAME_LIBRARY.map(([id,name])=>`<button class="shape-chip ${state.frame===id?'active':''}" data-frame="${id}" type="button">${name}</button>`).join(''); document.querySelectorAll('.shape-chip').forEach(b=>b.addEventListener('click',()=>{state.frame=b.dataset.frame; if(['circle','square'].includes(state.frame)){state.height=state.width;$('heightMm').value=state.height;} $('customFrameWrap').classList.toggle('hidden',state.frame!=='custom'); renderFrames();scheduleRebuild('Cornice aggiornata');})); }
function renderStyles(){ $('styleGrid').innerHTML=STYLE_LIBRARY.map(([id,name])=>`<button class="style-chip ${state.selectedStyles.includes(id)?'active':''}" data-style="${id}" type="button">${name}</button>`).join(''); $('styleCount').textContent=`${state.selectedStyles.length} / 4`; document.querySelectorAll('.style-chip').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.style;if(state.selectedStyles.includes(id)){if(state.selectedStyles.length===1)return toast('Mantieni almeno uno stile');state.selectedStyles=state.selectedStyles.filter(x=>x!==id);}else{if(state.selectedStyles.length>=4)return toast('Massimo 4 stili');state.selectedStyles.push(id);} state.layerData.forEach((ld,i)=>{if(!STYLE_LIBRARY.some(x=>x[0]===ld.style))ld.style=state.selectedStyles[i%state.selectedStyles.length];});renderStyles();scheduleRebuild('Mix stili aggiornato');})); }
function renderMode(){
  const names={radial:'Radiale',ornamental:'Ornamentale',reference:'Da immagine'},desc={radial:'Composizione radiale con anelli, simmetria e reveal progressivo tra i livelli.',ornamental:'Pannello libero con flow, forme focali, zone, decorazione angoli e composizione asimmetrica.',reference:'La distribuzione del reference guida palette, densità e punti ornamentali senza semplice tracing.'};
  ['Radial','Ornamental','Reference'].forEach(n=>$('mode'+n).classList.toggle('active',state.mode===n.toLowerCase())); $('referenceCard').classList.toggle('hidden',state.mode!=='reference'); $('modeDescription').textContent=desc[state.mode]; $('previewTag').textContent=names[state.mode];
  if(state.mode==='radial'){if(state.flow!=='radial'){state.flow='radial';$('flow').value='radial';} if(state.symmetry===0){state.symmetry=12;$('symmetry').value='12';}}
  else if(state.mode==='ornamental'){if(state.flow==='radial'){state.flow='horizontal';$('flow').value='horizontal';} if(state.symmetry!==0&&state.composition==='free'){state.symmetry=0;$('symmetry').value='0';}}
}
function renderRanges(){ $('frameMarginVal').textContent=`${state.frameMargin} mm`; $('bridgeVal').textContent=`${state.bridge.toFixed(1)} mm`; $('densityVal').textContent=`${state.density}%`; $('voidVal').textContent=`${state.voidRatio}%`; $('revealVal').textContent=`${state.reveal}%`; $('explodeVal').textContent=`${state.explode} mm`; }
function renderPreview2D(){ $('designPreview').innerHTML=combinedSvgMarkup(); $('designPreview').style.cssText='position:absolute;inset:12px;display:grid;place-items:center'; const svg=$('designPreview').querySelector('svg'); if(svg){svg.style.width='100%';svg.style.height='100%';} $('previewCaption').textContent=`${state.motifs.length} motivi · ${FRAME_LIBRARY.find(x=>x[0]===state.frame)?.[1]||state.frame} · seed ${state.seed}`; }
function renderLayers(){
  $('layerCountTag').textContent=`${state.layers} layer`;
  $('layerList').innerHTML=state.layerData.map((ld,i)=>`<div class="layer-card"><div class="layer-top"><div class="mini">${layerSvgMarkup(i,true)}</div><div><div class="layer-name">Livello ${i+1}</div><div class="layer-meta">${i===0?'Retro':'Sopra +'+i} · ${ROLES.find(x=>x[0]===ld.role)?.[1]||ld.role}</div></div><label class="toggle"><input class="layer-visible" data-i="${i}" type="checkbox" ${ld.visible?'checked':''}><span class="slider"></span></label></div><div class="layer-controls"><label class="field"><span class="field-title">Colore</span><div class="color-wrap"><input class="layer-color" data-i="${i}" type="color" value="${ld.color}"></div></label><label class="field"><span class="field-title">Materiale</span><select class="layer-material" data-i="${i}">${MATERIALS.map(m=>`<option value="${m.id}" ${m.id===ld.material?'selected':''}>${m.name}</option>`).join('')}</select></label></div><div class="layer-row"><label class="field"><span class="field-title">Stile</span><select class="layer-style" data-i="${i}">${STYLE_LIBRARY.map(([id,name])=>`<option value="${id}" ${id===ld.style?'selected':''}>${name}</option>`).join('')}</select></label><label class="field"><span class="field-title">Ruolo</span><select class="layer-role" data-i="${i}">${ROLES.map(([id,name])=>`<option value="${id}" ${id===ld.role?'selected':''}>${name}</option>`).join('')}</select></label></div><div style="margin-top:8px"><div class="field-title"><span>Apertura / offset</span><strong>${Math.round(ld.offset*100)}%</strong></div><input class="layer-offset" data-i="${i}" type="range" min="82" max="125" step="1" value="${Math.round(ld.offset*100)}"></div></div>`).join('');
  document.querySelectorAll('.layer-color').forEach(el=>el.addEventListener('input',e=>{state.layerData[+e.target.dataset.i].color=e.target.value;renderPreview2D();build3D();renderExport();saveLocal();}));
  document.querySelectorAll('.layer-material').forEach(el=>el.addEventListener('change',e=>{state.layerData[+e.target.dataset.i].material=e.target.value;build3D();renderExport();saveLocal();}));
  document.querySelectorAll('.layer-visible').forEach(el=>el.addEventListener('change',e=>{state.layerData[+e.target.dataset.i].visible=e.target.checked;renderPreview2D();build3D();saveLocal();}));
  document.querySelectorAll('.layer-style').forEach(el=>el.addEventListener('change',e=>{state.layerData[+e.target.dataset.i].style=e.target.value;scheduleRebuild('Stile layer aggiornato');}));
  document.querySelectorAll('.layer-role').forEach(el=>el.addEventListener('change',e=>{state.layerData[+e.target.dataset.i].role=e.target.value;scheduleRebuild('Ruolo layer aggiornato');}));
  document.querySelectorAll('.layer-offset').forEach(el=>el.addEventListener('input',e=>{state.layerData[+e.target.dataset.i].offset=+e.target.value/100;renderLayers();renderPreview2D();build3D();renderExport();saveLocal();}));
}
function validateModels(includeWarnings=true){
  const errors=[],warnings=[],outer=makeFrameOuter(); if(outer.length<4)errors.push('Contorno esterno non valido.'); if(Math.abs(polyArea(outer))<1000)errors.push('Area cornice insufficiente.'); if(!state.motifs.length)warnings.push('Nessun motivo generato.');
  for(let i=0;i<state.layers;i++){const m=geometryModel(i);for(const loop of [m.outer,...m.holes]){if(loop.length<3||loop.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])))errors.push(`Geometria non valida al layer ${i+1}.`);}}
  if(state.bridge<1.5)warnings.push('Ponte minimo sotto 1,5 mm: fragile per molti compensati.'); if(state.frameMargin<Math.max(3,state.bridge*1.5))warnings.push('Margine cornice vicino al ponte minimo: valuta più bordo.'); if(state.layers*state.thickness>42)warnings.push('Stack oltre 42 mm: verifica peso e incollaggio.'); if(state.motifs.length<6)warnings.push('Composizione molto semplice: aumenta densità o forme principali.');
  return {ok:errors.length===0,errors,warnings:includeWarnings?warnings:[]};
}
function renderExport(){
  const v=validateModels(true),good=[`Origine condivisa · ${state.width} × ${state.height} mm`,`${state.layers} SVG + DXF vettoriali chiusi`,`Spessore nominale ${state.thickness} mm · stack ${state.layers*state.thickness} mm`,`Cornice: ${FRAME_LIBRARY.find(x=>x[0]===state.frame)?.[1]||state.frame} · ${state.motifs.length} motivi`];
  $('checks').innerHTML=good.map(t=>`<div class="check"><b>OK</b><span>${t}</span></div>`).join('')+v.errors.map(t=>`<div class="check warn"><b>ERRORE</b><span>${t}</span></div>`).join('')+v.warnings.map(t=>`<div class="check warn"><b>CHECK</b><span>${t}</span></div>`).join('');
  $('exportList').innerHTML=state.layerData.map((ld,i)=>`<div class="export-item"><strong>Layer ${String(i+1).padStart(2,'0')} · ${ROLES.find(x=>x[0]===ld.role)?.[1]}</strong><span>${STYLE_LIBRARY.find(x=>x[0]===ld.style)?.[1]} · ${MATERIALS.find(m=>m.id===ld.material)?.name}</span><div class="btn-row"><button class="btn ghost dl-svg" data-i="${i}" type="button">SVG</button><button class="btn ghost dl-dxf" data-i="${i}" type="button">DXF</button></div></div>`).join('');
  document.querySelectorAll('.dl-svg').forEach(b=>b.addEventListener('click',()=>downloadText(`mandala_layer_${String(+b.dataset.i+1).padStart(2,'0')}.svg`,exportLayerSVG(+b.dataset.i),'image/svg+xml')));
  document.querySelectorAll('.dl-dxf').forEach(b=>b.addEventListener('click',()=>downloadText(`mandala_layer_${String(+b.dataset.i+1).padStart(2,'0')}.dxf`,exportLayerDXF(+b.dataset.i),'application/dxf')));
}
function renderAll(){ renderSummary();renderRanges();renderFrames();renderStyles();renderMode();renderPreview2D();renderLayers();renderExport();build3D();saveLocal(); }
function scheduleRebuild(title='Design aggiornato'){ cancelAnimationFrame(rebuildRAF); rebuildRAF=requestAnimationFrame(()=>{buildDesignModel();renderAll();setStatus(title);}); }

function makeNoiseTexture(material,color){ const mat=MATERIALS.find(m=>m.id===material)||MATERIALS[0]; if(mat.grain==='none')return null;const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,256,256); if(mat.grain==='speckle'){for(let i=0;i<1700;i++){ctx.fillStyle=`rgba(35,28,22,${Math.random()*.12})`;ctx.fillRect(Math.random()*256,Math.random()*256,1,1);}} else {for(let y=12;y<256;y+=18){ctx.strokeStyle=mat.grain==='dark'?'rgba(35,18,9,.30)':'rgba(70,45,22,.18)';ctx.lineWidth=1.4;ctx.beginPath();for(let x=0;x<=256;x+=8){const yy=y+Math.sin((x+y)*.055)*3+Math.sin(x*.017)*2;if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();}} const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1.5,1.5);tex.colorSpace=THREE.SRGBColorSpace;return tex; }
function shapeFromModel(m){ const sh=new THREE.Shape();m.outer.forEach((p,i)=>{const x=(p[0]/1000-.5)*state.width,y=-(p[1]/1000-.5)*state.height;i?sh.lineTo(x,y):sh.moveTo(x,y);});sh.closePath(); for(const loop of m.holes){const h=new THREE.Path();loop.forEach((p,i)=>{const x=(p[0]/1000-.5)*state.width,y=-(p[1]/1000-.5)*state.height;i?h.lineTo(x,y):h.moveTo(x,y);});h.closePath();sh.holes.push(h);} return sh; }
function ensure3D(){
  if(renderer)return;const host=$('threeHost');scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.1,6000);renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;host.appendChild(renderer.domElement);
  controls=new TrackballControls(camera,renderer.domElement);controls.rotateSpeed=3.2;controls.zoomSpeed=1.25;controls.panSpeed=.45;controls.noPan=true;controls.staticMoving=false;controls.dynamicDampingFactor=.16;controls.minDistance=80;controls.maxDistance=2600;
  scene.add(new THREE.HemisphereLight(0xffffff,0x15202b,2.3));const key=new THREE.DirectionalLight(0xffffff,3.8);key.position.set(-260,-260,420);scene.add(key);const fill=new THREE.DirectionalLight(0xffae88,1.3);fill.position.set(280,160,260);scene.add(fill);stackGroup=new THREE.Group();scene.add(stackGroup);
  resizeObserver=new ResizeObserver(()=>{const r=host.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();controls.handleResize?.();});resizeObserver.observe(host);
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});setFront();
}
function disposeGroup(g){ if(!g)return;while(g.children.length){const o=g.children.pop();o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}} }
function build3D(){
  ensure3D();disposeGroup(stackGroup);const gap=state.explode; for(let i=0;i<state.layers;i++){const ld=state.layerData[i];if(!ld?.visible)continue;const model=geometryModel(i),matInfo=MATERIALS.find(m=>m.id===ld.material)||MATERIALS[0],tex=makeNoiseTexture(ld.material,ld.color),mat=new THREE.MeshStandardMaterial({color:new THREE.Color(ld.color),roughness:matInfo.rough,metalness:matInfo.metal,map:tex,side:THREE.DoubleSide}); try{const geom=new THREE.ExtrudeGeometry(shapeFromModel(model),{depth:state.thickness,bevelEnabled:true,bevelThickness:.18,bevelSize:.13,bevelSegments:1,curveSegments:3});geom.computeVertexNormals();const mesh=new THREE.Mesh(geom,mat);mesh.position.z=i*(state.thickness+gap)-((state.layers-1)*(state.thickness+gap))/2;mesh.castShadow=true;mesh.receiveShadow=true;stackGroup.add(mesh);}catch(err){console.error('3D layer error',i,err);mat.dispose();tex?.dispose();}}
  $('modeBadge').textContent=state.explode>0?'Esploso':'Assemblato';$('materialLegend').innerHTML=state.layerData.map((ld,i)=>ld.visible?`<span class="material-pill"><i class="dot" style="background:${ld.color}"></i>L${i+1} · ${MATERIALS.find(m=>m.id===ld.material)?.name||ld.material}</span>`:'').join('');
}
function setFront(){ ensure3D();const d=Math.max(state.width,state.height);camera.position.set(0,0,d*1.85+state.layers*state.thickness);camera.up.set(0,1,0);controls.target.set(0,0,0);controls.update(); }
function setIso(){ ensure3D();const d=Math.max(state.width,state.height);camera.position.set(d*1.15,-d*1.05,d*.9);camera.up.set(0,1,0);controls.target.set(0,0,0);controls.update(); }
function fit3D(){ state.explode>0?setIso():setFront(); }

async function parseCustomFrame(file){
  const text=await file.text(),doc=new DOMParser().parseFromString(text,'image/svg+xml'); if(doc.querySelector('parsererror'))throw new Error('SVG non valido'); const host=$('svgMeasureHost');host.innerHTML='';const svg=document.importNode(doc.documentElement,true);svg.style.width='1000px';svg.style.height='1000px';host.appendChild(svg);await new Promise(r=>requestAnimationFrame(r)); const geom=svg.querySelector('path,polygon,polyline,rect,circle,ellipse'); if(!geom||typeof geom.getTotalLength!=='function')throw new Error('Nessun contorno compatibile trovato'); const len=geom.getTotalLength();if(!Number.isFinite(len)||len<=0)throw new Error('Contorno vuoto');const pts=[];for(let i=0;i<220;i++){const p=geom.getPointAtLength(len*i/220),ctm=geom.getCTM();let x=p.x,y=p.y;if(ctm){const q=new DOMPoint(x,y).matrixTransform(ctm);x=q.x;y=q.y;}pts.push([x,y]);} const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),w=maxx-minx,h=maxy-miny;if(w<1||h<1)throw new Error('Contorno troppo piccolo');const s=Math.min(900/w,900/h),cx=(minx+maxx)/2,cy=(miny+maxy)/2;state.customFrame=pts.map(([x,y])=>[500+(x-cx)*s,500+(y-cy)*s]);host.innerHTML=''; }

function hexToRgb(hex){const h=hex.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function rgbToHex(r,g,b){return'#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');}
async function analyzeReference(img,k){
  const c=document.createElement('canvas'),ctx=c.getContext('2d',{willReadFrequently:true}),max=360,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.max(4,Math.round(img.naturalWidth*scale));c.height=Math.max(4,Math.round(img.naturalHeight*scale));ctx.drawImage(img,0,0,c.width,c.height);const im=ctx.getImageData(0,0,c.width,c.height),w=c.width,h=c.height;
  const samples=[];for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3){const p=(y*w+x)*4;if(im.data[p+3]<180)continue;samples.push([im.data[p],im.data[p+1],im.data[p+2]]);}if(samples.length<80)throw new Error('Immagine troppo uniforme');
  const kk=clamp(k,3,8),rng=new RNG(77+samples.length),centers=Array.from({length:kk},()=>samples[Math.floor(rng.next()*samples.length)].slice());for(let it=0;it<14;it++){const sums=Array.from({length:kk},()=>[0,0,0,0]);for(const s of samples){let bi=0,bd=Infinity;for(let j=0;j<kk;j++){const d=(s[0]-centers[j][0])**2+(s[1]-centers[j][1])**2+(s[2]-centers[j][2])**2;if(d<bd){bd=d;bi=j;}}sums[bi][0]+=s[0];sums[bi][1]+=s[1];sums[bi][2]+=s[2];sums[bi][3]++;}for(let j=0;j<kk;j++)if(sums[j][3])centers[j]=sums[j].slice(0,3).map(v=>v/sums[j][3]);}
  const palette=centers.map(c=>rgbToHex(...c)).sort((a,b)=>{const A=hexToRgb(a),B=hexToRgb(b);return(A[0]*.299+A[1]*.587+A[2]*.114)-(B[0]*.299+B[1]*.587+B[2]*.114);});
  const gray=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;gray[y*w+x]=(im.data[p]*.299+im.data[p+1]*.587+im.data[p+2]*.114)/255;}
  const edges=[];let sumG=0,countG=0;for(let y=2;y<h-2;y+=2)for(let x=2;x<w-2;x+=2){const gx=gray[y*w+x+1]-gray[y*w+x-1],gy=gray[(y+1)*w+x]-gray[(y-1)*w+x],g=Math.hypot(gx,gy);sumG+=g;countG++;if(g>.12)edges.push([x/w,y/h,g,Math.atan2(gy,gx)]);}edges.sort((a,b)=>b[2]-a[2]);const picked=[];for(const e of edges){if(picked.length>=80)break;if(picked.every(p=>Math.hypot((e[0]-p[0])*w,(e[1]-p[1])*h)>16))picked.push(e);} const edgePoints=picked.map((e,idx)=>[e[0],e[1],clamp(e[2]*2.2,.15,1),idx%Math.max(1,state.layers-1),e[3]+Math.PI/2]);
  return {palette,edgePoints,contrast:clamp(sumG/Math.max(1,countG)*420,0,100),ratio:img.naturalWidth/img.naturalHeight};
}

function downloadText(name,text,type){const blob=new Blob([text],{type}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function projectPayload(){return {version:'1.0',created:new Date().toISOString(),settings:{mode:state.mode,frame:state.frame,width_mm:state.width,height_mm:state.height,layers:state.layers,thickness_mm:state.thickness,bridge_mm:state.bridge,frame_margin_mm:state.frameMargin,density:state.density,void_ratio:state.voidRatio,reveal:state.reveal,symmetry:state.symmetry,composition:state.composition,flow:state.flow,major_shapes:state.majorShapes,focal:state.focal,corners:state.corners,seed:state.seed,selected_styles:state.selectedStyles},layers:state.layerData,customFrame:state.customFrame};}
function saveLocal(){try{localStorage.setItem('mandalaforge-pro-v1',JSON.stringify(projectPayload()));}catch{}}
function loadLocal(){try{const raw=localStorage.getItem('mandalaforge-pro-v1');if(!raw)return false;const p=JSON.parse(raw),s=p.settings||{};Object.assign(state,{mode:s.mode||state.mode,frame:s.frame||state.frame,width:+s.width_mm||state.width,height:+s.height_mm||state.height,layers:+s.layers||state.layers,thickness:+s.thickness_mm||state.thickness,bridge:+s.bridge_mm||state.bridge,frameMargin:+s.frame_margin_mm||state.frameMargin,density:+s.density||state.density,voidRatio:+s.void_ratio||state.voidRatio,reveal:+s.reveal||state.reveal,symmetry:Number.isFinite(+s.symmetry)?+s.symmetry:state.symmetry,composition:s.composition||state.composition,flow:s.flow||state.flow,majorShapes:+s.major_shapes||state.majorShapes,focal:s.focal||state.focal,corners:s.corners||state.corners,seed:+s.seed||state.seed,selectedStyles:Array.isArray(s.selected_styles)&&s.selected_styles.length?s.selected_styles:state.selectedStyles,customFrame:p.customFrame||null});state.layerData=Array.isArray(p.layers)?p.layers:[];return true;}catch{return false;}}

async function runStressTest(iterations=100){
  const snap=deepClone(state),frames=['circle','square','rectangle','hexagon','octagon','oval','rounded','organic'],modes=['radial','ornamental'],styles=STYLE_LIBRARY.map(x=>x[0]);let failures=[];
  for(let t=0;t<iterations;t++){state.mode=modes[t%2];state.frame=frames[t%frames.length];state.width=180+(t*37)%520;state.height=['circle','square'].includes(state.frame)?state.width:150+(t*53)%420;state.layers=3+(t%8);state.thickness=2+(t%5);state.bridge=1.5+(t%18)/10;state.frameMargin=5+(t%18);state.density=25+(t*7)%66;state.voidRatio=28+(t*9)%46;state.reveal=15+(t*11)%70;state.symmetry=[0,6,8,10,12,16][t%6];if(state.mode==='radial'&&state.symmetry===0)state.symmetry=8;state.flow=['radial','horizontal','vertical','diagonal','swirl'][t%5];state.composition=['balanced','free','semi','symmetric'][t%4];state.majorShapes=1+t%6;state.focal=['leaf','paisley','spiral','petal','star','diamond'][t%6];state.corners=['off','light','medium','rich'][t%4];state.seed=1000+t*97;state.selectedStyles=[styles[t%styles.length],styles[(t*7+3)%styles.length]];makeLayerData(true);state.layerData.forEach((ld,i)=>ld.style=styles[(t+i*5)%styles.length]);buildDesignModel();const v=validateModels(false);if(!v.ok)failures.push({t,errors:v.errors});}
  Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,snap);buildDesignModel();renderAll();return {ok:failures.length===0,iterations,failures};
}

function switchTab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===name));if(name==='preview')setTimeout(()=>{build3D();fit3D();},70);}
function bind(){
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab))); $('quick3D').addEventListener('click',()=>switchTab('preview')); $('quickGenerate').addEventListener('click',randomize); $('randomizeDesign').addEventListener('click',randomize);
  $('modeRadial').addEventListener('click',()=>setMode('radial'));$('modeOrnamental').addEventListener('click',()=>setMode('ornamental'));$('modeReference').addEventListener('click',()=>setMode('reference'));
  $('widthMm').addEventListener('change',e=>{state.width=clamp(+e.target.value||350,80,1200);if(['circle','square'].includes(state.frame)){state.height=state.width;$('heightMm').value=state.height;}renderAll();setStatus('Dimensioni aggiornate');});
  $('heightMm').addEventListener('change',e=>{state.height=clamp(+e.target.value||350,80,1200);if(['circle','square'].includes(state.frame)){state.width=state.height;$('widthMm').value=state.width;}renderAll();setStatus('Dimensioni aggiornate');});
  $('layerCount').addEventListener('change',e=>{state.layers=+e.target.value;makeLayerData();scheduleRebuild('Numero livelli aggiornato');}); $('thickness').addEventListener('change',e=>{state.thickness=+e.target.value;renderAll();});
  $('bridge').addEventListener('input',e=>{state.bridge=+e.target.value/10;renderRanges();scheduleRebuild('Ponte minimo aggiornato');}); $('frameMargin').addEventListener('input',e=>{state.frameMargin=+e.target.value;renderRanges();scheduleRebuild('Margine aggiornato');});
  $('density').addEventListener('input',e=>{state.density=+e.target.value;renderRanges();scheduleRebuild('Densità aggiornata');}); $('voidRatio').addEventListener('input',e=>{state.voidRatio=+e.target.value;renderRanges();scheduleRebuild('Rapporto pieno/vuoto aggiornato');}); $('reveal').addEventListener('input',e=>{state.reveal=+e.target.value;renderRanges();scheduleRebuild('Reveal aggiornato');});
  $('symmetry').addEventListener('change',e=>{state.symmetry=+e.target.value;scheduleRebuild('Simmetria aggiornata');}); $('composition').addEventListener('change',e=>{state.composition=e.target.value;scheduleRebuild('Composizione aggiornata');}); $('flow').addEventListener('change',e=>{state.flow=e.target.value;scheduleRebuild('Flow aggiornato');}); $('majorShapes').addEventListener('change',e=>{state.majorShapes=+e.target.value;scheduleRebuild('Forme principali aggiornate');}); $('focal').addEventListener('change',e=>{state.focal=e.target.value;scheduleRebuild('Elemento focale aggiornato');}); $('corners').addEventListener('change',e=>{state.corners=e.target.value;scheduleRebuild('Angoli aggiornati');});
  $('explode').addEventListener('input',e=>{state.explode=+e.target.value;renderRanges();build3D();saveLocal();}); $('viewFront').addEventListener('click',setFront);$('viewIso').addEventListener('click',setIso);$('fitView').addEventListener('click',fit3D);$('viewExploded').addEventListener('click',()=>{state.explode=18;$('explode').value='18';renderRanges();build3D();setIso();});
  $('customFrameFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{await parseCustomFrame(f);scheduleRebuild('Cornice SVG caricata');toast('Cornice personalizzata pronta');}catch(err){toast(err.message);}});
  $('referenceFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const url=URL.createObjectURL(f),img=$('referencePreview');img.src=url;img.style.display='block';$('referenceProgress').classList.remove('hidden');$('referenceAnalysis').classList.add('hidden');$('referenceProgressBar').style.width='15%';$('referenceStatus').textContent='Preparo immagine…';img.onload=async()=>{try{$('referenceProgressBar').style.width='42%';$('referenceStatus').textContent='Analizzo palette e contrasto…';await new Promise(r=>setTimeout(r,30));const a=await analyzeReference(img,state.layers);$('referenceProgressBar').style.width='82%';$('referenceStatus').textContent='Estraggo punti guida…';await new Promise(r=>setTimeout(r,30));state.reference={name:f.name};state.referenceAnalysis=a;$('aContrast').textContent=`${Math.round(a.contrast)}%`;$('aPoints').textContent=a.edgePoints.length;$('aRatio').textContent=a.ratio.toFixed(2);$('referencePalette').innerHTML=a.palette.map((c,i)=>`<span class="swatch"><i class="dot" style="background:${c}"></i>${c}</span>`).join('');$('referenceProgressBar').style.width='100%';$('referenceStatus').textContent='Analisi completata';$('referenceAnalysis').classList.remove('hidden');toast('Reference analizzata');}catch(err){$('referenceStatus').textContent='Errore: '+err.message;toast('Analisi non riuscita');}finally{setTimeout(()=>URL.revokeObjectURL(url),1200);}};});
  $('buildFromReference').addEventListener('click',()=>{const a=state.referenceAnalysis;if(!a)return toast('Carica prima una reference');state.mode='reference';state.symmetry=0;state.composition='free';state.flow=a.ratio>1.15?'horizontal':a.ratio<.85?'vertical':'swirl';state.density=clamp(Math.round(38+a.contrast*.45),35,84);state.width=clamp(state.width,120,900);state.height=clamp(Math.round(state.width/a.ratio),100,900);a.palette.forEach((c,i)=>{if(state.layerData[i])state.layerData[i].color=c;});syncInputs();buildDesignModel();renderAll();setStatus('Ricostruzione da reference pronta');switchTab('layers');});
  $('downloadProject').addEventListener('click',()=>downloadText('mandalaforge-project.json',JSON.stringify(projectPayload(),null,2),'application/json')); $('downloadPreviewSvg').addEventListener('click',()=>downloadText('mandalaforge-preview.svg',`<?xml version="1.0" encoding="UTF-8"?>\n${combinedSvgMarkup()}`,'image/svg+xml'));
  $('downloadZip').addEventListener('click',async()=>{const btn=$('downloadZip');btn.disabled=true;$('downloadStatus').textContent='Creo il pacchetto…';try{const zip=new JSZip();state.layerData.forEach((ld,i)=>{zip.file(`SVG/layer_${String(i+1).padStart(2,'0')}.svg`,exportLayerSVG(i));zip.file(`DXF/layer_${String(i+1).padStart(2,'0')}.dxf`,exportLayerDXF(i));});zip.file('preview.svg',combinedSvgMarkup());zip.file('project.json',JSON.stringify(projectPayload(),null,2));zip.file('README.txt',`MandalaForge Pro v1.0\nFormato: ${state.width} x ${state.height} mm\nLivelli: ${state.layers}\nSpessore: ${state.thickness} mm\nPonte minimo: ${state.bridge} mm\nFrame: ${state.frame}\n\nSVG/DXF: linee CUT nere, dimensioni reali.\n`);const blob=await zip.generateAsync({type:'blob'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mandalaforge-pro.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);$('downloadStatus').textContent='ZIP creato correttamente.';}catch(err){$('downloadStatus').textContent='Errore: '+err.message;}finally{btn.disabled=false;}});
  $('selfTestBtn').addEventListener('click',async()=>{const b=$('selfTestBtn');b.disabled=true;b.textContent='Test…';const res=await runStressTest(80);b.disabled=false;b.textContent='Auto-check';$('downloadStatus').textContent=res.ok?`Auto-check superato: ${res.iterations}/${res.iterations} configurazioni valide.`:`Auto-check: ${res.failures.length} errori.`;toast(res.ok?'Auto-check superato':'Controlla errori');});
}
function setMode(mode){state.mode=mode;if(mode==='radial'){state.flow='radial';if(state.symmetry===0)state.symmetry=12;}else if(mode==='ornamental'){if(state.flow==='radial')state.flow='horizontal';}renderMode();syncInputs();scheduleRebuild(`Modalità ${mode==='radial'?'Radiale':mode==='ornamental'?'Ornamentale':'Da immagine'}`);}
function randomize(){state.seed=(state.seed+1+Math.floor(Math.random()*9999))%2147483000;buildDesignModel();renderAll();setStatus('Nuova variante generata');toast('Nuovo design generato');}
function syncInputs(){ $('widthMm').value=Math.round(state.width);$('heightMm').value=Math.round(state.height);$('layerCount').value=String(state.layers);$('thickness').value=String(state.thickness);$('bridge').value=String(Math.round(state.bridge*10));$('frameMargin').value=String(state.frameMargin);$('density').value=String(state.density);$('voidRatio').value=String(state.voidRatio);$('reveal').value=String(state.reveal);$('symmetry').value=String(state.symmetry);$('composition').value=state.composition;$('flow').value=state.flow;$('majorShapes').value=String(state.majorShapes);$('focal').value=state.focal;$('corners').value=state.corners;$('explode').value=String(state.explode);$('customFrameWrap').classList.toggle('hidden',state.frame!=='custom');}
function init(){
  $('layerCount').innerHTML=Array.from({length:11},(_,i)=>`<option value="${i+2}">${i+2}</option>`).join(''); const restored=loadLocal(); if(!state.layerData.length||state.layerData.length!==state.layers)makeLayerData(!restored); syncInputs();bind();buildDesignModel();renderAll();setStatus(restored?'Progetto ripristinato':'Pronto');
  window.__MF__={state,styleLoop,makeFrameOuter,buildDesignModel,geometryModel,validateModels,stressTest:runStressTest,exportLayerSVG,exportLayerDXF};
}
init();
