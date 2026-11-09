"""SEC-Einreichungen und GDELT-Suchtreffer für den TechThese-Digest. Ohne Netzwerk und App-Abhängigkeiten."""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.parse import quote, urlencode, urlparse

CATEGORIES = {
    'quartalszahlen': 'Quartalszahlen', 'vertraege': 'Wesentliche Verträge', 'uebernahme': 'Übernahme & Fusion',
    'restrukturierung': 'Restrukturierung', 'management': 'Vorstand & Management', 'hauptversammlung': 'Hauptversammlung',
    'insider': 'Insidergeschäfte', 'grossaktionaere': 'Großaktionäre', 'pressemitteilung': 'Pressemitteilung',
    'sonstiges': 'Sonstige Meldung', 'medienbericht': 'Medienbericht',
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


# --- Medienberichte über GDELT ---------------------------------------------------------
# GDELT-Datensätze dürfen mit Quellenangabe weiterverwendet werden. Die verlinkten Artikel
# bleiben geschützt: ihr Titel ist nur ein Hinweis für die Redaktion, veröffentlicht werden
# eigene Überschriften und Zusammenfassungen mit Link.
LEGAL_SUFFIX = re.compile(r'[\s,]+(inc|corp|corporation|co|ltd|limited|plc|ag|se|sa|nv|holdings?|group|n\.v|usa|us)\.?$', re.IGNORECASE)
# Automatisch erzeugte Kursmeldungs-Netzwerke ohne eigene Recherche.
CONTENT_FARMS = {
    'tickerreport.com', 'themarketsdaily.com', 'dailypolitical.com', 'thelincolnianonline.com', 'thecerbatgem.com',
    'theenterpriseleader.com', 'wkrb13.com', 'zolmax.com', 'thestockobserver.com', 'americanbankingnews.com',
    'com-unik.info', 'modernreaders.com', 'etfdailynews.com', 'sportsperspectives.com', 'theolympiareport.com',
    'defenseworld.net', 'dispatchtribunal.com', 'mayfieldrecorder.com', 'transcriptdaily.com', 'slatersentinel.com',
    'marketbeat.com', 'baseballnewssource.com',
}
# Spiegel der Sperrliste der Website (lib/source-policy.ts): solche Links lehnt sie ohnehin ab.
BLOCKED_HOSTS = ('newsapi', 'finnhub', 'alphavantage', 'twelvedata', 'financialmodelingprep', 'stlouisfed')
# Bevorzugte Quellen, wenn mehrere über dasselbe Ereignis berichten.
PREFERRED = (
    'reuters.com', 'apnews.com', 'bloomberg.com', 'ft.com', 'wsj.com', 'cnbc.com', 'marketwatch.com', 'barrons.com',
    'handelsblatt.com', 'faz.net', 'heise.de', 'thequantuminsider.com', 'datacenterdynamics.com', 'spacenews.com',
    'fiercebiotech.com', 'endpts.com', 'utilitydive.com', 'eetimes.com', 'semiengineering.com', 'techcrunch.com',
    'theverge.com', 'arstechnica.com', 'investors.com', 'benzinga.com', 'fool.com',
)
# Erste Namensteile, die allein zu allgemein sind, um einen Treffer zu belegen.
GENERIC_FIRST = {'applied', 'digital', 'rocket', 'planet', 'twist', 'quantum', 'crispr', 'fluence', 'onto', 'credo', 'rockwell'}
# Kürzel, die zugleich gewöhnliche Wörter sind, taugen nicht als Suchbegriff.
WORD_TICKERS = {'ONTO', 'OKTA', 'PODD', 'TWST'}
LANGUAGES = {'English', 'German'}
STOPWORDS = {'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'after', 'stock', 'shares', 'share',
             'nasdaq', 'nyse', 'what', 'why', 'how', 'will', 'says', 'said', 'news', 'der', 'die', 'das', 'und', 'mit'}


def company_core(name: str) -> str:
    """\"Marvell Technology, Inc.\" → \"Marvell Technology\"."""
    core = str(name or '').strip()
    while True:
        shorter = LEGAL_SUFFIX.sub('', core).strip(' ,.')
        if shorter == core:
            return core
        core = shorter


def _short_name(name: str) -> str:
    """Erster Namensteil, wenn er für sich eindeutig genug ist (\"Arqit\", nicht \"Applied\")."""
    parts = company_core(name).split()
    first = parts[0] if parts else ''
    return first if len(parts) > 1 and len(first) >= 4 and first.lower() not in GENERIC_FIRST else ''


def _search_ticker(ticker: str) -> str:
    """Kürzel wie BWXT oder ARQQ stehen oft allein in Überschriften; kurze wie PL nicht verwendbar."""
    ticker = str(ticker or '').strip().upper()
    return ticker if len(ticker) >= 4 and ticker.isalpha() and ticker not in WORD_TICKERS else ''


def gdelt_url(name: str, days: int = 30, records: int = 75, ticker: str = '') -> str:
    # Berichte nennen meist den Kurznamen („Arqit“ statt „Arqit Quantum“) oder das Kürzel.
    core = company_core(name)
    terms = [f'"{core}"'] + [term for term in (_short_name(name), _search_ticker(ticker)) if term]
    query = '(' + ' OR '.join(terms) + ')' if len(terms) > 1 else terms[0]
    return 'https://api.gdeltproject.org/api/v2/doc/doc?' + urlencode(
        {'query': query, 'mode': 'artlist', 'format': 'json', 'timespan': f'{days}d', 'maxrecords': records, 'sort': 'datedesc'})


def clean_title(title: str) -> str:
    """GDELT trennt Satzzeichen ab (\"Dow Jones , S & P 500\")."""
    text = ' '.join(str(title or '').split())
    text = re.sub(r'\s+([,.:;!?%)\]])', r'\1', text)
    text = re.sub(r'([(\[$])\s+', r'\1', text)
    text = re.sub(r'\s+([\'’]s\b)', r'\1', text)
    # Tausendertrennzeichen wieder zusammenfügen: "$1, 132" → "$1,132".
    text = re.sub(r'(\d),\s(\d{3})\b', r'\1,\2', text)
    # Dezimalzahlen ebenso: "$16. 3 Million" → "$16.3 Million".
    text = re.sub(r'(\d)\.\s(\d)', r'\1.\2', text)
    return text


def _host(url: str) -> str:
    try:
        host = (urlparse(url).hostname or '').lower()
    except ValueError:
        return ''
    return host[4:] if host.startswith('www.') else host


def _in_domains(host: str, domains) -> bool:
    return any(host == domain or host.endswith('.' + domain) for domain in domains)


def mentions(title: str, name: str, ticker: str = '') -> bool:
    """Ein Bericht muss das Unternehmen im Titel tragen; Randerwähnungen im Text zählen nicht."""
    lowered = title.lower()
    core = company_core(name).lower()
    if core and re.search(r'(?<!\w)' + re.escape(core) + r'(?!\w)', lowered):
        return True
    short = _short_name(name).lower()
    if short and re.search(r'\b' + re.escape(short) + r'\b', lowered):
        return True
    searchable = _search_ticker(ticker)
    if searchable and re.search(r'\b' + re.escape(searchable) + r'\b', title):
        return True
    return bool(ticker) and re.search(r'(nasdaq|nyse)\s*:\s*' + re.escape(ticker.lower()) + r'\b', lowered) is not None


def _tokens(title: str, name: str) -> set[str]:
    own = set(company_core(name).lower().split())
    return {word for word in re.findall(r'[a-zäöüß0-9$]{4,}', title.lower()) if word not in STOPWORDS and word not in own}


def media_drafts(gdelt: dict, name: str, ticker: str = '', since: date | None = None, until: date | None = None, limit: int = 15) -> list[dict]:
    """Artikel aus GDELT → Entwürfe. Berichte über dasselbe Ereignis werden gebündelt."""
    clusters: list[dict] = []
    urls: set[str] = set()
    for article in (gdelt or {}).get('articles') or []:
        if not isinstance(article, dict):
            continue
        url = str(article.get('url') or '')
        host = _host(url)
        title = clean_title(article.get('title'))
        if not host or urlparse(url).scheme != 'https' or _in_domains(host, CONTENT_FARMS):
            continue
        if any(mark in host for mark in BLOCKED_HOSTS) or article.get('language') not in LANGUAGES:
            continue
        if url in urls:
            continue
        if not mentions(title, name, ticker):
            continue
        try:
            seen = datetime.strptime(str(article.get('seendate')), '%Y%m%dT%H%M%SZ').date()
        except ValueError:
            continue
        if (since and seen < since) or (until and seen > until):
            continue
        urls.add(url)
        words = _tokens(title, name)
        for cluster in clusters:
            common = len(words & cluster['words'])
            overlap = common / max(1, len(words | cluster['words']))
            if common >= 2 and overlap >= 0.5 and abs((seen - cluster['seen']).days) <= 3:
                cluster['articles'].append((seen, host, url, title))
                break
        else:
            clusters.append({'seen': seen, 'words': words, 'articles': [(seen, host, url, title)]})
    drafts = []
    for cluster in clusters:
        articles = cluster['articles']
        ranked = sorted(articles, key=lambda a: (next((i for i, d in enumerate(PREFERRED) if a[1] == d or a[1].endswith('.' + d)), len(PREFERRED)), -a[0].toordinal()))
        seen, host, url, title = ranked[0]
        others = len({a[1] for a in articles}) - 1
        drafts.append({
            'date': min(a[0] for a in articles).isoformat(), 'category': 'medienbericht', 'form': '', 'count': len(articles),
            'headline': '',
            'summary': '', 'hint': title, 'source': f'Bericht bei {host}' + (f' (+{others} weitere Quellen)' if others else ''),
            'source_url': url, 'include': False,
        })
    drafts.sort(key=lambda d: (d['count'], d['date']), reverse=True)
    return sorted(drafts[:limit], key=lambda d: d['date'], reverse=True)


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
