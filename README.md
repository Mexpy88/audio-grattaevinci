# MAGAZZINO NOVA

Applicazione clean-room per la gestione del Magazzino Teramo.

## Separazione da REMOTO
NOVA non carica né esegue alcun file JavaScript di REMOTO. Il database legacy `so_magazzino_v2` può essere **letto** solo tramite una migrazione esplicita; non viene mai scritto o cancellato. NOVA usa esclusivamente `so_magazzino_nova_v1` (`NOVA_DB_V1`).

## Architettura
- un solo `Store` persistente;
- un solo `Router` con back-stack esplicito;
- un solo `StockService`, basato su Master + ledger;
- un solo `ReceivingService` per Entrata Merci;
- nessun `MutationObserver` usato per correggere UI;
- nessun `setInterval`/polling della UI;
- nessun override/monkey-patch di funzioni;
- rendering solo su navigazione, azione utente o reale modifica dati;
- SheetJS/XLSX caricato **lazy**, solo quando serve importare/esportare Excel.

## Moduli finali
- Login e ruoli: Mattia, Massimo, Alessandra, Lina, Luca;
- Master Excel: import, migrazione storico, export aggiornato, `NOVA_DATI` nascosto;
- Entrata Merci: fornitore, DDT, scansione/allegato assistito, controllo fisico, conteggio parziale, Area Ricevimento, posizione suggerita, ubicazione;
- disponibilità immediata della merce `DA UBICARE`;
- notifica `MERCE ARRIVATA` a Lina in sola lettura;
- Giacenze: ricerca, rettifica, conteggio assistito e materiale trovato non previsto;
- Movimentazione: Scarica e Sposta;
- Richieste a **cartoni**: i cartoni determinano l'avanzamento; i pezzi reali vengono scaricati dal Master al prelievo;
- Registro Movimenti / Audit con filtri ed export dedicato;
- Riepilogo attività giornaliero con calendario;
- vista smartphone/desktop.

## Invarianti logistici
- `DA UBICARE` = merce disponibile, non merce bloccata;
- una richiesta non decrementa la giacenza in cartoni: il Master cambia solo per i **pezzi fisicamente prelevati**;
- un'operazione multi-riga viene prevalidata prima di mutare lo stock;
- reimportare un export NOVA non deve raddoppiare le giacenze;
- le formule Excel sulle celle quantità vengono rimosse quando NOVA scrive il valore corrente autorevole.

## Verifica
```bash
npm run verify
```
La suite controlla sintassi, isolamento dal legacy, invarianti architetturali, ruoli/UI, back-stack, mapping Excel e flussi logistici end-to-end/atomici.

## Artefatto pubblicato
La build live è suddivisa in 15 parti verificate da SHA-256 (`cf0f975dfb999d45c9d03c9e7bc98db831c489dbef6ac8f0f0b149133a223be8`). `index.html` ricompone l'artefatto e rifiuta l'avvio se un byte non coincide con la build testata.
