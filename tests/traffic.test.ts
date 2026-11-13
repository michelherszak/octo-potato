import test from 'node:test';
import assert from 'node:assert/strict';
import {classify,deviceOf,isPageRequest,routePattern,toDataPoint,trafficEvent} from '../lib/traffic.ts';

const request=(url:string,headers:Record<string,string>={},method='GET')=>({
  method,url,headers:{get:(name:string)=>headers[name.toLowerCase()]??null},
});
const html={accept:'text/html,application/xhtml+xml'};

test('paths collapse to route patterns so the report does not splinter',()=>{
  assert.equal(routePattern('/'),'/');
  assert.equal(routePattern('/unternehmen/MRVL'),'/unternehmen/:ticker');
  assert.equal(routePattern('/analysen/mrvl-analyse-2026-11-10?x=1'),'/analysen/:slug');
  assert.equal(routePattern('/themen/ki#top'),'/themen/:thema');
  assert.equal(routePattern('/konto/updates'),'/konto/updates');
  assert.equal(routePattern('/_next/static/chunk.js'),'/_asset');
});

test('referrers become a bare host and own pages count as internal',()=>{
  assert.deepEqual(classify('https://www.google.com/search?q=x','techthese.de'),{referrerHost:'google.com',entry:'suchmaschine'});
  assert.deepEqual(classify('https://news.ycombinator.com/item','techthese.de'),{referrerHost:'news.ycombinator.com',entry:'extern'});
  assert.deepEqual(classify('https://techthese.de/unternehmen/MRVL','techthese.de'),{referrerHost:'',entry:'intern'});
  assert.deepEqual(classify('','techthese.de'),{referrerHost:'',entry:'direkt'});
  // Keine vollständige Adresse, nur die Domain: der Suchbegriff bleibt außen vor.
  assert.equal(classify('https://google.com/search?q=geheim','techthese.de').referrerHost,'google.com');
});

test('bots are separated from people',()=>{
  assert.equal(deviceOf('Mozilla/5.0 (compatible; Googlebot/2.1)'),'bot');
  assert.equal(deviceOf('curl/8.4.0'),'bot');
  assert.equal(deviceOf(''),'bot');
  assert.equal(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'),'mobil');
  assert.equal(deviceOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari'),'rechner');
});

test('only page views are counted, not assets or interfaces',()=>{
  assert.equal(isPageRequest(request('x',html),'/unternehmen/MRVL'),true);
  assert.equal(isPageRequest(request('x',html),'/_next/static/a.js'),false);
  assert.equal(isPageRequest(request('x',html),'/api/follows'),false);
  assert.equal(isPageRequest(request('x',html),'/favicon.svg'),false);
  assert.equal(isPageRequest(request('x',html),'/sitemap.xml'),false);
  assert.equal(isPageRequest(request('x',html,'POST'),'/'),false);
  // Ein Abruf, der ausdrücklich JSON will, ist kein Seitenaufruf.
  assert.equal(isPageRequest(request('x',{accept:'application/json'}),'/'),false);
});

test('an event carries no personal data',()=>{
  const event=trafficEvent(request('https://techthese.de/unternehmen/MRVL?q=a',{
    ...html,referer:'https://www.google.com/search?q=marvell+aktie',
    'user-agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)','cf-connecting-ip':'203.0.113.9',
  }),200,142.6)!;
  assert.deepEqual(event,{path:'/unternehmen/:ticker',referrerHost:'google.com',entry:'suchmaschine',
    device:'mobil',status:200,durationMs:143});
  const serialised=JSON.stringify(event);
  for(const secret of ['203.0.113','marvell+aktie','iPhone','MRVL'])
    assert.ok(!serialised.includes(secret),'enthält '+secret);
});

test('non-page requests produce no event and durations stay sane',()=>{
  assert.equal(trafficEvent(request('https://techthese.de/api/follows',html),200,10),null);
  assert.equal(trafficEvent(request('https://techthese.de/_next/x.js',html),200,10),null);
  assert.equal(trafficEvent(request('https://techthese.de/',html),200,-5)!.durationMs,0);
  assert.equal(trafficEvent(request('https://techthese.de/',html),200,9e9)!.durationMs,60_000);
});

test('the data point fits the Analytics Engine limits',()=>{
  const point=toDataPoint(trafficEvent(request('https://techthese.de/',html),404,12)!);
  assert.ok(point.blobs.length<=20&&point.doubles.length<=20&&point.indexes.length===1);
  assert.deepEqual(point.blobs,['/','','direkt','bot','404']);
  assert.deepEqual(point.doubles,[1,12]);
});
