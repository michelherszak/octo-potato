import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {RecentNews} from '../lib/news.ts';

// Node strips TypeScript but needs JSX compilation for the actual page component.
const hooks=registerHooks({
  resolve(specifier,context,next){
    if(specifier.startsWith('@/'))specifier=new URL('../'+specifier.slice(2),import.meta.url).href;
    if(specifier.startsWith('.')||specifier.startsWith('file:')){
      const url=new URL(specifier,context.parentURL);
      for(const extension of ['.ts','.tsx'])if(existsSync(new URL(url.href+extension))){specifier=url.href+extension;break;}
    }
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{
      compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
    }).outputText};
    return next(url,context);
  },
});
const {default:CompanyNews}=await import('../app/unternehmen/[ticker]/CompanyNews.tsx');
hooks.deregister();
const render=(news:RecentNews)=>renderToStaticMarkup(createElement(CompanyNews,{company:'Arqit Quantum',news}));
const publishedAt=Date.parse('2026-11-09T12:00:00Z');

test('the company news section renders media links, dates and GDELT attribution',()=>{
  const html=render({publishedAt,items:[{date:'2026-11-05',category:'medienbericht',
    headline:'Arqit gewinnt eine europäische Bank als Kunden',summary:'Eigene redaktionelle Einordnung.',
    source:'Bericht bei reuters.com',source_url:'https://www.reuters.com/technology/arqit/'}]});
  assert.match(html,/id="nachrichten"/);
  assert.match(html,/Aktuelle Nachrichten/);
  assert.match(html,/Medienbericht/);
  assert.match(html,/Erfasst /);
  assert.match(html,/href="https:\/\/www.reuters.com\/technology\/arqit\/"[^>]*>Zum Bericht/);
  assert.match(html,/href="https:\/\/www.gdeltproject.org\/"/);
  assert.match(html,/Eigene redaktionelle Einordnung/);
});

test('SEC filings retain their original link label without media attribution',()=>{
  const html=render({publishedAt,items:[{date:'2026-11-05',category:'quartalszahlen',
    headline:'Arqit veröffentlicht seine Geschäftszahlen',summary:'',source:'SEC EDGAR, 6-K',
    source_url:'https://www.sec.gov/Archives/example.htm'}]});
  assert.match(html,/Original bei der SEC/);
  assert.doesNotMatch(html,/GDELT Project|Erfasst /);
});

test('missing and empty digests keep the news section visible without claiming no events',()=>{
  assert.match(render({publishedAt:null,items:[]}), /id="nachrichten"/);
  const html=render({publishedAt,items:[]});
  assert.match(html,/keine Meldungen zu Arqit Quantum/);
  assert.doesNotMatch(html,/keine Ereignisse/);
});

test('Yahoo news stays visible while its public source label and link are suppressed',()=>{
  const html=render({publishedAt,items:[{date:'2026-11-05',category:'medienbericht',
    headline:'Arqit gewinnt eine europäische Bank als Kunden',summary:'Eigene redaktionelle Einordnung.',
    source:'Yahoo Finance News',source_url:'https://finance.yahoo.com/news/arqit.html'}]});
  assert.match(html,/Arqit gewinnt eine europäische Bank/);
  assert.match(html,/Eigene redaktionelle Einordnung/);
  assert.doesNotMatch(html,/yahoo|yfinance/i);
});

test('company pages show only the five newest entries in descending date order',()=>{
  const items=Array.from({length:7},(_,i)=>({date:`2026-11-0${i+1}`,category:'pressemitteilung' as const,
    headline:`Unternehmensmeldung Nummer ${i+1}`,summary:'',source:'Investor Relations',
    source_url:`https://ir.arqit.uk/releases/${i+1}`}));
  const html=render({publishedAt,items});
  assert.equal((html.match(/<li>/g)||[]).length,5);
  assert.doesNotMatch(html,/Nummer [12]</);
  assert.ok(html.indexOf('Nummer 7')<html.indexOf('Nummer 6'));
  assert.ok(html.indexOf('Nummer 6')<html.indexOf('Nummer 3'));
});

test('automatic company headlines are identified without claiming editorial review or GDELT dates',()=>{
  const html=render({publishedAt,items:[{date:'2026-07-14',category:'pressemitteilung',
    headline:'Arqit announces a joint cloud demonstration',summary:'',source:'Investor Relations · ARQQ',
    source_url:'https://ir.arqit.uk/news-events/press-releases/detail/129',origin:'company_feed'}]});
  assert.match(html,/Unternehmensmeldung/);
  assert.match(html,/Automatisch geladene Schlagzeilen/);
  assert.match(html,/älter als 30 Tage/);
  assert.doesNotMatch(html,/Erfasst |GDELT Project/);
});
