import test from 'node:test';
import assert from 'node:assert/strict';
import {DATASET,queries,sinceLiteral,trafficReport} from '../lib/traffic-query.ts';

const NOW=Date.parse('2026-11-13T09:30:00Z');

function fakeFetch(handler:(query:string)=>{status?:number;body:string}){
  const seen:string[]=[];
  const fetcher=(async(_url:string|URL|Request,init?:RequestInit)=>{
    const query=(JSON.parse(String(init?.body)) as {query:string}).query;
    seen.push(query);
    const {status=200,body}=handler(query);
    return new Response(body,{status});
  }) as unknown as typeof fetch;
  return {fetcher,seen};
}
const ok=(rows:unknown[])=>({body:JSON.stringify({data:rows})});

test('the time window becomes a fixed point, not interval arithmetic',()=>{
  assert.equal(sinceLiteral(7,NOW),'2026-11-06 09:30:00');
  assert.match(queries(7,NOW).totals,/timestamp > toDateTime\('2026-11-06 09:30:00'\)/);
});

test('queries use documented functions and the real dataset',()=>{
  const q=queries(7,NOW);
  for(const sql of Object.values(q))assert.ok(sql.includes(DATASET),sql);
  // quantileWeighted nimmt drei Argumente, nicht die geklammerte Schreibweise.
  assert.match(q.pages,/quantileWeighted\(0\.5, double2, _sample_interval\)/);
  assert.ok(!q.daily.includes('toDate('),'toDate wird nicht unterstützt');
  assert.match(q.daily,/toStartOfDay\(timestamp\)/);
  // Stichproben werden hochgerechnet, sonst zählt man zu wenig.
  for(const sql of Object.values(q))assert.ok(sql.includes('_sample_interval'),sql);
  // Bots dürfen die Nutzungsaussagen nicht verfälschen, in der Gerätezahl aber auftauchen.
  assert.ok(q.pages.includes(`blob4 != 'bot'`)&&!q.devices.includes(`blob4 != 'bot'`));
});

test('missing credentials report as unavailable without any request',async()=>{
  const {fetcher,seen}=fakeFetch(()=>ok([]));
  const report=await trafficReport({token:'',accountId:'acc',fetcher});
  assert.equal(report.unavailable,true);
  assert.equal(seen.length,0);
});

test('before the first write the report is pending, not broken',async()=>{
  const {fetcher}=fakeFetch(()=>({status:422,body:'Input was invalid: table `events.techthese_traffic` not found'}));
  const report=await trafficReport({token:'t',accountId:'a',fetcher});
  assert.deepEqual([report.pending,report.unavailable,report.views],[true,false,0]);
});

test('an unreachable interface reports as unavailable',async()=>{
  const fetcher=(async()=>{throw new Error('offline');}) as unknown as typeof fetch;
  const report=await trafficReport({token:'t',accountId:'a',fetcher});
  assert.deepEqual([report.unavailable,report.pending],[true,false]);
});

test('results are mapped into the report',async()=>{
  const {fetcher}=fakeFetch(query=>{
    if(query.includes('AS bots'))return ok([{views:'1200',bots:'450'}]);
    if(query.includes('AS path')&&query.includes("'404'"))return ok([{path:'/alt',views:'37'}]);
    if(query.includes('AS path'))return ok([{path:'/',views:'500',median:'142.7'},{path:'/unternehmen/:ticker',views:'250',median:'98'}]);
    if(query.includes('AS entry'))return ok([{entry:'suchmaschine',views:'400'},{entry:'direkt',views:'350'}]);
    if(query.includes('AS host'))return ok([{host:'google.com',views:'400'}]);
    if(query.includes('AS device'))return ok([{device:'rechner',views:'500'},{device:'bot',views:'450'}]);
    return ok([{day:'2026-11-12 00:00:00',views:'120'}]);
  });
  const report=await trafficReport({token:'t',accountId:'a',days:7,fetcher});
  assert.deepEqual([report.views,report.botViews,report.pending,report.unavailable],[1200,450,false,false]);
  assert.deepEqual(report.pages[0],{path:'/',views:500,medianMs:143});
  assert.deepEqual(report.entries[0],{entry:'suchmaschine',views:400});
  assert.deepEqual(report.referrers,[{host:'google.com',views:400}]);
  assert.deepEqual(report.notFound,[{path:'/alt',views:37}]);
  assert.deepEqual(report.daily,[{date:'2026-11-12',views:120}]);
});

test('a single failing query does not discard the rest',async()=>{
  const {fetcher}=fakeFetch(query=>query.includes('AS host')
    ?{status:500,body:'boom'}
    :query.includes('AS bots')?ok([{views:'10',bots:'1'}]):ok([]));
  const report=await trafficReport({token:'t',accountId:'a',fetcher});
  assert.equal(report.views,10);
  assert.deepEqual(report.referrers,[]);
  assert.equal(report.unavailable,false);
});
