"""Editorial drafting and explicit exports to an independent reader website."""
from __future__ import annotations

import hashlib
import json
import threading
from datetime import datetime, timezone
from urllib.parse import urlparse
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from . import evaluation, llm_settings, plain_memo
from .config import DATA_DIR
from .store import read_json, write_json
from .website_editorial import EditorialDraftError, EditorialSuggestion, EditorialSuggestionIn, EditorialText, suggest_editorial_text
from .website_review_policy import DISCLOSURE_TEMPLATES, editorial_issues, validate_review
from .website_memo import build_memo_overview, number
from .website_research import build_research_draft

router = APIRouter(prefix='/api/website')
SETTINGS = DATA_DIR / 'website_settings.json'
PUSHES = DATA_DIR / 'website_pushes.json'
DRAFTS = DATA_DIR / 'website_drafts.json'
MAX_IMPORT_BYTES = 409_600
_lock = threading.Lock()
TOPICS = [
    {'id':'quanten','name':'Quanten-Technologie'}, {'id':'ki','name':'Künstliche Intelligenz'},
    {'id':'halbleiter','name':'Halbleiter & Computertechnik'}, {'id':'energie','name':'Energie & Infrastruktur'},
    {'id':'robotik','name':'Robotik & Automatisierung'}, {'id':'cybersecurity','name':'Cybersecurity'},
    {'id':'raumfahrt','name':'Raumfahrt & Kommunikation'}, {'id':'biotech','name':'Biotech & Medizintechnik'},
]
IDS = {t['id'] for t in TOPICS}
CURATED = {
    'IONQ':['quanten'],'RGTI':['quanten'],'QBTS':['quanten'],'QNT':['quanten'],
    'INFQ':['quanten'],'XNDU':['quanten'],'PSQL':['quanten'],'QUBT':['quanten'],
    'ARQQ':['quanten','cybersecurity'],'LAES':['quanten','halbleiter','cybersecurity'],'QNC':['quanten','cybersecurity'],
    'CRWV':['ki'],'APLD':['ki','energie'],'INOD':['ki'],'ALAB':['halbleiter','ki'],'CRDO':['halbleiter','ki','raumfahrt'],
    'ONTO':['halbleiter'],'HUBB':['energie'],'BWXT':['energie'],'FLNC':['energie'],
    'SYM':['robotik','ki'],'ROK':['robotik'],'CGNX':['robotik','ki'],'ZS':['cybersecurity'],'OKTA':['cybersecurity'],'QLYS':['cybersecurity'],
    'RKLB':['raumfahrt'],'PL':['raumfahrt'],'CIEN':['raumfahrt','ki'],'CRSP':['biotech'],'TWST':['biotech'],'PODD':['biotech'],
    'NVDA':['ki','halbleiter'],'AMD':['ki','halbleiter'],'MSFT':['ki','quanten'],'GOOGL':['ki','quanten'],
    'AMZN':['ki','quanten'],'IBM':['ki','quanten'],'ASML':['halbleiter'],'TSM':['halbleiter'],'TXN':['halbleiter'],
    'VRT':['ki','energie'],'ANET':['ki','halbleiter'],'CRWD':['cybersecurity'],'PANW':['cybersecurity'],
    'FTNT':['cybersecurity'],'NET':['cybersecurity'],'VST':['energie'],'NRG':['energie'],'CEG':['energie'],'GEV':['energie'],
}

class EditorialIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    slug: str = Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$', min_length=3, max_length=150)
    # new: eigener Beitrag mit eigener Adresse. update: neue Fassung eines bestehenden Beitrags.
    mode: str = Field(default='new', pattern=r'^(new|update)$')
    title: str = Field(min_length=5,max_length=180)
    description: str = Field(min_length=20,max_length=320)
    author: str = Field(min_length=2,max_length=120)
    topics: list[str] = Field(min_length=1,max_length=8)
    thesis: str = Field(min_length=20,max_length=30000)
    research: str = Field(default='',max_length=20000)
    memo: str = Field(min_length=20,max_length=60000)
    rights_basis: str = Field(default='', max_length=3000)
    conflicts: str = Field(default='', max_length=3000)
    advertising: str = Field(default='none', pattern=r'^(none|paid|affiliate)$')
    advertising_details: str = Field(default='', max_length=2000)
    original_analysis_at: str = ''
    additional_sources: list[dict[str,str]] = Field(default_factory=list,max_length=40)

    @model_validator(mode='after')
    def combined_analysis_length(self):
        if len(combined_thesis(self.model_dump())) > 30000:
            raise ValueError('Analyse und Recherche dürfen zusammen höchstens 30.000 Zeichen enthalten.')
        return self

    @field_validator('additional_sources')
    @classmethod
    def valid_sources(cls, values):
        for source in values:
            if set(source)!={'title','url'} or not source['title'].strip() or len(source['title'])>300 or len(source['url'])>2000 or urlparse(source['url']).scheme not in {'http','https'} or not urlparse(source['url']).hostname:
                raise ValueError('Zusätzliche Quellen brauchen Titel und HTTP(S)-Adresse')
        return values

    @field_validator('topics')
    @classmethod
    def valid_topics(cls, values):
        if any(v not in IDS for v in values) or len(set(values)) != len(values):
            raise ValueError('Ungültige oder doppelte Themenzuordnung')
        return values

    @field_validator('original_analysis_at')
    @classmethod
    def valid_date(cls, value):
        if value:
            parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
            if parsed.tzinfo is None:
                raise ValueError('Das ursprüngliche Datum braucht eine Zeitzone')
        return value

class PushIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    publication_id: UUID
    editorial: EditorialIn
    approved: bool = False
    notify_subscribers: bool = False
    edited: bool = False
    facts_checked: bool = False
    commercial_rights_confirmed: bool = False
    expected_revision: int = Field(default=0,ge=0)
    target_url: str = Field(default='',max_length=2000)

MONTHS=('Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember')

def _month(value):
    try:moment=datetime.fromisoformat(str(value).replace('Z','+00:00'))
    except ValueError:moment=datetime.now(timezone.utc)
    return f'{MONTHS[moment.month-1]} {moment.year}'

def _base_slug(symbol):
    return ''.join(c if c.isalnum() and c.isascii() else '-' for c in str(symbol).lower()).strip('-')+'-analyse'

def _mode_problem(mode,revision):
    """Verhindert, dass ein neuer Beitrag still einen bestehenden überschreibt, und umgekehrt."""
    if mode=='new' and revision>0:
        return 'Unter dieser Adresse gibt es bereits einen Beitrag. Wähle „Aktualisierung“ oder eine neue Adresse.'
    if mode=='update' and revision==0:
        return 'Unter dieser Adresse gibt es noch keinen Beitrag. Wähle „Neuer Beitrag“ oder einen bestehenden Beitrag.'
    return ''

def _existing_articles(symbol):
    """Bestehende Analysen auf der Website; ohne Verbindung eine leere Liste."""
    settings=_settings()
    if not symbol or not(settings.get('url') and settings.get('token')):return []
    try:
        headers={'Authorization':'Bearer '+settings['token']}
        if settings.get('sites_service_token'):headers['OAI-Sites-Authorization']='Bearer '+settings['sites_service_token']
        response=httpx.get(_target(settings)+'/api/import',params={'ticker':symbol},headers=headers,timeout=15,follow_redirects=False)
        response.raise_for_status()
        return [{'slug':str(a['slug']),'title':str(a.get('title') or a['slug']),'revision':int(a.get('revision') or 0),
                 'published_at':a.get('published_at')} for a in response.json().get('articles',[])]
    except (httpx.HTTPError,ValueError,KeyError,TypeError):
        return []

def _settings():
    return read_json(SETTINGS,{})

def _target(settings):
    url=str(settings.get('url') or '').rstrip('/')
    parsed=urlparse(url)
    if (parsed.scheme != 'https' and not(parsed.scheme=='http' and parsed.hostname in {'localhost','127.0.0.1'})) or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('Website-Adresse muss HTTPS oder eine lokale Testadresse sein')
    if not parsed.hostname or parsed.path not in {'','/'}:
        raise ValueError('Bitte nur die Basisadresse der Website verwenden')
    return url

