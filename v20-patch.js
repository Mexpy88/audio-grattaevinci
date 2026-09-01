/* NOVA V20 patch assembler — intentionally keeps V19 index.html untouched. */
(()=>{
  const script=document.currentScript;
  const base=new URL('v20/',script?.src||location.href);
  const parts=Array.from({length:9},(_,i)=>`patch-${String(i+1).padStart(2,'0')}.part`);
  (async()=>{
    let source='';
    for(const name of parts){
      const response=await fetch(new URL(name,base),{cache:'no-store'});
      if(!response.ok)throw new Error(`NOVA V20: impossibile caricare ${name} (${response.status})`);
      source+=await response.text();
    }
    (0,eval)(source);
  })().catch(error=>{
    console.error('[NOVA V20] caricamento patch fallito',error);
    const host=document.getElementById('toastHost');
    if(host){const d=document.createElement('div');d.className='toast error';d.textContent='NOVA V20 non è stata caricata correttamente.';host.appendChild(d)}
  });
})();
