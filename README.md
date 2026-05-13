# Saalplan – Munich Watch Fair

Visueller Saalplan für die Munich Watch Fair. Liest und schreibt live in Airtable, läuft auf iPad und iPhone, deploybar auf GitHub Pages.

## Funktionen

- 316 Stände in 10 Karrees + Außenreihen, exakt nach Plan-PDF
- Klick auf Stand → Detail (Status, Aussteller, Notizen, Bezahlt)
- Farbcodierung: grau = frei, grün = besetzt, gelb = reserviert, gelber Rahmen = bezahlt
- Suche nach Standnummer oder Aussteller-Name
- Auto-Sync mit Airtable alle 30 Sekunden + Pull-to-refresh
- Statistik-Leiste oben (besetzt / reserviert / frei)
- Offline-tolerant: Änderungen werden gepuffert und beim Reconnect gesendet
- Pinch-to-Zoom + Pan auf Mobile

## Technik

Vanilla JS, keine Build-Tools, keine Dependencies. Module via nativem `<script type="module">`. Reine Static-Files — perfekt für GitHub Pages.

```
Saalplan-2026/
├── index.html
├── src/
│   ├── app.js          ← Haupt-Logik
│   ├── layout.js       ← Position der 316 Stände
│   ├── airtable.js     ← API-Client
│   └── style.css
└── README.md
```

## Setup-Anleitung

### 1. Repo erstellen auf GitHub

1. Geh auf https://github.com/new
2. Repository name: `Saalplan-2026`
3. Owner: `MaxsLobster`
4. Visibility: **Private** (wichtig, damit der Plan nicht öffentlich ist)
5. „Create repository" klicken

### 2. Dateien hochladen

In Terminal:

```bash
cd ~/Desktop/Saalplan2.0
git init
git add .
git commit -m "Initialer Wurf"
git branch -M main
git remote add origin https://github.com/MaxsLobster/Saalplan-2026.git
git push -u origin main
```

Falls Git fragt, gib deinen GitHub-Benutzernamen + ein Personal Access Token ein (nicht das Passwort).

### 3. GitHub Pages aktivieren

1. Im GitHub-Repo: **Settings** (oben rechts)
2. Links im Menü: **Pages**
3. Source: **Deploy from a branch**
4. Branch: **main**, Folder: **/ (root)**
5. **Save**

Nach 1–2 Minuten ist die App live unter:
`https://maxslobster.github.io/Saalplan-2026/`

> **Wichtig**: Bei einem privaten Repo brauchst du einen kostenpflichtigen GitHub-Account (Pro/Team), damit GitHub Pages funktioniert. Falls das nicht geht, mach das Repo public — der Code enthält **keine** Tokens oder Aussteller-Daten, das ist OK.

### 4. Airtable Personal Access Token erstellen

1. Geh zu https://airtable.com/create/tokens
2. Klick **„Create new token"**
3. Name: `Saalplan-App`
4. Scopes: aktiviere **`data.records:read`** UND **`data.records:write`**
5. Access: **Add a base** → wähle **„Munich Watch Fair - Standplan"**
6. **Create token** → kopiere den Token (beginnt mit `pat...`)

> Der Token wird **NUR** lokal im Browser gespeichert (in `localStorage`). Er liegt **niemals** im Code oder im GitHub-Repo.

### 5. App auf iPad/iPhone hinzufügen

1. Öffne `https://maxslobster.github.io/Saalplan-2026/` im **Safari** (nicht Chrome — sonst kein Home-Screen-Shortcut)
2. Tippe auf das **Teilen-Icon** (Quadrat mit Pfeil nach oben)
3. **„Zum Home-Bildschirm hinzufügen"**
4. Name z. B. „Saalplan"
5. **Hinzufügen**

Jetzt hast du ein App-Icon. Beim ersten Tap fragt die App nach dem Airtable-Token → einmalig einfügen → fertig.

## Wie du den Code lokal testest (optional)

```bash
cd ~/Desktop/Saalplan2.0
python3 -m http.server 8000
```

Dann im Browser: http://localhost:8000

## Häufige Fragen

**„Sync-Fehler" rot angezeigt** → Klick auf die rote Anzeige, dann siehst du den Fehlertext. Meist: Token abgelaufen oder Internet weg.

**Anna sieht Änderungen nicht?** → Die App synct alle 30s. Mit Pull-to-refresh (auf Mobile nach unten ziehen) oder Klick auf Sync-Button sofort aktualisieren.

**Aussteller-Tabelle nachträglich erweitert?** → Neue Aussteller erscheinen beim nächsten Sync automatisch in der Autocomplete-Liste.

**Token muss ich neu eingeben?** → Klick rechts oben auf „⎋", dann gibst du den Token neu ein.

## Was wenn was kaputt geht

Der Code ist klein und überschaubar. Wenn du etwas ändern willst:

- **Layout (Positionen der Stände)** → [src/layout.js](src/layout.js)
- **Airtable-Felder oder Tabellen-IDs** → [src/airtable.js](src/airtable.js)
- **Aussehen** → [src/style.css](src/style.css)
- **App-Logik** → [src/app.js](src/app.js)

Bei jedem `git push` auf `main` aktualisiert GitHub Pages automatisch nach 1-2 Minuten.
