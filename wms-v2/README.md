# Magazzino SO WMS V2 — Demo

Nuova architettura separata dalla V1 Excel-backed. La V1 resta congelata e non viene modificata.

## Obiettivo della demo

Un solo PC personale ospita il database e il server locale. Tablet e telefono personali, collegati alla stessa rete Wi‑Fi, usano lo stesso database in tempo reale.

### Utenti demo

| PIN | Utente | Ruolo |
|---|---|---|
| 1111 | Mattia | ADMIN — accesso completo |
| 2222 | Massimo | OPERATOR — operatività di magazzino |
| 3333 | Alessandra | SUPERVISOR_READONLY — sola lettura magazzino |
| 4444 | Lina | REQUESTER — crea e segue richieste |
| 5555 | Luca | GLOBAL_READONLY — supervisione globale sola lettura |

I PIN non sono salvati in chiaro: vengono derivati con `scrypt` e salt individuale.

## Primo vertical slice già implementato

- database SQLite unico (`data/warehouse.db`);
- login e sessioni per i 5 ruoli;
- home differenziata per ruolo;
- stock demo centralizzato;
- ricerca giacenze;
- Lina crea una richiesta a cartoni;
- Massimo/Mattia la ricevono tramite SSE realtime;
- presa in carico;
- prelievo con separazione cartoni / pezzi;
- decremento transazionale della giacenza;
- chiusura richiesta anche se non è stato prelevato il 100%;
- residuo registrato come `NON DISPONIBILE`;
- Alessandra e Luca in sola lettura;
- audit delle operazioni;
- reset della demo disponibile solo a Mattia/Admin;
- frontend responsive PC/tablet/telefono;
- manifest e service worker PWA predisposti.

Il vertical slice viene validato dalla workflow dedicata `WMS V2 Check` e da un test di dominio che riproduce il caso 47 cartoni richiesti / 5 prelevati / richiesta completata.

## Avvio sul PC personale

Prerequisito per questa fase di sviluppo: Node.js 20+ (consigliato Node 22 LTS).

```powershell
cd wms-v2
npm install
npm start
```

Il terminale mostra automaticamente:

```text
PC: http://localhost:8787
Tablet/Telefono: http://192.168.x.x:8787
```

Aprire sul tablet e sul telefono l'indirizzo LAN stampato dal server. Tutti i dispositivi devono essere sulla stessa rete Wi‑Fi.

## Scenario demo consigliato

1. PC → login `1111` Mattia.
2. Tablet → login `2222` Massimo.
3. Telefono → login `4444` Lina.
4. Lina crea e invia una richiesta.
5. Sul tablet compare la nuova richiesta senza refresh manuale.
6. Massimo la prende in carico, registra cartoni e pezzi, quindi la completa.
7. Sul telefono Lina vede lo stato aggiornato.
8. Sul PC Mattia vede giacenza e audit aggiornati.
9. Logout/login `3333` o `5555` per mostrare le viste sola lettura.

## Nota PWA/installazione

La web app funziona già sulla LAN in HTTP. Il service worker/PWA è predisposto, ma i browser mobili richiedono normalmente un contesto HTTPS per l'installazione completa da un indirizzo LAN. La fase successiva aggiungerà il packaging/HTTPS locale necessario per avere installazione pulita su PC, tablet e telefono senza dipendere da servizi a pagamento.

## Roadmap immediata

1. import Master Excel una tantum → SQLite diventa fonte ufficiale;
2. CARICA / SCARICA / MODIFICA completi;
3. motivazioni dettagliate dei mancanti nelle richieste;
4. inventario e SPOSTA;
5. dashboard e supervisione multi-magazzino;
6. export Excel dal database;
7. backup automatici;
8. QR/barcode e picking guidato;
9. packaging Windows + installazione PWA/Android per la demo.
