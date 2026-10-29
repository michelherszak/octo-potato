# E-Mail-Abos pro Unternehmen

## Nutzung

Auf Unternehmensseiten und unter zugeordneten Artikeln führt „Unternehmen folgen“
zu `/konto?ticker=…`. Die Auswahl bleibt über den E-Mail-Bestätigungslink erhalten.
Der Link öffnet zuerst eine Bestätigungsseite; erst deren POST bestätigt die Adresse.
Anmeldung allein aktiviert keine Updates. Im Konto werden Unternehmen oder alle
Beiträge ausgewählt und mit ausdrücklicher Einwilligung gespeichert. Es gibt keinen
Passwortzwang. Updates lassen sich mit erhaltener Auswahl pausieren und durch eine
neue Bestätigung der Auswahl fortsetzen. Jede Nachricht enthält einen Abmeldelink.

Neue Beiträge benachrichtigen automatisch die passenden bestätigten Abonnenten.
Bei einer bestehenden Artikeladresse kann der Publisher „Abonnenten über diese
inhaltliche Aktualisierung informieren“ auswählen. Kleine Korrekturen bleiben still.
Übertragungswiederholungen und die gleichzeitige Auswahl „alle Beiträge“ plus Ticker
werden dedupliziert. Benachrichtigungen beziehen sich auf die unveränderliche
veröffentlichte Version; nachträgliche Artikeländerungen verändern keine Mail.

## Produktionsbetrieb

- Website: `https://techthese.de`; Worker: `octo-potato`.
- Versanddomain: `updates.techthese.de`, Resend-Region Irland (`eu-west-1`).
- Absender: `TechThese <neu@updates.techthese.de>`.
- DNS: TXT `resend._domainkey.updates`, DNS-only-CNAMEs `rsend.updates` und
  `send.updates`. Die Werte stammen aus der angelegten Resend-Domain. Bestehende
  Website-/Mail-Einträge bleiben erhalten. Kein Tracking-Subdomain-Setup.
- Laufzeit-Secrets: `ACCOUNT_SECRET` (eigenständig, mindestens 32 Zeichen),
  `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_SIGNUP_ENABLED=true`,
  `EMAIL_UPDATES_ENABLED=true`, `EMAIL_DAILY_LIMIT=100`, `SITE_URL` und der
  vorhandene `PUBLISH_TOKEN`. Geheimnisse weder hier noch in Git hinterlegen.
- Der verwendete Resend-Schlüssel braucht nur Sendeberechtigung. Domainverwaltung
  erfolgt im Resend-Konto; ein Sendeschlüssel darf die Domains-API nicht lesen.
- Migrationen werden vor dem neuen Worker angewandt, einschließlich
  `0002_neat_preak.sql`. Bereits vorhandene Artikel und Statistiken bleiben bestehen.
- Der Worker verarbeitet die dauerhafte D1-Warteschlange alle fünf Minuten über
  einen Cloudflare-Cron-Trigger. Authentifizierter Ersatzaufruf:
  `POST /api/updates/dispatch` mit dem vorhandenen Publisher-Schlüssel.

Das App-Budget begrenzt neue Versandaufträge auf 100 pro UTC-Tag, einschließlich
Anmeldemails. Jeder Empfänger zählt einzeln. Wiederholungen mit demselben
Idempotenzschlüssel verbrauchen keinen weiteren App-Slot. Bei ausgeschöpftem Budget
warten Beitragsnachrichten bis zum Folgetag; Anmeldung zeigt dann eine vorübergehende
Nichtverfügbarkeit. `EMAIL_DAILY_LIMIT=0` hebt nur das App-Limit auf und ändert keinen
Resend-Tarif. Außerhalb der Anwendung versendete Resend-Mails sind in diesem
App-Zähler nicht enthalten.

## Zuverlässigkeit und Datenschutz

Vor jedem Versand werden Einwilligung und Unternehmensauswahl erneut geprüft.
Pausieren, geänderte Auswahl oder Abmeldung stornieren nicht mehr passende Aufträge.
Eine schon laufende Zustellung kann noch eintreffen. Der exakte Provider-Auftrag
wird vor dem ersten Versuch gespeichert. Fehler werden begrenzt wiederholt;
Budget-/429-Verschiebungen zählen nicht als fehlgeschlagene Zustellversuche.
Nach 23 Stunden ab dem ersten tatsächlichen Versuch werden unklare Aufträge
beendet, um nach Ablauf des Provider-Idempotenzfensters keine Duplikate zu erzeugen.
`sent` bedeutet vom Versanddienst angenommen, nicht sicher im Postfach zugestellt.
Resend verwaltet Suppressions für unzustellbare Adressen; Zustellereignisse und
Beschwerden sind im Resend-Dashboard sichtbar. Ein lokaler Bounce-Webhook ist
nicht erforderlich für das Abbestellen und wird derzeit nicht verwendet.

Die Anwendung fügt keine Öffnungspixel oder Klicktracker hinzu. Konto- und
Bestätigungsseiten sind von Besucherstatistik und öffentlichem Caching ausgeschlossen.
Sitzungen sind HttpOnly/SameSite-Lax, bei HTTPS zusätzlich Secure. Zugangs- und
Sitzungstoken werden gehasht gespeichert. Unbestätigte Konten verfallen nach sieben
Tagen; verbrauchte/abgelaufene Zugangsdaten, Begrenzungsdaten und alte Versandaufträge
werden regelmäßig bereinigt. Bestätigte Konten bleiben bis zur Kontolöschung erhalten.
Daten beim Versanddienst und Backups haben eigene Fristen. Die Versandregion ist
keine Zusicherung, dass sämtliche Anbieterdaten ausschließlich in der EU bleiben.

## Prüfung

`npm test`, `python3 -m unittest discover -s tests -p '*_test.py'`,
`node node_modules/typescript/bin/tsc --noEmit` und `npm run build`.
Die Tests prüfen Auswahl über den Anmeldelink, ausdrückliche Einwilligung, Pausieren,
Abmeldung, sichere Formulare, Versionsbenachrichtigungen, Wiederholungen, Änderung
nach dem Versandversuch, parallele Dispatcher, Tagesbudget und HTML-Escaping.
Vor der Aktivierung werden Domainfreigabe und echter E-Mail-Versand geprüft.