def _urls(value):
    if isinstance(value,dict):
        return [url for v in value.values() for url in _urls(v)]
    if isinstance(value,list):
        return [url for v in value for url in _urls(v)]
    if isinstance(value,str) and value.startswith(('https://','http://')) and len(value)<=2000:
        try:
            if urlparse(value).hostname:
                return [value]
        except ValueError:
            pass
    return []

def _de(value):
    return value.get('de','') if isinstance(value,dict) else str(value or '')

def eligible(run):
    return bool(run and (run.get('publication_gate') or {}).get('status')=='passed'
                and (run.get('publication') or {}).get('status') in {'published','legacy_published'} and not run.get('stub'))

def initial_thesis(run):
    return str((run.get('plain_text') or {}).get('core_message') or 'Bitte ergänze hier deine persönliche Analyse und These.')

def readable_memo(run):
    plain=run.get('plain') or {}
    prose=run.get('plain_text') or {}
    blocks=[]
    for question in plain.get('questions') or []:
        blocks.append('## '+_de(question.get('question'))+'\n\n'+_de(question.get('answer'))+' '+_de(question.get('detail'))+'\n\n'+str(prose.get(question.get('group','')+'_note') or ''))
    if prose.get('money_story'):
        blocks.append('## Wo das Geld herkommt und hingeht\n\n'+prose['money_story'])
    if run.get('top_risk'):
        blocks.append('## Das wichtigste Risiko\n\n'+run['top_risk'])
    # Keep the complete original memo, including benchmark and valuation notes.
    blocks.append('## Das ausführliche Memo\n\n'+str(run.get('memo_markdown') or ''))
    intrinsic=run.get('intrinsic_value') or {}
    if intrinsic.get('note'):
        note='Aus den vorhandenen Daten lässt sich kein belastbarer zukünftiger Unternehmenswert berechnen.' if intrinsic.get('method')=='unavailable' else str(intrinsic['note'])
        blocks.append('## Grenzen der Unternehmensbewertung\n\n'+note)
    return '\n\n'.join(blocks).strip()

def combined_thesis(editorial):
    research=str(editorial.get('research') or '').strip()
    thesis=str(editorial.get('thesis') or '')
    return thesis + ('\n\n## Forschung und technologische Evidenz\n\n' + research if research else '')

