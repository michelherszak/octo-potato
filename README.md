# TechThese

Eine eigenständige, lesbare Website für Technologieanalysen und Aktienmemos. Die Recherche bleibt in **Evaluating Stocks**. TechThese erhält ausschließlich ausdrücklich freigegebene Veröffentlichungspakete; es ruft weder Yahoo Finance noch SEC EDGAR auf.

## Die erste Version

- Magazin-Startseite mit Suche und Themenfiltern.
- Acht Themenbereiche: Quanten-Technologie, KI, Halbleiter, Energie, Robotik, Cybersecurity, Raumfahrt/Kommunikation und Biotech/Medizintechnik.
- 24 recherchierte Unternehmen mit Quellen und bewussten Mehrfachzuordnungen. Das ist eine Anfangsauswahl, keine automatische Klassifizierung aller 511 Aktien aus dem Research-System.
- Unternehmensprofile und Beiträge aus freigegebenen Artikeln ergänzen die Themenübersichten automatisch.
- Artikel kombinieren eigene Analyse, verständliches Memo, Kennzahlen, Quellen und festgehaltenen Datenstand.
- Servergerenderte Seiten, Artikel-Metadaten, kanonische Artikeladressen, strukturierte Article-Daten und Sitemap.
- Geschützter Import, unveränderliche frühere Versionen, Schutz vor veralteten Änderungen und wiederholbaren Übertragungen.
- Zwei ausdrücklich gekennzeichnete Grundlagen-Beispielbeiträge. Es werden keine erfundenen Finanzkennzahlen verwendet.

## Lokal starten

Voraussetzung: Node.js ab 22.13 (für Tests Node.js 24 oder neuer empfohlen).

```sh
npm ci
cp .env.example .dev.vars
```

In `.dev.vars` einen zufälligen `PUBLISH_TOKEN` mit mindestens 32 Zeichen eintragen. Das ist derselbe Veröffentlichungsschlüssel wie im privaten Publisher. `.dev.vars` bleibt außerhalb von Git.

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_familiar_darwin.sql
npm run dev -- --port 5180 --hostname 127.0.0.1
```

Die erste Migration nur einmal je neuer lokaler Datenbank anwenden. Spätere Datenbankänderungen erzeugen zusätzliche Migrationen. Vorschau: `http://localhost:5180`.

## Verbindung mit Evaluating Stocks

Die Bridge im Ordner `integrations/` enthält genau die ergänzenden Dateien und einen begrenzten Installer. In dieser Arbeitsumgebung ist sie bereits eingebaut.

```sh
python3 integrations/install.py --app "/Pfad/zu/Evaluate stocks" --check
python3 integrations/install.py --app "/Pfad/zu/Evaluate stocks"
python3 integrations/configure.py --app "/Pfad/zu/Evaluate stocks" --url "http://localhost:5180"
```

Der Konfigurator fragt den Schlüssel verdeckt ab. Er schreibt nur in die ignorierte `data/website_settings.json`. Für eine private Sites-Website zusätzlich `--sites` verwenden und deren vorhandenen Service-Zugang konfigurieren. Zugangsdaten nie in Git, öffentliche Browserdateien oder URLs schreiben.

In Evaluating Stocks: **Memo → Auf TechThese veröffentlichen → Entwurf speichern & prüfen → Freigabe → Auf Website veröffentlichen**. Titel, Autor, Kurzbeschreibung, Analyse, lesbarer Memo-Text, historische Analysedaten, zusätzliche Quellen und Themen sind bearbeitbar. Der lokale Entwurf wird beim Prüfen gespeichert.

Nur vollständig erstellte Memos mit bestandenem Prüfstatus und intern veröffentlichter Auswertung dürfen übertragen werden. Private Portfolio- und Journal-Daten, Provider-Schlüssel sowie vollständige Quelldateien bleiben im Research-System. Alle ausgewählten Kennzahlen werden aus der gespeicherten Auswertung übernommen; fehlende Berichtszeiträume sind als solche erkennbar.

## Veröffentlichungsvertrag

`POST /api/import` erwartet `Authorization: Bearer <PUBLISH_TOKEN>` und ein Paket gemäß `lib/contract.ts`: `publication_id` (UUID), `expected_revision` und `article`. Zusätzliche, nicht deklarierte Felder werden abgewiesen. Quellen akzeptieren ausschließlich HTTP(S)-URLs. Die maximale Paketgröße beträgt 400 kB.

