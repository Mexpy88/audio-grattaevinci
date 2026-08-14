import re


def apply_master_patch(html: str) -> str:
    # Solo area MASTER: importazione definitiva + cancellazione protetta da PIN.
    master_card_old = '''        <label class="btn primary fileInline">IMPORTA FILE EXCEL MASTER
          <input id="masterInput" hidden type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv">
        </label>'''
    master_card_new = master_card_old + '''
        <button id="deleteMasterBtn" class="btn danger hidden" onclick="openDeleteMasterDialog()">ELIMINA MASTER</button>'''
    if master_card_old not in html:
        raise RuntimeError('Blocco Magazzino master non trovato')
    html = html.replace(master_card_old, master_card_new, 1)

    delete_dialog = r'''
<dialog id="deleteMasterDialog">
  <div class="dialogHead"><h2>Elimina magazzino master</h2><button onclick="closeDeleteMasterDialog()">×</button></div>
  <p>Per eliminare il master inserisci nuovamente il PIN dell'operatore <b id="deleteMasterUser"></b>.</p>
  <input id="deleteMasterPin" class="pinInput" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="PIN conferma eliminazione master" oninput="this.value=this.value.replace(/\D/g,'').slice(0,4);$('deleteMasterError').classList.add('hidden')">
  <div id="deleteMasterError" class="authError hidden">PIN non corretto per l'operatore collegato.</div>
  <div class="status warn">Verrà eliminata soltanto l'importazione master. Movimenti, scarichi e richieste già registrati resteranno nello storico.</div>
  <button class="btn danger" onclick="confirmDeleteMaster()">ELIMINA MASTER</button>
</dialog>

'''
    dialog_marker = '<dialog id="masterDialog">'
    if dialog_marker not in html:
        raise RuntimeError('masterDialog non trovato')
    html = html.replace(dialog_marker, delete_dialog + dialog_marker, 1)

    helpers = r'''function definitiveMasterColumns(headers){
 const norm=headers.map(masterNormHeader),find=(...names)=>norm.findIndex(h=>names.includes(h));
 const location=find('SCAFFALE / FILA','SCAFFALE/FILA','SCAFFALE FILA');
 const bancale=find('BANCALE');
 const nuovo=find('NUOVO'),scaricato=find('SCARICATO'),usato=find('USATO');
 let article=find('ARTICOLO');
 if(article<0&&location>=0&&bancale>=0&&(nuovo>=0||scaricato>=0||usato>=0)&&headers.length>2)article=2;
 return {
  location,bancale,article,nuovo,scaricato,usato,
  controlDate:find('DATA CONTROLLO QUANTITA')
 };
}
function splitMasterArticleSize(v){
 const raw=normalizeArticle(v);if(!raw)return {article:'',size:''};
 const i=raw.lastIndexOf('-');if(i<=0)return {article:raw,size:''};
 const suffix=raw.slice(i+1).toUpperCase();
 if(/^(?:[0-9]{1,3}|[2-9]?XS|[2-9]?XL|XXS|XXL|XS|S|M|L|XL|TU|UNI|UNICA)$/.test(suffix))return {article:raw.slice(0,i),size:suffix};
 return {article:raw,size:''};
}
function isDefinitiveMaster(c){return c.article>=0&&c.location>=0&&c.bancale>=0&&(c.nuovo>=0||c.scaricato>=0||c.usato>=0)}
function setDefinitiveMasterUi(active){
 ['mapArticle','mapSize','mapQty','mapState','mapLocation','mapFila','mapScaffale','mapBancale'].forEach(id=>{
  const el=$(id);if(!el)return;const label=el.closest('label');if(label)label.classList.toggle('hidden',active);
 });
 document.querySelectorAll('#masterDialog .twoCols').forEach(el=>el.classList.toggle('hidden',active));
 const btn=document.querySelector('#masterDialog .btn.success');
 if(btn)btn.textContent=active?'CONFERMA IMPORTAZIONE':'IMPORTA COME MASTER';
}
function openDeleteMasterDialog(){
 if(!requireLogin())return;
 if(!(db.master?.rows||[]).length)return alert('Non c\'è nessun master da eliminare.');
 $('deleteMasterUser').textContent=currentUser;
 $('deleteMasterPin').value='';
 $('deleteMasterError').classList.add('hidden');
 if(!$('deleteMasterDialog').open)$('deleteMasterDialog').showModal();
 setTimeout(()=>$('deleteMasterPin').focus(),80);
}
function closeDeleteMasterDialog(){if($('deleteMasterDialog').open)$('deleteMasterDialog').close()}
async function confirmDeleteMaster(){
 if(!requireLogin())return;
 const pin=String($('deleteMasterPin').value||'').replace(/\D/g,'').slice(0,4);
 if(pin.length!==4){$('deleteMasterError').classList.remove('hidden');return}
 const hash=await sha256Text('warehouse-so|'+pin);
 if(USER_HASHES[hash]!==currentUser){$('deleteMasterError').classList.remove('hidden');$('deleteMasterPin').value='';$('deleteMasterPin').focus();return}
 if(!confirm('Confermi l\'eliminazione completa del file master importato? Movimenti, scarichi e richieste resteranno nello storico.'))return;
 const before=structuredClone(db.master||{});
 db.master=blankDb().master;
 audit('DELETE','MASTER','MASTER',before,null);
 saveDb();closeDeleteMasterDialog();renderMasterStatus();renderRegistry();
 alert('Magazzino master eliminato. Ora puoi importare un altro file per le tue prove.');
}
'''
    marker = 'function prepareMasterSheet(){'
    if marker not in html:
        raise RuntimeError('prepareMasterSheet non trovato')
    html = html.replace(marker, helpers + marker, 1)

    new_prepare = r'''function prepareMasterSheet(){
 if(!masterWorkbook)return;
 const name=$('masterSheet').value||masterWorkbook.SheetNames[0],ws=masterWorkbook.Sheets[name];
 masterMatrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,blankrows:false});masterHeaderRow=detectMasterHeader(masterMatrix);
 const headers=(masterMatrix[masterHeaderRow]||[]).map(v=>String(v||'').trim());
 $('mapArticle').innerHTML=masterOptions(headers,'article',false);$('mapSize').innerHTML=masterOptions(headers,'size',true);$('mapQty').innerHTML=masterOptions(headers,'qty',false);$('mapState').innerHTML=masterOptions(headers,'state',true);$('mapLocation').innerHTML=masterOptions(headers,'location',true);$('mapFila').innerHTML=masterOptions(headers,'fila',true);$('mapScaffale').innerHTML=masterOptions(headers,'scaffale',true);$('mapBancale').innerHTML=masterOptions(headers,'bancale',true);
 const c=definitiveMasterColumns(headers),recognized=isDefinitiveMaster(c);setDefinitiveMasterUi(recognized);
 if(recognized){
  $('mapArticle').value=String(c.article);$('mapSize').value='';$('mapLocation').value=String(c.location);$('mapFila').value='';$('mapScaffale').value='';$('mapBancale').value=String(c.bancale);$('mapState').value='';
  const q=c.nuovo>=0?c.nuovo:(c.scaricato>=0?c.scaricato:c.usato);if(q>=0)$('mapQty').value=String(q);
  $('masterPreviewInfo').className='status good';
  $('masterPreviewInfo').textContent=`Formato magazzino riconosciuto. ${Math.max(0,masterMatrix.length-masterHeaderRow-1)} righe da leggere. Articolo e taglia verranno separati automaticamente; NUOVO, SCARICATO e USATO verranno importati come giacenze distinte.`;
 }else{
  $('masterPreviewInfo').className='status';
  $('masterPreviewInfo').textContent=`Intestazioni rilevate alla riga ${masterHeaderRow+1}. ${Math.max(0,masterMatrix.length-masterHeaderRow-1)} righe dati da leggere.`;
 }
}'''
    html, n = re.subn(r'function prepareMasterSheet\(\)\{.*?\n\}', new_prepare, html, count=1, flags=re.S)
    if n != 1:
        raise RuntimeError('prepareMasterSheet patch fallita')

    new_import = r'''function importMappedMaster(){
 if(!requireLogin())return;
 const headers=(masterMatrix[masterHeaderRow]||[]).map(v=>String(v||'').trim()),c=definitiveMasterColumns(headers),rows=[];
 if(isDefinitiveMaster(c)){
  for(const row of masterMatrix.slice(masterHeaderRow+1)){
   const parsed=splitMasterArticleSize(row[c.article]);if(!parsed.article)continue;
   const loc=String(row[c.location]||'').trim().toUpperCase(),bancale=String(row[c.bancale]||'').trim().toUpperCase(),controlDate=c.controlDate>=0?String(row[c.controlDate]||'').trim():'';
   [[c.nuovo,'NUOVO'],[c.scaricato,'SCARICATO'],[c.usato,'USATO']].forEach(([idx,state])=>{
    if(idx<0)return;const qty=parseMasterQty(row[idx]);if(qty<=0)return;
    rows.push({article_base:parsed.article,size:parsed.size,quantity:qty,state,fila_scaffale:loc,fila:loc,scaffale:'',bancale,data_controllo_quantita:controlDate});
   });
  }
 }else{
  if($('mapArticle').value===''||$('mapQty').value==='')return alert('Seleziona almeno le colonne Articolo e Quantità.');
  for(const row of masterMatrix.slice(masterHeaderRow+1)){
   const article=normalizeArticle(masterCell(row,'mapArticle')),qty=parseMasterQty(masterCell(row,'mapQty'));if(!article||qty<=0)continue;
   const size=String(masterCell(row,'mapSize')||'').trim().toUpperCase(),state=$('mapState').value===''?'NON_CHIARO':normalizeMasterState(masterCell(row,'mapState'));
   let loc=String(masterCell(row,'mapLocation')||'').trim().toUpperCase();if(!loc){const f=String(masterCell(row,'mapFila')||'').trim().toUpperCase(),s=String(masterCell(row,'mapScaffale')||'').trim().toUpperCase();loc=f&&s?`${f}/${s}`:(f||s)}
   const bancale=String(masterCell(row,'mapBancale')||'').trim().toUpperCase();rows.push({article_base:article,size,quantity:qty,state,fila_scaffale:loc,fila:loc,scaffale:'',bancale});
  }
 }
 if(!rows.length)return alert('Non ho trovato giacenze valide da importare.');
 if(!confirm(`Importare ${rows.length} giacenze come nuovo magazzino master? La giacenza master precedente verrà sostituita.`))return;
 const before=structuredClone(db.master||{}),now=new Date().toISOString();db.master={rows,imported_at:now,filename:masterFileName,sheet:$('masterSheet').value,operator:operatorName()};
 audit('MASTER_IMPORT','MASTER','MASTER',before,structuredClone(db.master));saveDb();masterDialog.close();renderMasterStatus();renderRegistry();alert(`Master importato: ${rows.length} giacenze.`)
}'''
    html, n = re.subn(r'function importMappedMaster\(\)\{.*?\n\}', new_import, html, count=1, flags=re.S)
    if n != 1:
        raise RuntimeError('importMappedMaster patch fallita')

    new_status = r'''function renderMasterStatus(){
 const m=db.master||{},count=(m.rows||[]).length;
 if($('deleteMasterBtn'))$('deleteMasterBtn').classList.toggle('hidden',!count);
 if(!count){$('masterStatus').className='status';$('masterStatus').textContent='Nessun file master importato.';return}
 $('masterStatus').className='status good';
 $('masterStatus').textContent=`${m.filename||'Master'} · ${count} righe · importato ${fmtDateTime(m.imported_at)} da ${m.operator||'—'}`
}'''
    html, n = re.subn(r'function renderMasterStatus\(\)\{.*?\n\}', new_status, html, count=1, flags=re.S)
    if n != 1:
        raise RuntimeError('renderMasterStatus patch fallita')

    for required in ['CARICA','SCARICA','CERCA','REGISTRO','RICHIESTE','Fila/Scaffale','submitLogin','deleteRequest','definitiveMasterColumns','splitMasterArticleSize','setDefinitiveMasterUi','deleteMasterBtn','confirmDeleteMaster']:
        if required not in html:
            raise RuntimeError(f'Controllo fallito: {required}')
    return html