def export_article(run, editorial):
    e=editorial.model_dump() if isinstance(editorial,EditorialIn) else dict(editorial)
    e['thesis']=combined_thesis(e)
    e.pop('research',None)
    for field in ('rights_basis', 'conflicts', 'advertising', 'advertising_details', 'mode'):
        e.pop(field, None)
    # Keine pauschale Quelle: zitiert wird, woher die Zahlen belegt stammen, plus was die
    # Redaktion ergänzt. Eine feste Vorgabe wäre eine behauptete, keine belegte Herkunft.
    sources=list(e.pop('additional_sources',[]))
    evidence=run.get('figure_evidence') or {}
    for url in sorted(set(_urls(evidence))):
        sources.append({'title':'Kennzahlenquelle · '+urlparse(url).hostname,'url':url})
    explanations={
        'price':'Der Preis für eine Aktie zum angegebenen Datenstand.',
        'revenue_growth_pct':'Wie stark der Umsatz im zugrunde liegenden Vergleichszeitraum gewachsen oder geschrumpft ist.',
        'profit_margin_pct':'Welcher Anteil des Umsatzes nach den Ausgaben als Gewinn bleibt. Ein negativer Wert zeigt einen Verlust.',
        'free_cash_flow':'Geldfluss aus dem laufenden Geschäft nach Investitionen. Ein negativer Wert bedeutet einen Mittelabfluss.',
        'price_to_sales':'Wie hoch die Börsenbewertung im Verhältnis zum Umsatz ist. Dieser Wert allein sagt nichts über die Profitabilität aus.',
        'forward_pe':'Verhältnis des Aktienkurses zum erwarteten Gewinn. Die Gewinnerwartung kann sich ändern.',
    }
    metrics=[]
    def format_number(value):
        return f'{value:,.2f}'.replace(',','_').replace('.',',').replace('_','.')

    for key, explanation in explanations.items():
        value=number((run.get('figures') or {}).get(key))
        if value is None:
            continue
        ev=evidence.get(key) or {}
        if key=='forward_pe' and value<=0:
            explanation='Der erwartete Gewinn ist nicht positiv. Das KGV eignet sich hier nicht für einen üblichen Vergleich profitabler Unternehmen; ein negativer Wert bedeutet nicht, dass die Aktie günstig ist.'
        unit=plain_memo.METRICS[key]['unit']
        if unit=='money':
            scale,suffix=(1e9,' Mrd.') if abs(value)>=1e9 else (1e6,' Mio.') if abs(value)>=1e6 else (1,'')
            formatted=format_number(value/scale)+suffix+' '+str(run.get('fundamentals_currency') or 'Währung nicht dokumentiert')
        elif key=='price':
            formatted=format_number(value)+' '+str(run.get('price_currency') or (run.get('context') or {}).get('currency') or 'Kurswährung siehe Quelle')
        else:
            formatted=format_number(value)+ (' %' if unit=='%' else ' ×' if unit=='x' else '')
        metric_url=next((url for url in _urls(ev) if url.startswith('https://')), None)
        original_source=str(ev.get('source') or '')
        source_label='Yahoo Finance · gespeicherte Auswertung' if any(mark in original_source.upper() for mark in ('YAHOO','YFINANCE')) else 'SEC-Unternehmensbericht · gespeicherte Auswertung' if 'SEC' in original_source else 'Berechnung aus gespeicherten Quelldaten' if ev.get('kind')=='derived' else 'Detailherkunft in der Auswertung nicht dokumentiert'
        metric={'key':key,'label':plain_memo.METRICS[key]['de'],'value':formatted,
                'explanation':explanation,'period':str(ev.get('period_end') or 'Berichtszeitraum siehe Quelle; Auswertung '+run['created_at'][:10])[:150],
                'source':source_label}
        if metric_url:metric['source_url']=metric_url
        metrics.append(metric)
    score=number(run.get('score'))
    unique_sources={}
    for source in sources:
        unique_sources.setdefault(source['url'], source)
    article={**e,'schema_version':1,'ticker':run.get('yahoo_symbol') or run.get('ticker') or '',
             'company':run.get('name') or '', 'kind':'Analyse & Memo','data_as_of':run['created_at'],
             'source_run_id':run['run_id'],'metrics':metrics,'sources':list(unique_sources.values())[:100],
             'model_verdict':run.get('verdict') or '', 'model_score':score if score is not None and 0 <= score <= 100 else None,
             'memo_overview':build_memo_overview(run),
             'top_risk':run.get('top_risk') or '',
             'summary':[str((run.get('plain_text') or {}).get('core_message') or e['description'])[:700]],
             'methodology':'Redaktioneller Artikel auf Basis einer freigegebenen, gespeicherten Auswertung. Kennzahlen bleiben auf diesem Datenstand. Das Modellurteil ist von der persönlichen These zu unterscheiden.','ai_assisted':True}
    if not article.get('original_analysis_at'):article.pop('original_analysis_at',None)
    return article

@router.get('/status')
def status():
    s=_settings()
    return {'url':s.get('url',''),'configured':bool(s.get('url') and s.get('token')),'topics':TOPICS}

