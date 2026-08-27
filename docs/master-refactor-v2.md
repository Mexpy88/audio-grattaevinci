# REMOTO V1 — Master Excel refactor V2

Base: `2bfacda58b46346cf2a7af9ed26f65d8c193bd94`.

## Obiettivo

Rendere l'importazione Master lineare e reversibile senza modificare il formato dati operativo, il Master Generation Guard o i flussi di magazzino già validati.

## Percorso autorevole

1. `base.html` contiene il dialog/input Excel storico.
2. `local-master.js` continua a fornire gestione file locale, export e `LocalMaster`.
3. `ui-hardening.js` è ora passivo per il Master: non sostituisce più `window.importMappedMaster`.
4. `warehouse-master-schema-v4.js` installa l'importatore V4 ufficiale.
5. `master-controller-v2.js` viene caricato IMMEDIATAMENTE dopo V4 e conserva un riferimento diretto a quell'importatore.
6. `master-generation-guard-v2.js` resta autorevole per SHA-256, lineage, generazioni e protezione export. Il controller usa direttamente le API pubbliche `inspectWorkbookBytes` + `validateInspection` prima dell'importazione.
7. Il controller ripristina `window.importMappedMaster` al riferimento V4 diretto se un vecchio wrapper tenta di sostituirlo.

## Moduli ritirati dal runtime, NON cancellati

- `local-master-ux.js`
  - sostituiva `window.importMappedMaster`;
  - duplicava salvataggio file/audit già gestiti dal V4;
  - rimane nel repository esclusivamente per rollback/storia.

- `master-import-ui-cleanup.js`
  - modificava globalmente `window.confirm`, `window.alert` e `warehouseToast`;
  - la nuova UI è gestita localmente da `master-controller-v2.js`;
  - rimane nel repository esclusivamente per rollback/storia.

## Cose intenzionalmente NON rimosse

- `local-master.js`: necessario a export, IndexedDB, gestione Master e protezione operazioni senza Master.
- `local-master-ooxml.js`: necessario all'aggiornamento fisico del workbook.
- `master-generation-guard-v2.js`: necessario per lineage/generazioni/hash e naming export.
- `warehouse-master-schema-v4.js`: contratto ufficiale delle colonne A:I e motore stock V4.
- `master-panel-minimize-v2.js`: mantiene il pannello legacy coerente; il nuovo controller evita di usarlo nella transazione critica di import.

## Protezione transazione import

Durante la sola transazione di import il controller:

- valida prima il file con il Generation Guard;
- chiama il riferimento diretto dell'importatore V4;
- disabilita temporaneamente solo i rendering storici `renderRegistry` e `LocalMaster.renderPanel` per evitare catene di wrapper durante il commit;
- non usa popup nativi `alert/confirm`;
- non salva copie complete da migliaia di righe nell'audit `MASTER_IMPORT`;
- dopo il commit registra un audit compatto e aggiorna Dashboard/Generation Guard.

In caso di eccezione l'importatore V4 conserva il proprio rollback `beforeDb`, quindi il Master precedente non viene sostituito a metà operazione.

## Regola di manutenzione

Non eliminare fisicamente un modulo legacy solo perché non è più caricato. Prima deve risultare assente dall'ordine di caricamento e da tutte le dipendenze runtime per almeno una build fisicamente validata.
