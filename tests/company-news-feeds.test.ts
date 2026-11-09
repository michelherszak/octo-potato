import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyNewsLoader,parseNewsFeed} from '../lib/company-news-feeds.ts';
import {latestCompanyNews,latestNewsItems} from '../lib/company-news.ts';
import type {CompanyNewsItem} from '../lib/news.ts';

const now=Date.parse('2026-11-09T12:00:00Z');
const feed={url:'https://ir.arqit.uk/news-events/press-releases/rss',source:'Investor Relations · ARQQ',origin:'company_feed' as const};
const rss=(items:string)=>`<?xml version="1.0"?><rss version="2.0"><channel><title>Company releases</title>${items}</channel></rss>`;
const row=(headline='Arqit announces a strategic investment',url='https://ir.arqit.uk/news/1',date='Tue, 20 Oct 26 09:00:00 -0400')=>
  `<item><title><![CDATA[${headline}]]></title><link>${url.replace(/&/g,'&amp;')}</link><pubDate>${date}</pubDate></item>`;

test('RSS headlines retain real publication dates, decode entities and discard unsafe or future entries',()=>{
  const items=parseNewsFeed(rss(row('Arqit &amp; Sirius announce a partnership','https://ir.arqit.uk/news/1?utm_source=rss&amp;x=1')+
    row('An unsafe source link','javascript:alert(1)')+row('No valid date','https://example.org/a','not a date')+
    row('Future event not yet published','https://example.org/b','Tue, 20 Oct 27 09:00:00 -0400')),feed,now);
  assert.equal(items.length,1);
  assert.equal(items[0].headline,'Arqit & Sirius announce a partnership');
  assert.equal(items[0].date,'2026-10-20');
  assert.equal(items[0].origin,'company_feed');
  assert.equal(items[0].summary,'');
  assert.doesNotMatch(items[0].source_url,/utm_source/);
});

test('Atom feeds support alternate HTTPS links and publication dates',()=>{
  const xml='<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Arqit announces a new partnership</title><link rel="self" href="https://example.org/api/1"/><link rel="alternate" href="https://example.org/news/1"/><published>2026-09-22T09:00:00Z</published></entry></feed>';
  const items=parseNewsFeed(xml,feed,now);
  assert.equal(items[0].source_url,'https://example.org/news/1');
  assert.equal(items[0].date,'2026-09-22');
});

test('non-feed responses and XML entity declarations are rejected',()=>{
  for(const xml of ['<html><body>Rate limited</body></html>','<!DOCTYPE rss [<!ENTITY bomb "abc">]><rss/>'])
    assert.throws(()=>parseNewsFeed(xml,feed,now));
});

test('the five latest unique items include older releases and prefer direct company coverage for duplicates',()=>{
  const items=parseNewsFeed(rss(Array.from({length:7},(_,i)=>row(`Company release number ${i}`,
    `https://ir.arqit.uk/news/${i}`,new Date(now-i*40*86_400_000).toUTCString())).join('')),feed,now);
  const duplicate={...items[0],source:'Yahoo Finance',source_url:'https://finance.yahoo.com/news/1',origin:'news_feed' as const};
  const selected=latestNewsItems([items[0],duplicate,...items.slice(1)]);
  assert.equal(selected.length,5);
  assert.equal(selected[0].origin,'company_feed');
  assert.equal(selected[4].headline,'Company release number 4');
});

test('company news loads automatically without a published digest or database',async()=>{
  const items=parseNewsFeed(rss(row()),feed,now);
  const news=await latestCompanyNews('ARQQ',undefined,async()=>({items,checkedAt:now,unavailable:false}));
  assert.equal(news.items.length,1);
  assert.equal(news.publishedAt,now);
  assert.equal(news.items[0].origin,'company_feed');
});

test('loader shares concurrent requests, caches results and sends no visitor or publisher credentials',async()=>{
  let calls=0;
  const loader=createCompanyNewsLoader(async(url,options)=>{
    calls++;
    assert.match(String(url),/^https:\/\/(ir\.arqit\.uk|feeds\.finance\.yahoo\.com)\//);
    const headers=new Headers(options?.headers);
    assert.equal(headers.has('Authorization'),false);
    assert.equal(headers.has('Cookie'),false);
    return new Response(rss(row()));
  },()=>now);
  const [a,b]=await Promise.all([loader('ARQQ'),loader('ARQQ')]);
  assert.equal(calls,2);
  assert.deepEqual(a,b);
  await loader('ARQQ');
  assert.equal(calls,2);
  await loader('http://127.0.0.1');
  assert.equal(calls,2);
});

test('failed refresh keeps the last successfully loaded news and marks it unavailable',async()=>{
  let clock=now,fail=false;
  const loader=createCompanyNewsLoader(async()=>{
    if(fail)throw new Error('offline');
    return new Response(rss(row()));
  },()=>clock);
  const first=await loader('ARQQ');
  clock+=16*60_000;fail=true;
  const second=await loader('ARQQ');
  assert.deepEqual(second.items,first.items);
  assert.equal(second.unavailable,true);
});

test('a failing stored digest does not hide automatic news',async()=>{
  const item:CompanyNewsItem={date:'2026-10-20',category:'pressemitteilung',headline:'Arqit announces a strategic investment',
    summary:'',source:'Investor Relations',source_url:'https://ir.arqit.uk/news/1',origin:'company_feed'};
  const db={prepare(){throw new Error('database unavailable');}} as unknown as D1Database;
  const news=await latestCompanyNews('ARQQ',db,async()=>({items:[item],checkedAt:now,unavailable:false}));
  assert.equal(news.items.length,1);
});
