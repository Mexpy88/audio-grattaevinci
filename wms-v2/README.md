# Magazzino SO WMS V2 — Demo

Nuova architettura separata dalla V1 Excel-backed. La V1 resta congelata e non viene modificata.

## Obiettivo della demo

Un solo PC personale ospita il database e il server locale. Tablet e telefono personali usano lo stesso database in tempo reale quando sono collegati alla stessa rete locale.

La rete può essere:

- Wi‑Fi di casa;
- hotspot del telefono;
- hotspot/rete locale creata dal PC;
- altra LAN privata.

Il server ascolta su `0.0.0.0` e ricalcola dinamicamente le interfacce IPv4 disponibili. Non esiste quindi un IP fisso nel database: passando da casa all’hotspot cambierà soltanto l’indirizzo LAN da usare per collegare tablet/telefono.

### Utenti demo

| PIN | Utente | Ruolo |
|---|---|---|
| 1111 | Mattia | ADMIN — accesso completo |
| 2222 | Massimo | OPERATOR — operatività di magazzino |
| 3333 | Alessandra | SUPERVISOR_READONLY — sola lettura magazzino |
| 4444 | Lina | REQUESTER — crea e segue richieste |
| 5555 | Luca | GLOBAL_READONLY — supervisione globale sola lettura |

I PIN non sono salvati in chiaro: vengono derivati con `scrypt` e salt individuale.

## UX adattiva

La V2 non usa semplicemente la stessa pagina rimpicciolita.

- **Desktop (>=1100 px)**: console WMS più densa, navigazione laterale, tabelle complete, 4 colonne dashboard/azioni quando opportuno.
- **Tablet (600–1099 px)**: touch-first, 2 colonne, pulsanti e campi più grandi, navigazione compatta inferiore.
- **Smartphone (<600 px)**: layout a una colonna per le azioni, form impilati, pulsanti alti, controlli raggiungibili col pollice e dati secondari compressi.
- I dispositivi con puntatore `coarse` ricevono target touch maggiorati indipendentemente dalla larghezza.

La classificazione viene applicata anche a runtime (`desktop`, `tablet`, `phone`) per diagnostica e componenti specifici.

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
- manifest e service worker PWA predisposti;
- rilevamento dinamico LAN/hotspot tramite `/api/network`;
- pannello amministratore con indirizzo consigliato e copia rapida.

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
Tablet/Telefono: http://192.168.x.x:8787  [interfaccia preferita]
```

Se esistono più interfacce vengono mostrate anche le alternative. L’endpoint `/api/network` ricalcola l’elenco mentre il server è in esecuzione, quindi il passaggio Wi‑Fi di casa → hotspot non richiede modifiche al database o reinstallazioni.

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
