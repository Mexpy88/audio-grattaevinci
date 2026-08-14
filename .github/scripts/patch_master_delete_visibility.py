def apply_delete_visibility_patch(html: str) -> str:
    # Il pulsante ELIMINA MASTER deve essere sempre visibile nella scheda master.
    html = html.replace(
        'id="deleteMasterBtn" class="btn danger hidden"',
        'id="deleteMasterBtn" class="btn danger"',
        1,
    )

    # Non nasconderlo quando cambia lo stato del master.
    html = html.replace(
        "if($('deleteMasterBtn'))$('deleteMasterBtn').classList.toggle('hidden',!count);",
        "if($('deleteMasterBtn'))$('deleteMasterBtn').classList.remove('hidden');",
        1,
    )

    # Quando il master viene eliminato, registra il momento del reset delle giacenze.
    # In questo modo CERCA non riporta in vita movimenti storici precedenti al reset.
    html = html.replace(
        "db.master=blankDb().master;",
        "db.master=blankDb().master;db.master_reset_at=new Date().toISOString();",
        1,
    )

    # Quando si importa un nuovo master, il nuovo snapshot diventa la baseline corrente.
    html = html.replace(
        "db.master={rows,imported_at:now,filename:masterFileName,sheet:$('masterSheet').value,operator:operatorName()};",
        "db.master={rows,imported_at:now,filename:masterFileName,sheet:$('masterSheet').value,operator:operatorName()};db.master_reset_at=null;",
        1,
    )

    # Se non c'è un master, considera soltanto eventuali movimenti successivi al reset.
    html = html.replace(
        "const cutoff=db.master?.imported_at?new Date(db.master.imported_at).getTime():0;",
        "const cutoff=db.master?.imported_at?new Date(db.master.imported_at).getTime():(db.master_reset_at?new Date(db.master_reset_at).getTime():0);",
        1,
    )

    # Dopo la cancellazione aggiorna immediatamente anche la schermata CERCA.
    html = html.replace(
        "saveDb();closeDeleteMasterDialog();renderMasterStatus();renderRegistry();",
        "saveDb();closeDeleteMasterDialog();renderMasterStatus();renderRegistry();if($('searchInput'))$('searchInput').value='';if(typeof renderStock==='function')renderStock();",
        1,
    )

    for required in ['deleteMasterBtn', 'openDeleteMasterDialog', 'confirmDeleteMaster', 'master_reset_at']:
        if required not in html:
            raise RuntimeError(f'Controllo cancellazione master fallito: {required}')
    return html
