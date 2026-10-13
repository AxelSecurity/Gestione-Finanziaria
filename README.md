# Gestione Finanziaria

App web per la finanza personale (mono-utente): entrate/uscite/trasferimenti, regola **50/30/20**, budget per categoria,
obiettivi di risparmio, **scadenzario** (bollette, bolli, assicurazioni, mutui e finanziamenti con piano di ammortamento),
ricorrenze, patrimonio netto/investimenti, report, notifiche Telegram/email, export e backup.

Stack: Next.js 15 + Prisma + SQLite, un solo container Docker.

## Sviluppo locale
```bash
cp .env.example .env      # imposta ADMIN_EMAIL / ADMIN_PASSWORD / AUTH_SECRET
mkdir -p data && npx prisma db push
npm run dev               # http://localhost:3000
npm test
```

## Deploy su VPS
```bash
cp .env.example .env      # compila: AUTH_SECRET (openssl rand -base64 32), ADMIN_EMAIL, ADMIN_PASSWORD, notifiche
docker compose up -d --build
```
- I dati stanno in `./data/finance.db` (volume): **fai backup di questa cartella** (o Impostazioni → Backup JSON).
- **Nginx Proxy Manager**: il compose non pubblica porte, l'app si raggiunge solo dalla rete Docker di NPM.
  1. Trova la rete di NPM: `docker network ls` (sulla tua VPS è `scoobydoo`, già il valore predefinito). Se cambia, imposta `PROXY_NETWORK=nome_rete` nel `.env`.
  2. In NPM → Proxy Hosts → Add: Domain `finanza.tuodominio.it`, Scheme `http`, Forward Hostname `gestione-finanziaria`, Port `3000`.
  3. Tab SSL: richiedi il certificato Let's Encrypt e attiva *Force SSL* (serve HTTPS per fotocamera e installazione come app).
  4. Tab Advanced, incolla: `client_max_body_size 25m;` (altrimenti scontrini e documenti oltre 1 MB vengono rifiutati).
- `ADMIN_EMAIL`/`ADMIN_PASSWORD` creano l'amministratore solo al primo avvio; poi la password si cambia dal **Profilo**.
  Password persa: imposta `ADMIN_RESET_PASSWORD=true` nel `.env`, riavvia, poi rimuovilo.
- **Utenti**: l'admin crea/disattiva/elimina utenti dal menu *Utenti*. Ogni utente ha dati completamente separati (conti, movimenti, scadenze, scontrini, budget, 50/30/20).
- All'avvio il DB viene copiato in `data/finance.db.bak` prima di aggiornare lo schema.
- Aggiornamento: `docker compose up -d --build` (lo schema si aggiorna da solo all'avvio).

## Notifiche scadenze
Ogni giorno alle 09:05 (Europe/Rome) arriva il riepilogo delle scadenze entro i giorni di promemoria impostati.
- **Telegram**: crea un bot con @BotFather e imposta `TELEGRAM_BOT_TOKEN`; ogni utente inserisce il proprio Chat ID in Impostazioni.
- **Email**: imposta `SMTP_*`; ogni utente può indicare l'indirizzo di destinazione (default: la sua email di accesso).
Da Impostazioni puoi inviare una notifica di test.

## Regola 50/30/20
Ogni categoria appartiene a un gruppo: Bisogni, Desideri, Risparmio (o Entrate). La dashboard confronta le uscite del
mese per gruppo con la % del reddito mensile (modificabile in Impostazioni). Le spese senza categoria contano come Desideri.
Per "risparmiare" registra una spesa nella categoria *Risparmio*/*Investimenti*.
