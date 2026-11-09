# Kennzahlen aus SEC EDGAR statt aus yfinance

Vorlage für die Umstellung der Datenbeschaffung in Evaluating Stocks. Hintergrund und
Rechtslage stehen in [`quellen-lizenzen.md`](quellen-lizenzen.md).

Alle Angaben auf dieser Seite sind an den tatsächlichen Daten von Marvell (MRVL) und
Arqit (ARQQ) geprüft, nicht aus der Dokumentation abgeschrieben.

## Zugriff

```
https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json
```

Die CIK ist zehnstellig mit führenden Nullen. Die Zuordnung Ticker → CIK liefert
`https://www.sec.gov/files/company_tickers.json`.

Pflichten laut SEC: höchstens **10 Anfragen je Sekunde** und ein eigener `User-Agent`
mit Kontaktadresse, zum Beispiel `TechThese techthese-dev kontakt@example.com`.
Anfragen ohne `User-Agent` werden abgewiesen.

## Zwei Taxonomien, nicht eine

Das ist der Punkt, der die Umstellung am ehesten zum Scheitern bringt.

| Emittent | Taxonomie | Beispiel aus dem Katalog |
| --- | --- | --- |
| US-Inlandsemittent, 10-K | `us-gaap` | MRVL mit 378 Tags |
| Ausländischer Emittent, 20-F nach IFRS | `ifrs-full` | **ARQQ mit 215 Tags und null us-gaap-Tags** |

Wer nur `us-gaap` abfragt, erhält für Arqit ein leeres Ergebnis — nicht etwa einen
Fehler. Die Taxonomie muss also pro Unternehmen aus `facts` gelesen werden.

## Zuordnung der Memo-Felder

Innerhalb einer Taxonomie unterscheiden sich die Tags je Unternehmen. Deshalb sind
Ketten angegeben: den ersten vorhandenen Treffer verwenden.

| Memo-Feld | `us-gaap` | `ifrs-full` |
| --- | --- | --- |
| Umsatz | `RevenueFromContractWithCustomerExcludingAssessedTax` → `Revenues` | `Revenue` → `RevenueFromContractsWithCustomers` |
| Herstellungskosten | `CostOfGoodsAndServicesSold` → `CostOfRevenue` | `CostOfSales` |
| Forschung & Entwicklung | `ResearchAndDevelopmentExpense` | `ResearchAndDevelopmentExpense` |
| Vertrieb & Verwaltung | `SellingGeneralAndAdministrativeExpense` → `GeneralAndAdministrativeExpense` | `AdministrativeExpense` |
| Operatives Ergebnis | `OperatingIncomeLoss` | `ProfitLossFromOperatingActivities` |
| Ergebnis nach Steuern | `NetIncomeLoss` | `ProfitLoss` |
| Operativer Cashflow | `NetCashProvidedByUsedInOperatingActivities` | `CashFlowsFromUsedInOperatingActivities` |
| Investitionen (für freien Cashflow) | `PaymentsToAcquirePropertyPlantAndEquipment` | `PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities` |
| Bilanzsumme | `Assets` | `Assets` |
| Kurzfristige Posten | `AssetsCurrent`, `LiabilitiesCurrent` | `CurrentAssets`, `CurrentLiabilities` |
| Aktienzahl (Verwässerung) | `dei:EntityCommonStockSharesOutstanding` | `dei:EntityCommonStockSharesOutstanding` |

Freier Cashflow = operativer Cashflow − Investitionen in Sachanlagen.

Nicht jeder Posten existiert überall: MRVL meldet weder `Revenues` noch
`OperatingExpenses`, ARQQ weder `CostOfSales` noch `GrossProfit`. Fehlende Werte
gehören als fehlend ausgewiesen und dürfen nicht durch Null ersetzt werden.

## Piotroski F-Score

Alle neun Kriterien stammen aus Bilanz, Gewinn- und Verlustrechnung sowie
Kapitalflussrechnung und sind damit vollständig aus EDGAR berechenbar: Gesamtkapital­rendite,
operativer Cashflow, Veränderung der Rendite, Verhältnis von Cashflow zum Gewinn,
Veränderung der langfristigen Verschuldung, Veränderung der kurzfristigen Kennzahl,
Aktienzahl, Rohertragsmarge und Kapitalumschlag. Es wird keine externe Quelle benötigt.

## Geschäftsjahre

