"""Bounded, public memo overview from the saved evaluation; no provider calls."""
import math
from urllib.parse import urlparse

BANDS = ('Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell')


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return value if math.isfinite(value) else None


def text(value, maximum=3000):
    if isinstance(value, dict):
        value = value.get('de', '')
    return str(value or '')[:maximum]


def source_url(evidence):
    for key in ('source_url', 'url'):
        url = evidence.get(key)
        if isinstance(url, str) and len(url) <= 2000 and urlparse(url).scheme in {'https', 'http'} and urlparse(url).hostname:
            return {'source_url': url}
    for item in evidence.values():
        if isinstance(item, dict):
            found = source_url(item)
            if found:
                return found
    return {}


def money(value, currency):
    scale, suffix = (1e9, ' Mrd.') if abs(value) >= 1e9 else (1e6, ' Mio.') if abs(value) >= 1e6 else (1, '')
    formatted = f'{value / scale:,.2f}'.replace(',', '_').replace('.', ',').replace('_', '.')
    return formatted + suffix + ' ' + currency


def build_memo_overview(run):
    figures = run.get('figures') or {}
    evidence = run.get('figure_evidence') or {}
    plain = run.get('plain') or {}
    prose = run.get('plain_text') or {}
    currency = text(run.get('fundamentals_currency') or 'Währung nicht dokumentiert', 40)
    created = text(run.get('created_at'), 30)[:10]
    questions = []
    for q in plain.get('questions') or []:
        group = q.get('group')
        if group not in ('value', 'quality', 'growth', 'momentum') or any(p['group'] == group for p in questions):
            continue
        questions.append({'group': group, 'question': text(q.get('question'), 200),
                          'answer': text(q.get('answer'), 1000), 'detail': text(q.get('detail'), 2500),
                          'note': text(prose.get(group + '_note')),
                          'signal': q.get('light') if q.get('light') in ('green', 'amber', 'red') else 'unknown'})
    money_metrics = []
    for key, label, explanation in (
        ('revenue_ttm', 'Umsatz · letzte zwölf Monate', 'Erlöse aus dem Verkauf von Produkten und Leistungen; kein Gewinn und kein Cashflow.'),
        ('operating_cash_flow', 'Geld aus dem laufenden Geschäft', 'Tatsächlicher Geldfluss aus dem operativen Geschäft; kann durch Zahlungszeitpunkte beeinflusst sein.'),
        ('free_cash_flow', 'Nach Investitionen übrig', 'Freier Cashflow nach Investitionen. Ein negativer Wert bedeutet einen Mittelabfluss.'),
    ):
        value = number(figures.get(key))
        if value is None:
            continue
        ev = evidence.get(key) or {}
        money_metrics.append({'key': key, 'label': label, 'value': money(value, currency), 'explanation': explanation,
                              'period': text(ev.get('period_end') or 'Zeitraum siehe Quelle; Auswertung ' + created, 150),
                              'source': text(ev.get('source') or 'Gespeicherte Auswertung; Detailherkunft nicht dokumentiert', 500), **source_url(ev)})
    # Use the stored annual breakdown, never derive costs from revenue minus cashflow.
    pl = run.get('pl_breakdown') or {}
    costs = []
    for key, label, explanation in (
        ('cost_of_revenue', 'Herstellung & Leistungserbringung', 'Direkte Kosten der verkauften Produkte und erbrachten Leistungen.'),
        ('research_and_development', 'Forschung & Entwicklung', 'Aufwand für die Entwicklung von Produkten und Technologien; kann Teil der Betriebskosten sein.'),
        ('selling_general_admin', 'Vertrieb & Verwaltung', 'Aufwand für Vertrieb und Verwaltung; kann Teil der Betriebskosten sein.'),
        ('operating_expense', 'Betriebskosten insgesamt', 'Zusammengefasste operative Aufwendungen. Enthaltene Einzelposten nicht zusätzlich addieren.'),
        ('operating_income', 'Operatives Ergebnis', 'Ergebnis des operativen Geschäfts; ein negativer Betrag ist ein operativer Verlust.'),
        ('net_income', 'Gewinn oder Verlust nach Steuern', 'Das bilanzielle Nettoergebnis; es unterscheidet sich vom tatsächlichen Geldfluss.'),
    ):
        value = number(pl.get(key))
        if value is None:
            continue
        costs.append({'key': key, 'label': label, 'value': money(value, currency), 'explanation': explanation,
                      'period': 'Geschäftsjahr ' + str(pl['year']) if pl.get('year') else 'Berichtszeitraum nicht dokumentiert',
                      'source': 'Yahoo-Finanzbericht · gespeicherte jährliche Aufschlüsselung'})
    score = number(figures.get('piotroski_f_score'))
    if score is not None and (not 0 <= score <= 9 or score != int(score)):
        score = None
    ev = evidence.get('piotroski_f_score') or {}
    street = plain.get('street') or {}
    analysts = number(street.get('n_analysts'))
    reliability = [text(r.get('text')) for r in plain.get('reliability') or [] if isinstance(r, dict)]
    if prose.get('reliability_note'):
        reliability.append(text(prose['reliability_note']))
    return {'questions': questions, 'money_story': text(prose.get('money_story'), 5000),
            'money_metrics': money_metrics, 'costs': costs,
            'piotroski': {'score': int(score) if score is not None else None,
                         'period': text(ev.get('period_end') or 'Jahresvergleich laut gespeicherter Auswertung', 150),
                         'source': text(ev.get('source') or 'Berechnung aus gespeicherten Jahresabschlüssen', 500), **source_url(ev)},
            'street': {'verdict': street['street'], 'analysts': int(analysts) if analysts is not None and analysts >= 0 and analysts == int(analysts) else None,
                       'meaning': text(street.get('meaning'))} if street.get('street') in BANDS else None,
            'reliability': [r for r in reliability if r][:12],
            'dilution': text((plain.get('money') or {}).get('dilution', {}).get('text') if (plain.get('money') or {}).get('dilution') else '', 2000)}