Bei einer privaten Sites-Website wird zusätzlich der plattformeigene `OAI-Sites-Authorization`-Header benötigt. Er wird nur vom privaten Backend an den zugehörigen Site-Origin gesendet.

Eine bekannte Übertragungskennung mit identischem Inhalt liefert dieselbe Veröffentlichung zurück. Dieselbe Kennung mit geändertem Inhalt sowie veraltete Versionsstände werden abgewiesen. Änderungen werden atomar in D1 gespeichert; frühere Fassungen bleiben in `article_versions` erhalten. Es gibt keine öffentlichen Schreib- oder Verwaltungsseiten.

## Hosting und Daten

Die erste Online-Testversion wird über Sites auf Cloudflare Workers mit einer eigenen D1-Datenbank betrieben. Das Repository bleibt eigenständig; ein späterer Wechsel zu einem anderen kompatiblen Worker-Hosting ist möglich. `SITE_URL` legt den kanonischen Origin fest. `SITE_INDEXABLE=false` sperrt die Testversion für Suchmaschinen. Indexierbarkeit erst zusammen mit einer bewusst öffentlichen Freigabe aktivieren.

Lokale und gehostete Datenbanken sind getrennt. Die Hosting-Pipeline wendet die SQL-Migrationen an. D1-Inhalte und private Entwürfe sind keine Git-Backups: für dauerhaften Betrieb zusätzlich Inhalts- und Datenbankexporte einrichten.

Vor einem öffentlichen Start Betreiberangaben und Datenschutzhinweise ergänzen, Datenrechte prüfen und die endgültige Domain festlegen. Die aktuelle Testversion bleibt privat. Die Anwendung enthält keine Werbung und kein Tracking.

## Prüfen

```sh
npm test
npx tsc --noEmit
npm run build
node scripts/check-secrets.mjs
```

Die Tests prüfen Cluster, den strikten Publikationsvertrag, Quellenadressen, wiederholbare Übertragungen, Versionskonflikte und die Erhaltung des ursprünglichen Veröffentlichungsdatums. [Ablauf für den Test morgen](docs/test-morgen.md).

## Projektstruktur

`app/` enthält die öffentliche Darstellung und den Import-Endpunkt; `lib/` den Inhaltsvertrag, die Themenzuordnung und Beispieldaten; `db/` und `drizzle/` das Schema und Migrationen; `integrations/` die private Publisher-Bridge. Die mitgelieferten Build-Helfer stammen aus dem Sites/Vinext-Starter und behalten ihre Lizenzhinweise.

### Suche mit Einstiegen

Die Startseite und Unternehmensübersicht bieten acht verständliche Einstiegsfragen, Vorschläge beim Tippen und eine Suche nach Alltagsbegriffen (z. B. Strom, Chips, Medizin), englischen Themenbegriffen und kleineren Schreibfehlern. Die Vorschläge verlinken vorhandene Themen, Unternehmen und Beiträge. Sie entstehen aus dem aktuellen Veröffentlichungskatalog, ohne externe KI-Anfragen oder Speicherung von Suchverläufen. Neu veröffentlichte Unternehmen und Artikel werden beim nächsten Seitenaufruf automatisch aufgenommen. Pfeiltasten wählen einen Vorschlag, Enter öffnet ihn und Escape schließt die Liste. Der Suchknopf führt immer die eingegebene Suche aus.

### Themen zuerst

Die Startseite ordnet Analysen, Memos und Unternehmen unter den acht Technologiethemen ein. Jeder Themenbereich zeigt die vorhandenen Inhalte und einen kompakten Beitragseinstieg. Themen ohne Artikel bleiben als Recherchebereich sichtbar. Die Suche mit Vorschlägen und Einstiegsfragen ist als ergänzender Bereich erreichbar. Auch Themenunterseiten nutzen kompakte Beitragslisten; das Erscheinungsbild und die Artikelseiten bleiben erhalten.

Die Startseite und Unternehmensübersicht verzichten auf große Einleitungssektionen. Themen, Suche und Rechercheauswahl stehen direkt im Arbeitsbereich.
