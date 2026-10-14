"""Explicit editorial exports to an independent reader website; no provider calls."""
from __future__ import annotations

import hashlib
import json
import math
import threading
from datetime import datetime, timezone
from urllib.parse import urlparse
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from . import evaluation, publications, plain_memo
from .config import DATA_DIR
from .store import read_json, write_json

router = APIRouter(prefix='/api/website')
SETTINGS = DATA_DIR / 'website_settings.json'
PUSHES = DATA_DIR / 'website_pushes.json'
DRAFTS = DATA_DIR / 'website_drafts.json'
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
    title: str = Field(min_length=5,max_length=180)
    description: str = Field(min_length=20,max_length=320)
    author: str = Field(min_length=2,max_length=120)
    topics: list[str] = Field(min_length=1,max_length=8)
    thesis: str = Field(min_length=20,max_length=30000)
    memo: str = Field(min_length=20,max_length=60000)
    original_analysis_at: str = ''
    additional_sources: list[dict[str,str]] = Field(default_factory=list,max_length=40)

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
    expected_revision: int = Field(default=0,ge=0)
    target_url: str = Field(default='',max_length=2000)

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
    if isinstance(value,str) and value.startswith(('https://','http://')) and len(value)<2000:
        return [value]
    return []

def _de(value):
    return value.get('de','') if isinstance(value,dict) else str(value or '')

def eligible(run):
    return bool(run and (run.get('publication_gate') or {}).get('status')=='passed'
                and (run.get('publication') or {}).get('status') in {'published','legacy_published'} and not run.get('stub'))

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

