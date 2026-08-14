def apply_delete_visibility_patch(html: str) -> str:
    # Il pulsante ELIMINA MASTER deve essere sempre visibile nella scheda master.
    html = html.replace(
        'id="deleteMasterBtn" class="btn danger hidden"',
        'id="deleteMasterBtn" class="btn danger"',
        1,
    )

    # Non nasconderlo quando cambia lo stato del master: se non c'è un master,
    # il click mostrerà semplicemente il messaggio previsto dalla funzione.
    html = html.replace(
        "if($('deleteMasterBtn'))$('deleteMasterBtn').classList.toggle('hidden',!count);",
        "if($('deleteMasterBtn'))$('deleteMasterBtn').classList.remove('hidden');",
        1,
    )

    # Dopo la cancellazione aggiorna immediatamente anche la schermata CERCA.
    html = html.replace(
        "saveDb();closeDeleteMasterDialog();renderMasterStatus();renderRegistry();",
        "saveDb();closeDeleteMasterDialog();renderMasterStatus();renderRegistry();if($('searchInput'))$('searchInput').value='';if(typeof renderStock==='function')renderStock();",
        1,
    )

    for required in ['deleteMasterBtn', 'openDeleteMasterDialog', 'confirmDeleteMaster']:
        if required not in html:
            raise RuntimeError(f'Controllo cancellazione master fallito: {required}')
    return html
