import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {newsDigestSchema} from '../lib/contract.ts';
import {NewsConflict,recentCompanyNews,storeNewsDigest} from '../lib/news.ts';
import {execFileSync} from 'node:child_process';

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

test('Yahoo company news is accepted with its original provenance',()=>{
  const parsed=newsDigestSchema.parse(digest([item({category:'medienbericht',source:'Yahoo Finance News',
    source_url:'https://finance.yahoo.com/news/arqit-example.html'})]));
  assert.equal(parsed.items[0].source,'Yahoo Finance News');
  assert.equal(parsed.items[0].source_url,'https://finance.yahoo.com/news/arqit-example.html');
});

test('a digest stores idempotently and a reused id with other content conflicts',async()=>{
  const {db}=database();
  const first=newsDigestSchema.parse(digest([item()]));
  assert.deepEqual(await storeNewsDigest(db,first,today),{idempotent:false,ticker:'MRVL',items:1});
  assert.deepEqual(await storeNewsDigest(db,first,today),{idempotent:true,ticker:'MRVL',items:1});
  const changed=newsDigestSchema.parse(digest([item({headline:'Eine andere Überschrift für denselben Tag'})]));
  await assert.rejects(storeNewsDigest(db,changed,today),NewsConflict);
});

test('a newer digest replaces the old one and older news remains available for the latest-five list',async()=>{
  const {db}=database();
  await storeNewsDigest(db,newsDigestSchema.parse(digest([item({date:day(3)})])),today-DAY);
  await storeNewsDigest(db,newsDigestSchema.parse(digest([
    item({date:day(40),headline:'Ein Ereignis außerhalb des Zeitfensters'}),
    item({date:day(12),category:'vertraege',headline:'Neuer Liefervertrag mit einem Großkunden'}),
    item({date:day(2),category:'uebernahme',headline:'Ankündigung einer geplanten Übernahme'}),
  ],'8c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f')),today);
  const news=await recentCompanyNews(db,'MRVL',today);
  assert.deepEqual(news.items.map(entry=>entry.category),['uebernahme','vertraege','quartalszahlen']);
  assert.deepEqual((await recentCompanyNews(db,'MRVL',today,30)).items.map(entry=>entry.category),['uebernahme','vertraege']);
  assert.equal(news.publishedAt,today);
});

test('no digest means no section, and a damaged row shows nothing',async()=>{
  const {db,exec}=database();
  assert.deepEqual(await recentCompanyNews(db,'ARQQ',today),{items:[],publishedAt:null});
  exec('INSERT INTO company_news(ticker,publication_id,payload,published_at) VALUES(?,?,?,?)','ARQQ','kaputt','{nicht json',today);
  assert.deepEqual(await recentCompanyNews(db,'ARQQ',today),{items:[],publishedAt:null});
});

test('an actual reviewed Python media draft is accepted, stored and read on the company page',async()=>{
  const script=`import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('news_core',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
d=m.media_drafts({'articles':[{'url':'https://www.reuters.com/technology/arqit/',
 'title':'Arqit signs major encryption contract with European bank','seendate':'20261105T143000Z','language':'English'}]},'Arqit Quantum','ARQQ')[0]
d.update(include=True,headline='Arqit gewinnt eine europäische Bank als Kunden',summary='Eigene redaktionelle Einordnung der Vereinbarung.')
print(json.dumps(m.build_packet('6b2f1c3e-7a6d-4c8b-9e0f-1a2b3c4d5e6f','arqq',[d],json.loads(sys.argv[2]))))`;
  const raw=JSON.parse(execFileSync('python3',['-c',script,new URL('../integrations/evaluating-stocks/website_news_core.py',import.meta.url).pathname,JSON.stringify({...review,rights_basis:'Eigene Texte mit Link zum Medienbericht; Recherche über das GDELT Project.'})],{encoding:'utf8'}));
  const packet=newsDigestSchema.parse(raw);
  const {db}=database();
  await storeNewsDigest(db,packet,today);
  const news=await recentCompanyNews(db,'ARQQ',today);
  assert.equal(news.items.length,1);
  assert.equal(news.items[0].category,'medienbericht');
  assert.equal(news.items[0].headline,'Arqit gewinnt eine europäische Bank als Kunden');
  assert.equal(news.items[0].source_url,'https://www.reuters.com/technology/arqit/');
  assert.equal('hint' in news.items[0],false);
});