Das Geschäftsjahr weicht oft vom Kalenderjahr ab. Bei MRVL läuft es vom **2. Februar 2025
bis 31. Januar 2026**; die SEC ordnet diesen Zeitraum dem Rahmen `CY2025` zu, während das
Unternehmen selbst von Geschäftsjahr 2026 spricht. Jeder veröffentlichte Wert braucht
deshalb seinen tatsächlichen Zeitraum im Feld `period`, nicht nur eine Jahreszahl.

Ebenso zu beachten: eine Zahl über die letzten zwölf Monate ist etwas anderes als der
Geschäftsjahreswert. MRVL weist für das Geschäftsjahr bis Januar 2026 einen Umsatz von
8,19 Mrd. USD aus; ein rollierender Zwölfmonatswert zu einem späteren Stichtag liegt
darüber. Beides ist richtig, aber nur mit angegebenem Zeitraum nachvollziehbar.

Nachträgliche Korrekturen erscheinen als mehrere Einträge für denselben Zeitraum. Es gilt
der Wert aus der jüngsten Einreichung.

## Was EDGAR nicht liefert

| Angabe | Lage |
| --- | --- |
| Analystenkonsens (`street`) | keine frei veröffentlichbare Quelle vorhanden; das Feld ist im Schema `nullable` und darf entfallen |
| Kurs, Marktkapitalisierung, Bewertungsmultiplikatoren, Beta, Dividendenrendite | kein kostenloses Angebot mit Weitergaberecht; derzeit zeigen die Beiträge keine Kurse |

## Unternehmen ohne SEC-Registrierung

EDGAR deckt nur SEC-registrierte Emittenten ab. Für andere, etwa Quantum eMotion in
Kanada, gelten die dortigen Pflichtveröffentlichungen (SEDAR+) oder die
Investor-Relations-Seite des Unternehmens, die ohnehin schon als Katalogquelle dient.

## Angabe im Veröffentlichungspaket

- `editorial_review.rights_basis`: `SEC EDGAR` beziehungsweise `IR-Seite des Unternehmens`
- `source` je Kennzahl: die Einreichung, etwa `SEC EDGAR, 10-K Geschäftsjahr 2026`
- `source_url`: Link auf die Einreichung in EDGAR
- `period`: der tatsächliche Zeitraum

Der Veröffentlichungsvertrag weist Pakete mit gesperrten Quellen seit `f0b112b` mit
Status 422 zurück; die Meldung nennt die beanstandete Fundstelle.

## Meldungen der letzten 30 Tage

Dieselbe Quelle liefert die Meldungen auf den Unternehmensseiten, über
`https://data.sec.gov/submissions/CIK##########.json`. Die Zuordnung steht in
`integrations/evaluating-stocks/website_news_core.py`:

| Einreichung | Kategorie |
| --- | --- |
| 8-K Item 2.02 | Quartalszahlen |
| 8-K Item 1.01, 1.02 | Wesentliche Verträge |
| 8-K Item 2.01, Form 425 | Übernahme & Fusion |
| 8-K Item 2.05 | Restrukturierung |
| 8-K Item 5.02 | Vorstand & Management |
| 8-K Item 5.07 | Hauptversammlung |
| 8-K Item 7.01, Form 6-K | Pressemitteilung |
| 8-K Item 8.01 | Sonstige Meldung |
| Form 4, Form 144 | Insidergeschäfte (vorausgewählt abgewählt) |
| Schedule 13D, 13G | Großaktionäre |

Hat ein 8-K mehrere Items, gilt die Reihenfolge der Tabelle. Ein 8-K nur mit Item 9.01
(Anlagen) und Formulare wie S-8 oder 10-Q sind keine Meldung. Änderungsmeldungen (`/A`)
zählen zur Kategorie des Originals. Gleiche Kategorie am selben Tag wird zusammengefasst:
am 2. November 2026 reichte Marvell zehn Form 425 zu einer Übernahme ein, daraus wird eine
Meldung.

Die eigentliche Nachricht steht oft in der Anlage, nicht im Formulartyp. Das 8-K von
Marvell vom 2. November 2026 trägt Item 2.02 (Zahlen); die angehängte Pressemitteilung ist
überschrieben mit „MARVELL AND LUMENTUM TO COMBINE, CREATING A CATEGORY LEADER IN AI
CONNECTIVITY". Deshalb zeigt der Entwurf diesen Titel als Hinweis für die Redaktion.

Nicht bei der SEC registrierte Unternehmen haben hier keine Daten. Und manche Firmen melden
über die SEC nur wenig: Arqit hatte zwischen dem 9. Oktober und 9. November 2026 dort
ausschließlich Insidergeschäfte. Für solche Fälle bleibt die Investor-Relations-Seite die Quelle.
