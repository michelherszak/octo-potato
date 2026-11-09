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

## Yahoo: technische Veröffentlichungspolitik

Auf ausdrücklichen Nutzerwunsch vom 9. November 2026 blockiert TechThese keine
Veröffentlichungen mehr wegen `finance.yahoo.com`, Yahoo Finance oder `yfinance`.
Bei älteren Auswertungen genügt die dokumentierte Yahoo-Herkunft der Kennzahlen auch
ohne Quellenadresse. Die Herkunft bleibt im gespeicherten Paket und in früheren
Versionen erhalten; öffentliche Quellenfelder und Links zu Yahoo werden ausgeblendet.
Andere Quellen bleiben sichtbar. Zahlen werden nicht als Daten eines anderen Anbieters
ausgegeben. Diese Einstellung ersetzt die frühere pauschale Yahoo-Sperre.

## Weitere Quellen mit Einschränkungen

| Quelle | Grund |
| --- | --- |
| Alpha Vantage, Finnhub, Twelve Data, Financial Modeling Prep | die kostenlosen Stufen erlauben keine öffentliche Anzeige; externe Anzeige beginnt bei kostenpflichtigen Stufen |
| NewsAPI.org | der Gratis-Plan ist auf Entwicklung und Tests beschränkt; Produktivbetrieb ist ausdrücklich untersagt |
| FRED (St. Louis Fed) | der Public-Domain-Status gilt für persönliche, Bildungs- und nicht-kommerzielle Zwecke; die API-Bedingungen untersagen Speichern, Zwischenspeichern und Weitergabe an Dritte; die Urheberrechte der einzelnen Reihen bleiben bei deren Eigentümern |

FRED ist der am leichtesten zu übersehende Fall: die Quelle wirkt wie offene
Behördendaten, ist für eine Website, die Zahlen speichert und veröffentlicht, aber
nicht nutzbar.

Die konkrete Zuordnung der Memo-Kennzahlen auf EDGAR-Tags steht in
[`edgar-kennzahlen.md`](edgar-kennzahlen.md).

## Medienberichte als Recherchehinweise

Die GDELT DOC 2.0 API wird in Evaluating Stocks zur Suche nach Berichten über Unternehmen
verwendet. GDELT erlaubt die Nutzung und Weitergabe seiner Datensätze einschließlich
kommerzieller Zwecke, verlangt dabei die Nennung des GDELT Project und einen Link.
Grundlage: [GDELT Terms of Use](https://www.gdeltproject.org/about.html#termsofuse),
geprüft am 9. November 2026. Die API ist in der
[offiziellen DOC-2.0-Dokumentation](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)
beschrieben. Diese Angaben beziehen sich auf das GDELT Project, nicht auf GDELT Cloud.

Die Rechte an verlinkten Medienartikeln sind davon getrennt. Für TechThese werden daher
eigene Überschriften und Zusammenfassungen mit Link zum Originalartikel freigegeben;
fremde Originaltitel bleiben im lokalen Redaktions-Panel, Volltexte werden nicht abgerufen.
Die Unternehmensseite nennt GDELT bei Medienberichten und verlinkt das Projekt.
Die übrige Sperrliste bleibt auch für Nachrichten bestehen; Yahoo ist wie oben beschrieben zugelassen.

## Automatische Nachrichtenliste auf Unternehmensseiten

Auf ausdrücklichen Nutzerwunsch werden auf `/unternehmen/<TICKER>` automatisch die fünf
neuesten verfügbaren Meldungen angezeigt, bei Bedarf auch ältere als 30 Tage. Dafür
liest TechThese RSS-/Atom-Schlagzeilen, ohne Artikelvolltexte oder automatisch erzeugte
Zusammenfassungen zu übernehmen. Arqit nutzt seinen direkten IR-Feed; der tickerbezogene
Nachrichtenfeed ergänzt weitere Treffer und deckt die übrigen Unternehmen ab.
Automatische Schlagzeilen werden von redaktionell bearbeiteten Texten unterschieden;
Unternehmensmeldungen sind als Unternehmensangaben gekennzeichnet.

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
