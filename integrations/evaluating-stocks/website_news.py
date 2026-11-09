"""Meldungs-Digest aus SEC EDGAR: Entwurf abrufen, redaktionell freigeben, an die Website übertragen."""
from __future__ import annotations

import hashlib
import json
import threading
import time
from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from . import evaluation
from .config import DATA_DIR
from .store import read_json, write_json
from .website_news_core import CATEGORIES, build_packet, collect, exhibit_title, pick_exhibit, window
from .website_publish import _settings, _target

router = APIRouter(prefix='/api/website')
TICKERS = DATA_DIR / 'website_sec_tickers.json'
NEWS_PUSHES = DATA_DIR / 'website_news_pushes.json'
RIGHTS = ('SEC EDGAR: behördliche Einreichungen, laut SEC frei zugänglich und weiterverwendbar. '
          'Überschriften und Zusammenfassungen sind eigene Texte der Redaktion.')
_records_lock = threading.Lock()
_rate_lock = threading.Lock()
_last_request = [0.0]


def _sec_get(url: str, contact: str):
    """Die SEC erlaubt höchstens 10 Anfragen je Sekunde und verlangt einen Kontakt im User-Agent."""
    with _rate_lock:
        wait = 0.12 - (time.monotonic() - _last_request[0])
        if wait > 0:
            time.sleep(wait)
        _last_request[0] = time.monotonic()
    response = httpx.get(url, headers={'User-Agent': f'TechThese {contact}'}, timeout=30, follow_redirects=False)
    response.raise_for_status()
    return response


def _contact():
    contact = str(_settings().get('sec_contact') or '').strip()
    if '@' not in contact:
        raise HTTPException(400, 'SEC-Kontaktadresse fehlt. Bitte mit integrations/configure.py --sec-contact hinterlegen.')
    return contact


def _cik(ticker: str, contact: str) -> int:
    cached = read_json(TICKERS, {})
    if time.time() - float(cached.get('fetched_at') or 0) > 86_400:
        data = _sec_get('https://www.sec.gov/files/company_tickers.json', contact).json()
        cached = {'fetched_at': time.time(), 'map': {str(v['ticker']).upper(): int(v['cik_str']) for v in data.values()}}
        write_json(TICKERS, cached)
    cik = (cached.get('map') or {}).get(ticker.upper())
    if not cik:
        raise HTTPException(404, f'{ticker} ist nicht bei der SEC registriert. Meldungen bitte über die Investor-Relations-Seite pflegen.')
    return int(cik)


def _hint(cik: int, entry: dict, contact: str) -> str:
    """Titel der angehängten Pressemitteilung als Hinweis; Fehler verhindern den Entwurf nicht."""
    try:
        folder = entry['source_url'].split('/edgar/data/', 1)[1].split('/')[1]
        index = _sec_get(f'https://www.sec.gov/Archives/edgar/data/{cik}/{folder}/index.json', contact).json()
        names = [item['name'] for item in index['directory']['item']]
        document = pick_exhibit(names) or (entry['source_url'].rsplit('/', 1)[1] if entry['form'] == '6-K' else None)
        if not document:
            return ''
        return exhibit_title(_sec_get(f'https://www.sec.gov/Archives/edgar/data/{cik}/{folder}/{document}', contact).text)
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        return ''


def _run(run_id: str):
    run = evaluation.get_run(run_id)
    ticker = str(run.get('ticker') or run.get('yahoo_symbol') or '').strip().upper()
    if not ticker:
        raise HTTPException(409, 'Diese Auswertung hat kein Börsenkürzel.')
    return run, ticker


@router.get('/runs/{run_id}/news')
def news_draft(run_id: str):
    run, ticker = _run(run_id)
    contact = _contact()
    try:
        url = _target(_settings())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    cik = _cik(ticker, contact)
    since, until = window()
    try:
        submissions = _sec_get(f'https://data.sec.gov/submissions/CIK{cik:010d}.json', contact).json()
    except httpx.HTTPError as exc:
        raise HTTPException(502, 'SEC EDGAR ist gerade nicht erreichbar. Bitte später erneut versuchen.') from exc
    drafts = collect(submissions, str(run.get('name') or ticker), since, until)
    # Höchstens zwölf Hinweise, damit ein Entwurf die SEC nicht mit Anfragen überzieht.
    for entry in [d for d in drafts if d['form'] in ('8-K', '6-K')][:12]:
        entry['hint'] = _hint(cik, entry, contact)
    return {'ticker': ticker, 'name': run.get('name') or ticker, 'since': since.isoformat(), 'until': until.isoformat(),
            'target_url': url, 'categories': CATEGORIES, 'drafts': drafts}


