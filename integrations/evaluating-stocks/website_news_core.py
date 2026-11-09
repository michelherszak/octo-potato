"""Meldungen aus SEC-EDGAR-Einreichungen für den TechThese-Digest. Ohne Netzwerk und ohne App-Abhängigkeiten."""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.parse import quote, urlparse

CATEGORIES = {
    'quartalszahlen': 'Quartalszahlen', 'vertraege': 'Wesentliche Verträge', 'uebernahme': 'Übernahme & Fusion',
    'restrukturierung': 'Restrukturierung', 'management': 'Vorstand & Management', 'hauptversammlung': 'Hauptversammlung',
    'insider': 'Insidergeschäfte', 'grossaktionaere': 'Großaktionäre', 'pressemitteilung': 'Pressemitteilung',
    'sonstiges': 'Sonstige Meldung',
}

# Reihenfolge = Vorrang. Ein 8-K mit Item 2.02 und 7.01 ist eine Zahlenmeldung.
ITEM_RULES = (
    ('2.02', 'quartalszahlen'), ('2.01', 'uebernahme'), ('1.01', 'vertraege'), ('1.02', 'vertraege'),
    ('2.05', 'restrukturierung'), ('5.02', 'management'), ('5.07', 'hauptversammlung'),
    ('7.01', 'pressemitteilung'), ('8.01', 'sonstiges'),
)
FORM_RULES = {
    '425': 'uebernahme', '6-K': 'pressemitteilung', '4': 'insider', '144': 'insider',
    'SC 13D': 'grossaktionaere', 'SC 13G': 'grossaktionaere',
    'SCHEDULE 13D': 'grossaktionaere', 'SCHEDULE 13G': 'grossaktionaere',
}
HEADLINES = {
    'quartalszahlen': '{name} legt Geschäftszahlen vor', 'vertraege': '{name} meldet einen wesentlichen Vertrag',
    'uebernahme': '{name} veröffentlicht Unterlagen zu einer Übernahme oder Fusion',
    'restrukturierung': '{name} kündigt Restrukturierungskosten an', 'management': '{name} meldet Veränderungen im Management',
    'hauptversammlung': 'Ergebnisse der Hauptversammlung von {name}', 'insider': 'Insidergeschäfte bei {name}',
    'grossaktionaere': 'Veränderung bei Großaktionären von {name}', 'pressemitteilung': '{name} veröffentlicht eine Meldung',
    'sonstiges': '{name} meldet ein sonstiges Ereignis',
}
MAX_ITEMS = 40


def base_form(form: str) -> str:
    """Änderungsmeldungen (/A) gehören in dieselbe Kategorie wie das Original."""
    return str(form or '').strip().upper().removesuffix('/A')


def classify(form: str, items: str = '') -> str | None:
    """Kategorie einer Einreichung oder None, wenn sie keine Meldung für Leser ist."""
    kind = base_form(form)
    if kind == '8-K':
        codes = {code.strip() for code in str(items or '').split(',') if code.strip()}
        for code, category in ITEM_RULES:
            if code in codes:
                return category
        return 'sonstiges' if codes - {'9.01'} else None
    return FORM_RULES.get(kind)


def filing_url(cik: int | str, accession: str, document: str) -> str:
    folder = str(accession).replace('-', '')
    return f'https://www.sec.gov/Archives/edgar/data/{int(cik)}/{folder}/{quote(str(document))}'


def source_label(form: str, items: str) -> str:
    codes = [code.strip() for code in str(items or '').split(',') if code.strip() and code.strip() != '9.01']
    return f"SEC EDGAR, {form}" + (f" Item {', '.join(codes)}" if codes else '')


