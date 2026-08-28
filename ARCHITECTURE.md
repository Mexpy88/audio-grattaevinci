# NOVA — invarianti architetturali

1. **Master + Ledger = giacenza corrente.** Il Master è la baseline; ogni operazione successiva è un evento del ledger.
2. **`DA UBICARE` non significa indisponibile.** La merce confermata in `AREA RICEVIMENTO` entra subito nella giacenza e può essere richiesta/prelevata.
3. **Cartoni e pezzi sono grandezze diverse.** Le richieste avanzano in cartoni; la giacenza varia esclusivamente per i pezzi fisicamente prelevati.
4. **Reimport idempotente.** In export il MAGAZZINO viene aggiornato alla situazione corrente; lo storico nel `NOVA_DATI` viene marcato non riapplicabile (`affectsStock:false`) così il reimport non raddoppia le quantità.
5. **Baseline Excel separata dalla baseline stock.** `master.excelRows` conserva le righe/coordinate del workbook; `master.rows` è la baseline logistica autorevole.
6. **Una sola responsabilità per motore.** `StockService`, `ReceivingService`, `RequestService`, `MovementService`, `ExcelService` e `Router` non vengono sostituiti a runtime.
7. **Event-driven.** Nessun polling UI. I render avvengono soltanto a seguito di navigazione o eventi dati espliciti.
8. **Operazioni prevalidate.** Un errore su una riga non può lasciare un prelievo parzialmente applicato.
9. **REMOTO è read-only per NOVA.** L'eventuale migrazione materializza una nuova baseline NOVA e non scrive mai `so_magazzino_v2`.
10. **Dipendenze pesanti lazy.** SheetJS viene caricato solo quando richiesto da una funzione Excel e non blocca l'avvio dell'app.