def export_article(run, editorial):
    e=editorial.model_dump() if isinstance(editorial,EditorialIn) else dict(editorial)
    sources=[{'title':'Yahoo Finance – '+str(run.get('name') or ''),'url':'https://finance.yahoo.com/quote/'+str(run.get('yahoo_symbol') or run.get('ticker') or '')}]
    sources.extend(e.pop('additional_sources',[]))
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
    for key, explanation in explanations.items():
        value=(run.get('figures') or {}).get(key)
        if not isinstance(value,(int,float)) or not math.isfinite(value):
            continue
        ev=evidence.get(key) or {}
        if key=='forward_pe' and value<=0:
            explanation='Der erwartete Gewinn ist nicht positiv. Das KGV eignet sich hier nicht für einen üblichen Vergleich profitabler Unternehmen; ein negativer Wert bedeutet nicht, dass die Aktie günstig ist.'
        unit=plain_memo.METRICS[key]['unit']
        def number(n):
            return f'{n:,.2f}'.replace(',','_').replace('.',',').replace('_','.')
        if unit=='money':
            scale,suffix=(1e9,' Mrd.') if abs(value)>=1e9 else (1e6,' Mio.') if abs(value)>=1e6 else (1,'')
            formatted=number(value/scale)+suffix+' '+str(run.get('fundamentals_currency') or 'Währung nicht dokumentiert')
        elif key=='price':
            formatted=number(value)+' '+str(run.get('price_currency') or (run.get('context') or {}).get('currency') or 'Kurswährung siehe Quelle')
        else:
            formatted=number(value)+ (' %' if unit=='%' else ' ×' if unit=='x' else '')
        urls=_urls(ev)
        original_source=str(ev.get('source') or '')
        source_label='Yahoo Finance · gespeicherte Auswertung' if 'Yahoo' in original_source else 'SEC-Unternehmensbericht · gespeicherte Auswertung' if 'SEC' in original_source else 'Berechnung aus gespeicherten Quelldaten' if ev.get('kind')=='derived' else 'Detailherkunft in der Auswertung nicht dokumentiert'
        metric={'key':key,'label':plain_memo.METRICS[key]['de'],'value':formatted,
                'explanation':explanation,'period':str(ev.get('period_end') or 'Berichtszeitraum siehe Quelle; Auswertung '+run['created_at'][:10])[:150],
                'source':source_label}
        if urls:metric['source_url']=urls[0]
        metrics.append(metric)
    article={**e,'schema_version':1,'ticker':run.get('yahoo_symbol') or run.get('ticker') or '',
             'company':run.get('name') or '', 'kind':'Analyse & Memo','data_as_of':run['created_at'],
             'source_run_id':run['run_id'],'metrics':metrics,'sources':sources,
             'model_verdict':run.get('verdict') or '', 'model_score':run.get('score'),
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
    slug=''.join(c if c.isalnum() and c.isascii() else '-' for c in symbol.lower()).strip('-')+'-analyse'
    title=f"{run.get('name')}: Technologie, Zahlen und die These zur Aktie"[:180]
    e={'slug':slug,'title':title,'description':f"Analyse und Memo zu {run.get('name')}: Geschäftsmodell, Bewertung, Wachstum und Risiken verständlich erklärt – mit Kennzahlen und Quellen.",'author':'Michel Herszak',
       'topics':CURATED.get(symbol,[]),'thesis':str((run.get('plain_text') or {}).get('core_message') or 'Bitte ergänze hier deine persönliche Analyse und These.'),
       'memo':readable_memo(run),'original_analysis_at':'','additional_sources':[]}
    saved=read_json(DRAFTS,{}).get(run_id)
    if saved:e=saved['editorial']
    return {'eligible':eligible(run),'editorial':e,'article':export_article(run,e),'topics':TOPICS,'connection':status()}

@router.post('/runs/{run_id}/preview')
def preview(run_id:str,editorial:EditorialIn):
    run=evaluation.get_run(run_id)
    if not run:raise HTTPException(404,'Auswertung nicht gefunden')
    with _lock:
        drafts=read_json(DRAFTS,{})
        drafts[run_id]={'editorial':editorial.model_dump(),'saved_at':datetime.now(timezone.utc).isoformat()}
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
    return {'article':export_article(run,editorial),'eligible':eligible(run),'revision':revision,'connected':connected,'connection':status()}

@router.post('/runs/{run_id}/push')
def push(run_id:str,body:PushIn):
    if not body.approved:raise HTTPException(400,'Bitte den fertigen Beitrag ausdrücklich freigeben')
    run=evaluation.get_run(run_id)
    if not eligible(run):raise HTTPException(409,'Nur geprüfte, veröffentlichte Auswertungen mit vollständigem Memo können übertragen werden')
    settings=_settings()
    try:url=_target(settings)
    except ValueError as exc:raise HTTPException(400,str(exc)) from exc
    if body.target_url.rstrip('/') != url:raise HTTPException(409,'Website-Ziel hat sich geändert. Bitte den Entwurf erneut prüfen und freigeben.')
    if not settings.get('token'):raise HTTPException(400,'Veröffentlichungsschlüssel fehlt')
    article=export_article(run,body.editorial)
    fingerprint=hashlib.sha256(json.dumps(article,sort_keys=True).encode()).hexdigest()
    headers={'Authorization':'Bearer '+settings['token']}
    if settings.get('sites_service_token'):headers['OAI-Sites-Authorization']='Bearer '+settings['sites_service_token']
    key=str(body.publication_id)
    with _lock:
        records=read_json(PUSHES,{})
        previous=records.get(key)
        if previous and previous.get('fingerprint')!=fingerprint:raise HTTPException(409,'Diese Übertragungskennung wurde für einen anderen Inhalt verwendet')
        if previous and previous.get('state')=='done':return previous['result']
        revision=previous['revision'] if previous else body.expected_revision
        packet={'publication_id':key,'expected_revision':revision,'article':article}
        records[key]={'fingerprint':fingerprint,'revision':revision,'state':'pending'}
        write_json(PUSHES,records)
        try:
            response=httpx.post(url+'/api/import',json=packet,headers=headers,timeout=30,follow_redirects=False)
            data=response.json()
        except (httpx.HTTPError,ValueError) as exc:
            raise HTTPException(502,'Website nicht erreichbar oder Antwort ungültig. Der Beitrag bleibt gespeichert und kann erneut übertragen werden.') from exc
        if not response.is_success:raise HTTPException(response.status_code if response.status_code in {401,409,422} else 502,data.get('detail','Übertragung fehlgeschlagen'))
        records[key]={**records[key],'state':'done','result':data,'completed_at':datetime.now(timezone.utc).isoformat()}
        write_json(PUSHES,records)
        return data
