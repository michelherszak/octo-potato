import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkData,createPriceLoader,parseChart} from '../lib/benchmark-feed.ts';

// Aufbau wie die Chart-Antwort: Zeitstempel zur Börseneröffnung, bereinigte Schlusskurse.
function chart(closes:(number|null)[],start=Date.UTC(2025,0,6,14,30)/1000){
  return {chart:{result:[{meta:{gmtoffset:-18000},timestamp:closes.map((_,i)=>start+i*86400),
    indicators:{quote:[{close:closes.map(c=>c===null?null:c*1.01)}],adjclose:[{adjclose:closes}]}}],error:null}};
}
const many=(n:number,f:(i:number)=>number)=>Array.from({length:n},(_,i)=>f(i));

test('adjusted closes are read in the exchange time zone and gaps are skipped',()=>{
  const bars=parseChart(chart([100,null,102,0,104]));
  assert.deepEqual(bars.map(b=>b.close),[100,102,104]);
  assert.equal(bars[0].date,'2025-01-06');
});

test('without adjusted closes the plain close is used, and malformed answers give nothing',()=>{
  const data=chart([10,11]);
  delete (data.chart.result[0].indicators as {adjclose?:unknown}).adjclose;
  assert.deepEqual(parseChart(data).map(b=>b.close),[10*1.01,11*1.01]);
  assert.deepEqual(parseChart({chart:{result:null,error:{code:'Not Found'}}}),[]);
  assert.deepEqual(parseChart('kein json'),[]);
});

function fakeFetch(answers:Record<string,unknown>){
  const calls:string[]=[];
  const fetcher=(async(input:RequestInfo|URL)=>{
    const url=String(input);calls.push(url);
    const symbol=decodeURIComponent(url.split('/chart/')[1].split('?')[0]);
    if(!(symbol in answers))return new Response('nicht gefunden',{status:404});
    return new Response(JSON.stringify(answers[symbol]),{status:200});
  }) as typeof fetch;
  return {fetcher,calls};
}

test('prices are cached and an invalid symbol never reaches the network',async()=>{
  let now=0;
  const {fetcher,calls}=fakeFetch({MRVL:chart(many(30,i=>100+i))});
  const load=createPriceLoader(fetcher,()=>now);
  assert.equal((await load('mrvl')).bars.length,30);
  await load('MRVL');
  assert.equal(calls.length,1,'zweiter Aufruf aus dem Zwischenspeicher');
  now+=7*60*60_000;
  await load('MRVL');
  assert.equal(calls.length,2,'nach Ablauf neu geladen');
  assert.equal((await load('../etc')).unavailable,true);
  assert.equal(calls.length,2);
});

test('a failed refresh keeps the last known prices',async()=>{
  let now=0,fail=false;
  const {fetcher}=fakeFetch({MRVL:chart(many(30,i=>100+i))});
  const flaky=(async(input:RequestInfo|URL,init?:RequestInit)=>fail?new Response('',{status:503}):fetcher(input,init)) as typeof fetch;
  const load=createPriceLoader(flaky,()=>now);
  await load('MRVL');
  fail=true;now+=7*60*60_000;
  const later=await load('MRVL');
  assert.equal(later.unavailable,true);
  assert.equal(later.bars.length,30);
});

test('the comparison needs both the stock and the benchmark',async()=>{
  // Gut eineinhalb Jahre, damit auch „seit Jahresbeginn“ und „1 Jahr“ eine Basis haben.
  const {fetcher}=fakeFetch({MRVL:chart(many(600,i=>100+i)),SPY:chart(many(600,i=>400+i/2))});
  const data=await benchmarkData('MRVL',createPriceLoader(fetcher));
  assert.ok(data);
  assert.deepEqual(data.comparison.periods.map(p=>p.id),['1m','3m','ytd','1y']);
  const {fetcher:missing}=fakeFetch({MRVL:chart(many(300,i=>100+i))});
  assert.equal(await benchmarkData('MRVL',createPriceLoader(missing)),null);
});
