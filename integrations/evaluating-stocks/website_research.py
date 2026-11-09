"""Public research suggestions for an explicitly reviewed article draft."""
from datetime import datetime, timezone
from urllib.parse import urlparse


def safe_url(value):
    if not isinstance(value, str) or len(value) > 2000:
        return ''
    try:
        parsed = urlparse(value)
    except ValueError:
        return ''
    return value if parsed.scheme in {'http', 'https'} and parsed.hostname and not parsed.username and not parsed.password else ''


def line(value, limit=300):
    # Provider titles are text, never executable Markdown or embedded HTML.
    value = ' '.join(str(value if value is not None else '').split())[:limit]
    for character in '\\`*_{}[]<>':
        value = value.replace(character, '\\' + character)
    return value


def build_research_draft(context, company_snapshot=None):
    sections, sources, warnings = [], [], []

    def source(title, url):
        url = safe_url(url)
        if not url:
            return ''
        if not any(row['url'] == url for row in sources):
            sources.append({'title': ' '.join(str(title or 'Recherchequelle').split()).replace('|', '·')[:300], 'url': url})
        return url.replace('(', '%28').replace(')', '%29').replace(' ', '%20')

    research = context.get('openalex') or {}
    works = research.get('top_works') or []
    if research.get('available') and works:
        rows = ['### Forschungspublikationen · OpenAlex',
                'Suchtreffer im Forschungsumfeld, keine bestätigte Autorenschaft oder Projektbeteiligung des Unternehmens.',
                'Auswahl nach Zitationen, nicht nach dem neuesten Veröffentlichungsdatum.',
                'Suchanfrage: ' + line(research.get('query')) + '. Abruf: ' + line(research.get('as_of') or 'nicht dokumentiert') + '.']
        if research.get('stale'):
            rows.append('Veralteter Cache: Der aktuelle Abruf ist fehlgeschlagen.')
        for work in works[:5]:
            url = source(work.get('title'), safe_url(work.get('doi')) or work.get('id'))
            if not url:
                continue
            title = line(work.get('title') or 'Publikation')
            rows.append(f"- {title} · Jahr: {line(work.get('year') or 'nicht dokumentiert')} · Zitationen: {line(work.get('citations') if work.get('citations') is not None else 'nicht dokumentiert')} · Beleg in der Quellenliste unter dem Publikationstitel.")
        if any(row.startswith('- ') for row in rows):
            sections.append('\n\n'.join(rows))
    elif context.get('mapped'):
        warnings.append('OpenAlex: keine verwendbaren Publikationen vorhanden. Das belegt keine fehlende Forschungstätigkeit.')

    benchmarks = context.get('metriq') or {}
    devices = benchmarks.get('devices') or []
    if benchmarks.get('available') and devices:
        rows = ['### Technologische Evidenz · Metriq',
                'Gerätevergleich aus dem erfassten Datensatz; kein Nachweis für Umsatz, Profitabilität oder kommerziellen Erfolg.',
                'Quelle: Metriq / Unitary Foundation · CC BY 4.0. Abruf: ' + line(benchmarks.get('as_of') or 'nicht dokumentiert') + '.']
        if benchmarks.get('stale'):
            rows.append('Veralteter Cache: Der aktuelle Abruf ist fehlgeschlagen.')
        for device in devices[:5]:
            title = ' '.join(str(device.get(key) or '') for key in ('provider', 'device')).strip()
            url = source('Metriq · ' + title, safe_url(device.get('source_url')) or benchmarks.get('source_url'))
            if not url:
                continue
            score = device.get('score')
            rows.append(f"- {line(title)} · Metriq-Score: {line(score if score is not None else 'nicht verfügbar')} · Gerätedatenstand: {line(device.get('as_of') or 'nicht dokumentiert')} · Beleg: Metriq · {line(title)} in der Quellenliste." + (' · veraltete Gerätedaten' if device.get('stale') else ''))
        if any(row.startswith('- ') for row in rows):
            sections.append('\n\n'.join(rows))
    elif context.get('mapped'):
        warnings.append('Metriq: keine verwendbaren Gerätedaten vorhanden; die Abdeckung ist begrenzt.')

    company = ((company_snapshot or {}).get('sources') or {}).get('company') or {}
    if company.get('status') == 'ok' and company.get('items'):
        rows = ['### Unternehmensmeldungen · eigene Aussagen des Unternehmens',
                'Titel und Quellen aus der gespeicherten Recherche. Aussagen sind nicht unabhängig bestätigt; Volltexte werden nicht übernommen.',
                'Recherche-Datenstand: ' + line(company_snapshot.get('checked_at') or 'nicht dokumentiert') + '.']
        for item in company['items'][:5]:
            url = source(item.get('title'), item.get('url'))
            if url:
                stamp = line(item.get('published')) if item.get('date_verified') else 'Veröffentlichungsdatum ungeprüft'
                rows.append(f"- {line(item.get('title') or 'Unternehmensmeldung')} · {stamp} · Beleg in der Quellenliste unter dem Meldungstitel.")
        if any(row.startswith('- ') for row in rows):
            sections.append('\n\n'.join(rows))

    if not context.get('mapped'):
        warnings.append('Für dieses Unternehmen ist kein OpenAlex-/Metriq-Profil hinterlegt. Belegte Forschungsprojekte können redaktionell ergänzt werden.')
    if sections:
        sections.append('### Bedeutung für die Investmentthese\n\nForschung und technische Benchmarks sind von den im Memo belegten Umsätzen, Kosten, Finanzierungsrisiken und Bewertungsannahmen zu unterscheiden. Projektpartner und Unternehmensrollen nur mit einem gesonderten Beleg als bestätigt bezeichnen.')
    return {'text': '\n\n'.join(sections), 'sources': sources, 'warnings': warnings,
            'prepared_at': datetime.now(timezone.utc).isoformat()}
