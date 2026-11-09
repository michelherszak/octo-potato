import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {newsDigestSchema} from '../lib/contract.ts';
import {NewsConflict,recentCompanyNews,storeNewsDigest} from '../lib/news.ts';

const DAY=86_400_000;
const today=new Date('2026-11-09T12:00:00Z').getTime();
const day=(offset:number)=>new Date(today-offset*DAY).toISOString().slice(0,10);

function database(){
  const sqlite=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort())
    sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  function prepare(sql:string){let values:unknown[]=[];return {
    bind(...args:unknown[]){values=args;return this;},
    async first<T>(){return (sqlite.prepare(sql).get(...values as never[])||null) as T|null;},
    async run(){const result=sqlite.prepare(sql).run(...values as never[]);return {meta:{changes:Number(result.changes)}};},
  };}
  const exec=(sql:string,...args:unknown[])=>sqlite.prepare(sql).run(...args as never[]);
  return {db:{prepare} as unknown as D1Database,exec};
}

const review={reviewer:'Redaktion',reviewed_at:'2026-11-09T10:00:00+00:00',edited:true,facts_checked:true,
  commercial_rights_confirmed:true,rights_basis:'SEC EDGAR, behördlich erstellte und frei weiterverwendbare Einreichungen.',
  conflicts:'Keine eigenen Positionen in den genannten Werten.',advertising:'none',advertising_details:'Keine Vergütung für diese Zusammenstellung.'};
const item=(overrides:Record<string,unknown>={})=>({date:day(7),category:'quartalszahlen',
  headline:'Marvell legt Zahlen zum dritten Quartal vor',summary:'Eigene Zusammenfassung der Redaktion.',
  source:'SEC EDGAR, 8-K Item 2.02',source_url:'https://www.sec.gov/Archives/edgar/data/1835632/000119312526000001/d81187d8k.htm',form:'8-K',...overrides});
const digest=(items:unknown[],publication_id='5b2f1c3e-7a6d-4c8b-9e0f-1a2b3c4d5e6f')=>({publication_id,ticker:'mrvl',editorial_review:review,items});

test('a reviewed digest with primary sources is accepted and the ticker normalised',()=>{
  const parsed=newsDigestSchema.safeParse(digest([item()]));
  assert.equal(parsed.success,true);
  assert.equal(parsed.success&&parsed.data.ticker,'MRVL');
});

test('blocked, insecure, future and unknown entries are refused',()=>{
  const cases:Array<[string,Record<string,unknown>]>=[
    ['Yahoo als Herkunft',{source:'Yahoo Finance News'}],
    ['NewsAPI als Link',{source_url:'https://newsapi.org/v2/everything?q=marvell'}],
    ['unverschlüsselter Link',{source_url:'http://www.sec.gov/edgar'}],
    ['Datum in der Zukunft',{date:new Date(Date.now()+5*DAY).toISOString().slice(0,10)}],
    ['unbekannte Kategorie',{category:'geruecht'}],
    ['zu kurze Überschrift',{headline:'Zahlen'}],
  ];
  for(const [name,overrides] of cases)assert.equal(newsDigestSchema.safeParse(digest([item(overrides)])).success,false,name);
  assert.equal(newsDigestSchema.safeParse(digest(Array.from({length:41},()=>item()))).success,false,'mehr als 40 Einträge');
  assert.equal(newsDigestSchema.safeParse({...digest([item()]),editorial_review:{...review,advertising:'paid'}}).success,false,'bezahlter Inhalt');
});

test('a digest stores idempotently and a reused id with other content conflicts',async()=>{
  const {db}=database();
  const first=newsDigestSchema.parse(digest([item()]));
  assert.deepEqual(await storeNewsDigest(db,first,today),{idempotent:false,ticker:'MRVL',items:1});
  assert.deepEqual(await storeNewsDigest(db,first,today),{idempotent:true,ticker:'MRVL',items:1});
  const changed=newsDigestSchema.parse(digest([item({headline:'Eine andere Überschrift für denselben Tag'})]));
  await assert.rejects(storeNewsDigest(db,changed,today),NewsConflict);
});

test('a newer digest replaces the old one and only the last 30 days are shown, newest first',async()=>{
  const {db}=database();
  await storeNewsDigest(db,newsDigestSchema.parse(digest([item({date:day(3)})])),today-DAY);
  await storeNewsDigest(db,newsDigestSchema.parse(digest([
    item({date:day(40),headline:'Ein Ereignis außerhalb des Zeitfensters'}),
    item({date:day(12),category:'vertraege',headline:'Neuer Liefervertrag mit einem Großkunden'}),
    item({date:day(2),category:'uebernahme',headline:'Ankündigung einer geplanten Übernahme'}),
  ],'8c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f')),today);
  const news=await recentCompanyNews(db,'MRVL',today);
  assert.deepEqual(news.items.map(entry=>entry.category),['uebernahme','vertraege']);
  assert.equal(news.publishedAt,today);
});

test('no digest means no section, and a damaged row shows nothing',async()=>{
  const {db,exec}=database();
  assert.deepEqual(await recentCompanyNews(db,'ARQQ',today),{items:[],publishedAt:null});
  exec('INSERT INTO company_news(ticker,publication_id,payload,published_at) VALUES(?,?,?,?)','ARQQ','kaputt','{nicht json',today);
  assert.deepEqual(await recentCompanyNews(db,'ARQQ',today),{items:[],publishedAt:null});
});