@router.get('/runs/{run_id}/draft')
def draft(run_id:str):
    run=evaluation.get_run(run_id)
    if not run:raise HTTPException(404,'Auswertung nicht gefunden')
    symbol=run.get('yahoo_symbol') or run.get('ticker') or ''
    existing=_existing_articles(symbol)
    # Eine neue Auswertung wird ein eigener Beitrag; das Datum hält ältere Analysen erreichbar.
    slug=_base_slug(symbol)+'-'+str(run.get('created_at') or datetime.now(timezone.utc).isoformat())[:10]
    # Mehrere Analysen derselben Firma brauchen unterscheidbare Titel, auch für Suchmaschinen.
    title=f"{run.get('name')}: Technologie, Zahlen und die These zur Aktie · {_month(run.get('created_at'))}"[:180]
    e={'slug':slug,'title':title,'description':f"Analyse und Memo zu {run.get('name')}: Geschäftsmodell, Bewertung, Wachstum und Risiken verständlich erklärt – mit Kennzahlen und Quellen.",'author':'Michel Herszak',
       'topics':CURATED.get(symbol,[]),'thesis':initial_thesis(run),
       'memo':readable_memo(run),'original_analysis_at':'','additional_sources':[],'mode':'new'}
    new_slug=e['slug']
    defaults={key:e[key] for key in ('slug','title','description','author','thesis','memo')}
    defaults.update(DISCLOSURE_TEMPLATES)
    saved=read_json(DRAFTS,{}).get(run_id)
    if saved:
        e=dict(saved['editorial'])
        # Ältere Entwürfe kennen keinen Modus: eine bereits vergebene Adresse ist eine Aktualisierung.
        e.setdefault('mode','update' if e.get('slug') in {a['slug'] for a in existing} else 'new')
    e={'research':'',**e}
    for key, template in DISCLOSURE_TEMPLATES.items():
        if not (e.get(key) or '').strip():
            e[key] = template
    return {'eligible':eligible(run),'editorial':e,'defaults':defaults,'article':export_article(run,e),'topics':TOPICS,'connection':status(),
            'existing':existing,'new_slug':new_slug}

@router.post('/runs/{run_id}/research')
def research_draft(run_id:str):
    run=evaluation.get_run(run_id)
    if not run:raise HTTPException(404,'Auswertung nicht gefunden')
    from . import quantum_context, supplemental_sources
    context=quantum_context.context_for_ticker(run.get('yahoo_symbol') or run.get('ticker') or '')
    stock={'id':run.get('stock_id',''),'name':run.get('name',''),'ticker':run.get('ticker','')}
    snapshot=supplemental_sources.latest(stock) if stock['id'] else None
    return build_research_draft(context,snapshot or run.get('external_sources'))

@router.post('/runs/{run_id}/preview')
def preview(run_id:str,editorial:EditorialIn):
    run=evaluation.get_run(run_id)
    if not run:raise HTTPException(404,'Auswertung nicht gefunden')
    saved_editorial=editorial.model_dump()
    review_issues=editorial_issues(saved_editorial, initial_thesis(run), readable_memo(run))
    with _lock:
        drafts=read_json(DRAFTS,{})
        drafts[run_id]={'editorial':saved_editorial,'saved_at':datetime.now(timezone.utc).isoformat()}
        write_json(DRAFTS,drafts)
    settings=_settings()
    revision=0
    connected=False
    if settings.get('url') and settings.get('token'):
        try:
            headers={'Authorization':'Bearer '+settings['token']}
            if settings.get('sites_service_token'):headers['OAI-Sites-Authorization']='Bearer '+settings['sites_service_token']
            response=httpx.get(_target(settings)+'/api/import',params={'slug':editorial.slug},headers=headers,timeout=15,follow_redirects=False)
            response.raise_for_status()
            revision=int(response.json()['revision'])
            connected=True
        except (httpx.HTTPError,ValueError,KeyError):
            pass
    warning=_mode_problem(editorial.mode,revision) if connected else ''
    return {'article':export_article(run,editorial),'eligible':eligible(run),'review_issues':review_issues,
            'revision':revision,'connected':connected,'connection':status(),'warning':warning}

@router.post('/runs/{run_id}/editorial-suggestion', response_model_exclude_none=True)
def editorial_suggestion(run_id: str, text: EditorialSuggestionIn) -> EditorialSuggestion:
    run = evaluation.get_run(run_id)
    if not run:
        raise HTTPException(404, 'Auswertung nicht gefunden')
    if not eligible(run):
        raise HTTPException(409, 'Der Redaktionsassistent benötigt eine vollständige, geprüfte Auswertung.')
    if not llm_settings.crew_enabled():
        raise HTTPException(503, 'Bitte unter System & Daten → KI-Modell & Zugänge ein Modell konfigurieren.')
    try:
        symbol = run.get('yahoo_symbol') or run.get('ticker') or ''
        curated = CURATED.get(symbol) if text.suggest_topics else None
        business_summary = None
        if text.suggest_description:
            business_summary = str((run.get('context') or {}).get('business_summary') or '')[:1200]
        suggestion = suggest_editorial_text(EditorialText(thesis=text.thesis, memo=text.memo),
                                             TOPICS if text.suggest_topics and not curated else None,
                                             business_summary=business_summary)
        if curated:
            suggestion.topics = curated
        return suggestion
    except EditorialDraftError as exc:
        raise HTTPException(502, str(exc)) from exc