def collect(submissions: dict, name: str, since: date, until: date | None = None) -> list[dict]:
    """Entwürfe aus /submissions. Gleiche Kategorie am selben Tag wird zusammengefasst,
    sonst würden zehn Form-425-Einreichungen zu einer Übernahme zehn Meldungen."""
    recent = ((submissions or {}).get('filings') or {}).get('recent') or {}
    cik = submissions.get('cik')
    forms = recent.get('form') or []
    until = until or date.max
    groups: dict[tuple[str, str], dict] = {}
    for index, form in enumerate(forms):
        day = str((recent.get('filingDate') or [''])[index] if index < len(recent.get('filingDate') or []) else '')
        try:
            filed = date.fromisoformat(day)
        except ValueError:
            continue
        if not since <= filed <= until:
            continue
        items = (recent.get('items') or [''] * len(forms))[index] or ''
        category = classify(form, items)
        if not category:
            continue
        accession = (recent.get('accessionNumber') or [''])[index]
        document = (recent.get('primaryDocument') or [''])[index]
        if not (cik and accession and document):
            continue
        key = (day, category)
        if key in groups:
            groups[key]['count'] += 1
            continue
        groups[key] = {
            'date': day, 'category': category, 'form': base_form(form), 'count': 1,
            'headline': HEADLINES[category].format(name=name or 'Das Unternehmen'),
            'summary': '', 'source': source_label(base_form(form), items),
            'source_url': filing_url(cik, accession, document), 'include': category != 'insider',
        }
    drafts = sorted(groups.values(), key=lambda entry: (entry['date'], entry['category']), reverse=True)
    for entry in drafts:
        if entry['count'] > 1:
            entry['source'] += f' ({entry["count"]} Einreichungen)'
    return drafts[:MAX_ITEMS]


# Nicht \b: echte Namen wie ex99-1_irgendwas oder ex99-1img1.jpg folgen ohne Wortgrenze.
EXHIBIT = re.compile(r'ex-?99[-_.]?0?1(?![0-9])', re.IGNORECASE)
GENERIC_TITLES = {'', 'document', 'ex-99.1', 'exhibit 99.1', 'press release', '6-k', '8-k'}


def pick_exhibit(names: list[str]) -> str | None:
    """Die Pressemitteilung hängt bei 8-K und 6-K meist als Anlage 99.1 an."""
    for name in names:
        if EXHIBIT.search(str(name)) and str(name).lower().endswith(('.htm', '.html', '.txt')):
            return name
    return None


class _Headings(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack: list[str] = []
        self.found: dict[str, list[str]] = {'title': [], 'b': [], 'strong': []}

    def handle_starttag(self, tag, attrs):
        self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.stack:
            while self.stack and self.stack.pop() != tag:
                pass

    def handle_data(self, data):
        for tag in ('title', 'b', 'strong'):
            if tag in self.stack and data.strip():
                self.found[tag].append(' '.join(data.split()))


def exhibit_title(html: str) -> str:
    """Titel der Pressemitteilung als Hinweis für die Redaktion, nicht als fertige Überschrift."""
    parser = _Headings()
    try:
        parser.feed(str(html or '')[:400_000])
    except Exception:
        return ''
    candidates = [' '.join(parser.found['title'])] + parser.found['b'] + parser.found['strong']
    for candidate in candidates:
        cleaned = candidate.strip(' :–-')
        if cleaned.lower() not in GENERIC_TITLES and 12 <= len(cleaned) <= 240 and not cleaned.lower().startswith('exhibit'):
            return cleaned[:240]
    return ''


def window(today: date | None = None, days: int = 30) -> tuple[date, date]:
    today = today or datetime.now(timezone.utc).date()
    return today - timedelta(days=days), today


def build_packet(publication_id: str, ticker: str, entries: list[dict], review: dict) -> dict:
    """Prüft die von der Redaktion freigegebenen Einträge und baut das Paket für /api/news."""
    items = []
    for number, entry in enumerate(entries, start=1):
        if not entry.get('include'):
            continue
        headline = str(entry.get('headline') or '').strip()
        summary = str(entry.get('summary') or '').strip()
        url = str(entry.get('source_url') or '')
        if not 8 <= len(headline) <= 180:
            raise ValueError(f'Meldung {number}: Die Überschrift muss 8 bis 180 Zeichen lang sein.')
        if len(summary) > 600:
            raise ValueError(f'Meldung {number}: Die Zusammenfassung darf höchstens 600 Zeichen haben.')
        if entry.get('category') not in CATEGORIES:
            raise ValueError(f'Meldung {number}: Unbekannte Kategorie.')
        if urlparse(url).scheme != 'https':
            raise ValueError(f'Meldung {number}: Die Quelle muss über HTTPS erreichbar sein.')
        date.fromisoformat(str(entry.get('date')))
        items.append({'date': str(entry['date']), 'category': entry['category'], 'headline': headline,
                      'summary': summary, 'source': str(entry.get('source') or 'SEC EDGAR')[:200],
                      'source_url': url, 'form': str(entry.get('form') or '')[:20]})
    if len(items) > MAX_ITEMS:
        raise ValueError(f'Höchstens {MAX_ITEMS} Meldungen je Unternehmen.')
    return {'publication_id': publication_id, 'ticker': str(ticker).upper(), 'editorial_review': review, 'items': items}
