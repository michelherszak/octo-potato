# Zulässige Quellen für veröffentlichte Zahlen

TechThese veröffentlicht Kennzahlen öffentlich im Netz. Eine Quelle ist deshalb nur
dann geeignet, wenn sie **kostenlos zugänglich** ist **und** die **Weiterveröffentlichung**
der Daten erlaubt. Kostenlos allein genügt nicht: die meisten Gratis-Stufen kommerzieller
Finanz-APIs erlauben ausdrücklich keine öffentliche Anzeige.

Diese Seite ordnet Quellen ein. Sie ist keine Rechtsberatung; vor einer kommerziellen
Veröffentlichung gehört die Prüfung in fachkundige Hände.

## Geeignet

| Quelle | Grundlage | Auflagen |
| --- | --- | --- |
| SEC EDGAR, `data.sec.gov` | Behördlich erstellte Inhalte und öffentliche Einreichungen sind frei zugänglich und weiterverwendbar | höchstens 10 Anfragen je Sekunde; eigener `User-Agent` mit Kontaktadresse; die quartalsweise 13(f)-Wertpapierliste ist davon ausgenommen |
| Investor-Relations-Seiten der Unternehmen | Primärquelle; Zahlen und Fakten sind nicht urheberrechtlich geschützt | Dokumente, Grafiken und Logos nicht übernehmen; Zahlen zitieren und das Originaldokument verlinken |
| Eurostat | Weiterverwendung zu kommerziellen und nicht-kommerziellen Zwecken erlaubt, sofern die Quelle genannt wird (Beschluss 2011/833/EU, CC BY 4.0) | Quellenangabe verpflichtend; ausgenommen sind Daten Dritter sowie Logos und Marken |
| Dokumente der EU-Kommission | CC BY 4.0 nach Beschluss 2011/833/EU | Namensnennung; Änderungen kenntlich machen |
| EZB-Statistiken | freier Zugang und freie Weiterverwendung | gilt nicht für in den Reihen enthaltene Daten Dritter; Referenzkurse ausdrücklich nur zu Informationszwecken |

## Nicht geeignet

| Quelle | Grund |
| --- | --- |
| Yahoo Finance, auch über `yfinance` | Weiterveröffentlichung nicht gestattet; der Zugriff erfolgt über eine nicht dokumentierte Schnittstelle |
| Alpha Vantage, Finnhub, Twelve Data, Financial Modeling Prep | die kostenlosen Stufen erlauben keine öffentliche Anzeige; externe Anzeige beginnt bei kostenpflichtigen Stufen |
| FRED (St. Louis Fed) | der Public-Domain-Status gilt für persönliche, Bildungs- und nicht-kommerzielle Zwecke; die API-Bedingungen untersagen Speichern, Zwischenspeichern und Weitergabe an Dritte; die Urheberrechte der einzelnen Reihen bleiben bei deren Eigentümern |

FRED ist der am leichtesten zu übersehende Fall: die Quelle wirkt wie offene
Behördendaten, ist für eine Website, die Zahlen speichert und veröffentlicht, aber
nicht nutzbar.

## Im Veröffentlichungsvertrag

Das Feld `editorial_review.rights_basis` benennt die Rechtegrundlage. Es sollte genau
eine der obigen Kategorien nennen, etwa `SEC EDGAR`, `IR-Seite des Unternehmens` oder
`Eurostat mit Quellenangabe` — nicht nur Freitext.

Jede Kennzahl trägt zusätzlich ein eigenes `source`-Feld. Auch dort gehört die
tatsächlich genutzte Quelle hinein, nicht der Dienst, über den sie abgerufen wurde.

## Prüfung der Referenzen

- https://www.sec.gov/os/webmaster-faq#developers
- https://ec.europa.eu/eurostat/help/copyright-notice
- https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html
- https://fred.stlouisfed.org/docs/api/terms_of_use.html
- https://www.stlouisfed.org/publications/page-one-economics/2021/10/15/ethical-use-of-data-with-fred

Die Angaben zu SEC und Eurostat sind auf deren eigenen Seiten geprüft. Die Einordnung
der kommerziellen Anbieter stammt aus Vergleichsübersichten und ist vor einer Nutzung
in den jeweiligen Originalbedingungen gegenzulesen.