class NewsEntryIn(BaseModel):
    model_config = ConfigDict(extra='ignore')
    include: bool = False
    date: str
    category: str
    headline: str = Field(max_length=180)
    summary: str = Field(default='', max_length=600)
    source: str = Field(max_length=200)
    source_url: str = Field(max_length=2000)
    form: str = Field(default='', max_length=20)


class NewsPushIn(BaseModel):
    approved: bool
    publication_id: UUID
    target_url: str
    reviewer: str = Field(min_length=2, max_length=120)
    conflicts: str = Field(min_length=20, max_length=3000)
    entries: list[NewsEntryIn] = Field(max_length=60)


@router.post('/runs/{run_id}/news')
def news_push(run_id: str, body: NewsPushIn):
    if not body.approved:
        raise HTTPException(400, 'Bitte die Meldungen ausdrücklich freigeben')
    _, ticker = _run(run_id)
    settings = _settings()
    try:
        url = _target(settings)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if body.target_url.rstrip('/') != url:
        raise HTTPException(409, 'Website-Ziel hat sich geändert. Bitte den Entwurf erneut laden und freigeben.')
    if not settings.get('token'):
        raise HTTPException(400, 'Veröffentlichungsschlüssel fehlt')
    key = str(body.publication_id)
    entries = [entry.model_dump() for entry in body.entries]
    fingerprint = hashlib.sha256(json.dumps({'ticker': ticker, 'entries': entries, 'reviewer': body.reviewer,
                                             'conflicts': body.conflicts}, sort_keys=True).encode()).hexdigest()
    headers = {'Authorization': 'Bearer ' + settings['token']}
    if settings.get('sites_service_token'):
        headers['OAI-Sites-Authorization'] = 'Bearer ' + settings['sites_service_token']
    with _records_lock:
        records = read_json(NEWS_PUSHES, {})
        previous = records.get(key)
        if previous and previous.get('fingerprint') != fingerprint:
            raise HTTPException(409, 'Diese Übertragungskennung wurde für andere Meldungen verwendet')
        if previous and previous.get('state') == 'done':
            return previous['result']
        reviewed_at = (previous or {}).get('reviewed_at') or datetime.now(timezone.utc).isoformat()
        review = {'reviewer': body.reviewer.strip(), 'reviewed_at': reviewed_at, 'edited': True, 'facts_checked': True,
                  'commercial_rights_confirmed': True, 'rights_basis': RIGHTS, 'conflicts': body.conflicts.strip(),
                  'advertising': 'none', 'advertising_details': 'Keine Vergütung für diese Zusammenstellung von Meldungen.'}
        try:
            packet = build_packet(key, ticker, entries, review)
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from exc
        records[key] = {'fingerprint': fingerprint, 'state': 'pending', 'reviewed_at': reviewed_at}
        write_json(NEWS_PUSHES, records)
    try:
        response = httpx.post(url + '/api/news', json=packet, headers=headers, timeout=30, follow_redirects=False)
    except httpx.HTTPError as exc:
        raise HTTPException(502, 'Website nicht erreichbar. Die Freigabe bleibt gespeichert und kann erneut übertragen werden.') from exc
    # Eine ältere Website antwortet mit einer HTML-Fehlerseite; das ist kein Verbindungsproblem.
    if response.status_code == 404:
        raise HTTPException(502, 'Die Website kennt noch keine Meldungen. Bitte zuerst die aktuelle Website-Version ausliefern.')
    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(502, 'Antwort der Website ist ungültig. Die Freigabe bleibt gespeichert und kann erneut übertragen werden.') from exc
    if not response.is_success:
        raise HTTPException(response.status_code if response.status_code in {401, 409, 422} else 502, data.get('detail', 'Übertragung fehlgeschlagen'))
    with _records_lock:
        records = read_json(NEWS_PUSHES, {})
        records[key] = {**records.get(key, {}), 'state': 'done', 'result': data, 'completed_at': datetime.now(timezone.utc).isoformat()}
        write_json(NEWS_PUSHES, records)
    return data
