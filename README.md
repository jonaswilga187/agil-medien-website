# AGIL Medien und Eventtechnik — Website

Statisches Frontend (`/frontend`) + kleines self-hosted Node-Backend für das
Kontaktformular (`/backend`). Kein Framework, kein Build-Schritt — passt 1:1
in dein bestehendes Muster auf `web01` (Frontend + Node-Backend als eigener
Docker-Compose/Coolify-Stack).

## Deployment auf web01 (Coolify)

1. **Kein Dockerfile/Compose im Repo** — muss vor dem ersten Deploy noch
   angelegt werden. Zwei Optionen:
   - Zwei separate Coolify-Resources: `frontend` als Static Site (Docroot
     `/frontend`), `backend` als Node-App (`npm install && npm start`,
     Port 3000) — genau dein bestehendes Muster.
   - Oder eine `docker-compose.yml`, die beide Services als einen Stack
     beschreibt (`frontend`: z. B. `nginx:alpine` mit `/frontend` als
     Docroot; `backend`: Node-Service aus `/backend`).
2. **Traefik-Routing:** `agil-medien.de/api/*` → `backend`, alles andere
   → `frontend` — **wichtig:** muss als Pfad-Routing auf derselben Domain
   passieren, nicht als eigene Subdomain fürs Backend. Das Frontend ruft
   `/api/captcha` und `/api/contact` als relative Pfade auf (siehe
   `frontend/index.html`), das funktioniert nur auf demselben Origin.
   HTTPS/Force-HTTPS übernimmt dein Coolify-Proxy automatisch, dafür musst
   du im Code nichts tun.
3. **Umgebungsvariablen** aus `backend/.env.example` als **Secrets in
   Coolify** setzen, nicht ins Repo committen — das ist der "Secrets raus aus
   dem Frontend"-Punkt: der Browser sieht davon nichts, nur der Backend-Container.
   `ALLOWED_ORIGIN` muss exakt `https://agil-medien.de` sein (kein `www.`,
   kein trailing Slash), sonst blockt CORS das Formular im Browser lautlos.
4. **DNS:** `agil-medien.de` auf web01 zeigen lassen (wie bei deinen anderen
   Stacks über cloudflared/Traefik).
5. **Trust Proxy im Backend:** `server.js` nutzt `express-rate-limit`, setzt
   aber nirgends `app.set('trust proxy', ...)`. Hinter Coolifys
   Traefik-Reverse-Proxy sieht Express sonst nur die Proxy-IP statt der
   echten Client-IP — das Rate-Limiting würde dann alle Besucher gemeinsam
   limitieren oder Validierungsfehler werfen. Vor dem Live-Gang ergänzen.

## Vor dem Live-Gang noch zu erledigen

- [ ] Dockerfile(s) bzw. `docker-compose.yml` für den Coolify-Stack anlegen
- [ ] `app.set('trust proxy', 1)` in `backend/server.js` ergänzen (siehe oben)
- [ ] SMTP-Zugangsdaten in `backend/.env` eintragen (dein E-Mail-Anbieter für `kontakt@agil-medien.de`)
- [ ] `CAPTCHA_SECRET` generieren: `openssl rand -hex 32`
- [ ] Test: Formular einmal komplett durchklicken, prüfen ob die Mail ankommt
- [ ] Test: Spam-Schutz — Honeypot-Feld per DevTools befüllen → sollte abgelehnt werden
- [ ] Domain in `sitemap.xml`, `robots.txt` und den `canonical`-Tags final bestätigen (aktuell `agil-medien.de` angenommen)
- [x] Echte Fotos ins `#referenzen`-Grid eingesetzt (Scheunenhochzeit + Stadtwerke Celle Cup, siehe Bildhinweise unten) — Grid ist bewusst zweispaltig, kein dritter Platzhalter mehr
- [ ] Datenschutzerklärung anpassen, sobald der konkrete E-Mail-Anbieter feststeht
- [ ] Ab Dezember 2026: Wirtschafts-Identifikationsnummer (W-IdNr.) ins Impressum ergänzen, sobald vom Finanzamt zugeteilt

## Cookiefreie Analytics (Umami/Plausible)

Am saubersten passt das zu deinem Setup, wenn du **Umami selbst hostest** —
ein weiterer kleiner Coolify-Stack auf `web01` oder `pve-nuc`, analog zu
deinen anderen Test-Stacks. Danach in `index.html` den auskommentierten
Script-Tag aktivieren und die eigene `data-website-id` eintragen. Ohne
Cookies und ohne personenbezogene Profile ist dafür in der Regel kein
Cookie-Consent-Banner nötig — Erwähnung in der Datenschutzerklärung reicht
(ist schon vorbereitet).

## Bilder für die Referenzen-Sektion

Sobald echte Eventfotos da sind:
- Vor dem Upload komprimieren (z. B. mit Squoosh oder TinyPNG)
- Max. Breite ca. 1600 px reicht für Web-Darstellung völlig
- Format WebP bevorzugen, JPEG als Fallback
- Jedem Bild echten, beschreibenden Alt-Text geben (nicht nur "Foto 1")

## Spam-Schutz im Kontaktformular (kein Drittanbieter)

- **Honeypot-Feld**: unsichtbar für Menschen, wird oft trotzdem von Bots ausgefüllt → Anfrage wird verworfen
- **Zeitprüfung**: Formulare, die schneller als 3 Sekunden nach dem Laden abgeschickt werden, gelten als verdächtig
- **Stateless Mini-Captcha**: zwei Zahlen + HMAC-signiertes Token, ohne Server-Session — passt zum Least-Privilege-Gedanken, da kein zusätzlicher Speicher/State nötig ist
- **Rate-Limiting**: max. 8 Anfragen pro 15 Minuten und IP am Backend

## Struktur

```
frontend/
  index.html
  impressum.html
  datenschutz.html
  agb.html
  404.html
  robots.txt
  sitemap.xml
  assets/
    styles.css
    agil-logo.png, agil-logo-mark.png
    favicon-32.png, apple-touch-icon.png, icon-512.png
    og-image.png
    referenzen/
      referenz-hochzeit-scheune.jpg, .webp
      referenz-dart-turnier.jpg, .webp
backend/
  server.js
  package.json
  .env.example
```