@router.post('/runs/{run_id}/push')
def push(run_id:str,body:PushIn):
    if not body.approved:raise HTTPException(400,'Bitte den fertigen Beitrag ausdrücklich freigeben')
    run=evaluation.get_run(run_id)
    if not eligible(run):raise HTTPException(409,'Nur geprüfte, veröffentlichte Auswertungen mit vollständigem Memo können übertragen werden')
    saved=read_json(DRAFTS,{}).get(run_id,{}).get('editorial')
    if saved:saved=EditorialIn(**saved).model_dump()
    try:
        validate_review(body.editorial.model_dump(), initial_thesis(run), readable_memo(run), saved, body.model_dump())
    except ValueError as exc:
        raise HTTPException(409,str(exc)) from exc
    settings=_settings()
    try:url=_target(settings)
    except ValueError as exc:raise HTTPException(400,str(exc)) from exc
    if body.target_url.rstrip('/') != url:raise HTTPException(409,'Website-Ziel hat sich geändert. Bitte den Entwurf erneut prüfen und freigeben.')
    if not settings.get('token'):raise HTTPException(400,'Veröffentlichungsschlüssel fehlt')
    problem=_mode_problem(body.editorial.mode,body.expected_revision)
    if problem:raise HTTPException(409,problem)
    article=export_article(run,body.editorial)
    # Die Website prüft die Quellen. Alte Yahoo-Auswertungen haben Anbieterangaben an
    # den Kennzahlen, aber oft keine URL; das darf den Push nicht lokal mit 409 stoppen.
    review={key:getattr(body.editorial,key).strip() for key in ('rights_basis','conflicts','advertising','advertising_details')}
    review.update(reviewer=body.editorial.author.strip(),edited=True,facts_checked=True,commercial_rights_confirmed=True)
    fingerprint=hashlib.sha256(json.dumps({'article':article,'review':review,'notify_subscribers':body.notify_subscribers},sort_keys=True).encode()).hexdigest()
    headers={'Authorization':'Bearer '+settings['token'],'Content-Type':'application/json'}
    if settings.get('sites_service_token'):headers['OAI-Sites-Authorization']='Bearer '+settings['sites_service_token']
    key=str(body.publication_id)
    with _lock:
        records=read_json(PUSHES,{})
        previous=records.get(key)
        if previous and previous.get('fingerprint')!=fingerprint:raise HTTPException(409,'Diese Übertragungskennung wurde für einen anderen Inhalt verwendet')
        if previous and previous.get('state')=='done':return previous['result']
        revision=previous['revision'] if previous else body.expected_revision
        reviewed_at=previous.get('reviewed_at') if previous else None
        reviewed_at=reviewed_at or datetime.now(timezone.utc).isoformat()
        article['editorial_review']={**review,'reviewed_at':reviewed_at}
        packet={'publication_id':key,'expected_revision':revision,'notify_subscribers':body.notify_subscribers,'article':article}
        content=json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode('utf-8')
        if len(content)>MAX_IMPORT_BYTES:
            raise HTTPException(413,'Veröffentlichung ist zu groß. Bitte kürze den Entwurf oder reduziere die Quellen.')
        records[key]={'fingerprint':fingerprint,'revision':revision,'state':'pending','reviewed_at':reviewed_at}
        write_json(PUSHES,records)
        try:
            response=httpx.post(url+'/api/import',content=content,headers=headers,timeout=30,follow_redirects=False)
            data=response.json()
        except (httpx.HTTPError,ValueError) as exc:
            raise HTTPException(502,'Website nicht erreichbar oder Antwort ungültig. Der Beitrag bleibt gespeichert und kann erneut übertragen werden.') from exc
        if not response.is_success:raise HTTPException(response.status_code if response.status_code in {401,409,413,422} else 502,data.get('detail','Übertragung fehlgeschlagen'))
        records[key]={**records[key],'state':'done','result':data,'completed_at':datetime.now(timezone.utc).isoformat()}
        write_json(PUSHES,records)
        return data
