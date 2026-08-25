const root=document.documentElement;
const main=document.getElementById('main');
const serverState=document.getElementById('serverState');
let lastNetwork=null;

function deviceType(){const w=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);return w>=1100?'desktop':w>=600?'tablet':'phone'}
function deviceLabel(v=deviceType()){return v==='desktop'?'DESKTOP':v==='tablet'?'TABLET':'SMARTPHONE'}
function applyDevice(){const d=deviceType();root.dataset.device=d;root.dataset.pointer=matchMedia('(pointer:coarse)').matches?'touch':'fine';return d}

async function getNetwork(){
  try{
    const r=await fetch('/api/network',{cache:'no-store'}),j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.error||'Rete non disponibile');
    lastNetwork=j.data;decorateNetwork();return lastNetwork;
  }catch{
    if(serverState){serverState.textContent='SERVER LOCALE';serverState.title='Informazioni rete non disponibili';}
    return null;
  }
}

function safe(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function networkHtml(n){
  const device=deviceLabel();
  const preferred=n?.preferredUrl||location.origin;
  const alternates=(n?.interfaces||[]).filter(x=>x.url!==preferred);
  return `<div class="networkPanel" data-network-panel>
    <div class="networkGrid">
      <div class="networkBox networkPrimary"><b>Indirizzo consigliato per tablet/telefono</b><code>${safe(preferred)}</code><button type="button" class="btn soft copyNetwork" data-copy-network="${safe(preferred)}">COPIA INDIRIZZO</button></div>
      <div class="networkBox"><b>Dispositivo corrente</b><span class="deviceBadge">${device}</span><p class="muted">Il layout viene adattato automaticamente alla dimensione dello schermo.</p></div>
    </div>
    <div class="networkBox"><b>Rete rilevata</b><div class="networkInterfaces">${(n?.interfaces||[]).length?(n.interfaces||[]).map(x=>`<div class="networkInterface"><span>${safe(x.name)}</span><code>${safe(x.url)}</code></div>`).join(''):'<span class="muted">Nessuna interfaccia LAN rilevata.</span>'}</div>${alternates.length?'<p class="muted">Se passi dalla Wi‑Fi di casa all’hotspot, questa lista viene ricalcolata automaticamente.</p>':''}</div>
  </div>`;
}

function decorateNetwork(){
  applyDevice();
  if(serverState){serverState.textContent='SERVER LOCALE';serverState.title=lastNetwork?.preferredUrl?`Collegamento LAN: ${lastNetwork.preferredUrl}`:'Server locale attivo';}
  if(!main||!lastNetwork)return;
  const adminInfo=main.querySelector('.serverInfo');
  if(adminInfo&&!main.querySelector('[data-network-panel]')){
    adminInfo.insertAdjacentHTML('afterend',networkHtml(lastNetwork));
  }
  main.querySelectorAll('[data-copy-network]').forEach(btn=>{
    if(btn.dataset.bound==='1')return;btn.dataset.bound='1';btn.addEventListener('click',async()=>{
      const value=btn.dataset.copyNetwork||'';
      try{await navigator.clipboard.writeText(value);btn.textContent='COPIATO ✓';setTimeout(()=>btn.textContent='COPIA INDIRIZZO',1200)}catch{btn.textContent=value}
    });
  });
}

const observer=new MutationObserver(()=>decorateNetwork());
if(main)observer.observe(main,{childList:true,subtree:true});
window.addEventListener('resize',()=>{applyDevice();decorateNetwork()},{passive:true});
window.addEventListener('online',getNetwork);
window.addEventListener('focus',getNetwork);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)getNetwork()});
applyDevice();getNetwork();setInterval(getNetwork,5000);
