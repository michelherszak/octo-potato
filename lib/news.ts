import {newsItemSchema,type NewsDigest,type NewsItem} from './contract.ts';

type NewsDatabase=Pick<D1Database,'prepare'>;
export const NEWS_WINDOW_DAYS=30;
export const COMPANY_NEWS_LIMIT=5;
const DAY=86_400_000;

export class NewsConflict extends Error {}

// Wie bei Beiträgen: dieselbe Kennung mit gleichem Inhalt ist eine Wiederholung,
// mit anderem Inhalt ein Fehler. Eine neue Kennung ersetzt den Digest des Unternehmens.
export async function storeNewsDigest(db:NewsDatabase,digest:NewsDigest,now=Date.now()){
  const payload=JSON.stringify({ticker:digest.ticker,items:digest.items,editorial_review:digest.editorial_review});
  const existing=await db.prepare('SELECT ticker,payload FROM company_news WHERE publication_id=?')
    .bind(digest.publication_id).first<{ticker:string;payload:string}>();
  if(existing){
    if(existing.ticker===digest.ticker&&existing.payload===payload)return {idempotent:true,ticker:digest.ticker,items:digest.items.length};
    throw new NewsConflict('Diese Übertragungskennung wurde für einen anderen Inhalt verwendet.');
  }
  await db.prepare(`INSERT INTO company_news(ticker,publication_id,payload,published_at) VALUES(?,?,?,?)
    ON CONFLICT(ticker) DO UPDATE SET publication_id=excluded.publication_id,payload=excluded.payload,published_at=excluded.published_at`)
    .bind(digest.ticker,digest.publication_id,payload,now).run();
  return {idempotent:false,ticker:digest.ticker,items:digest.items.length};
}

export type CompanyNewsItem=NewsItem & {origin?:'company_feed'|'news_feed'};
export type RecentNews={items:CompanyNewsItem[];publishedAt:number|null;unavailable?:boolean};

// Gespeichertes wird trotzdem erneut geprüft: ein beschädigter Eintrag erscheint nicht.
export async function recentCompanyNews(db:NewsDatabase,ticker:string,now=Date.now(),days?:number):Promise<RecentNews>{
  const row=await db.prepare('SELECT payload,published_at FROM company_news WHERE ticker=?')
    .bind(ticker).first<{payload:string;published_at:number}>();
  if(!row)return {items:[],publishedAt:null};
  let raw:unknown;
  try{raw=JSON.parse(row.payload);}catch{return {items:[],publishedAt:null};}
  const list=Array.isArray((raw as {items?:unknown})?.items)?(raw as {items:unknown[]}).items:[];
  const cutoff=days===undefined?0:now-days*DAY;
  const items=list.flatMap(entry=>{const parsed=newsItemSchema.safeParse(entry);return parsed.success?[parsed.data]:[];})
    .filter(item=>{const at=Date.parse(item.date+'T00:00:00Z');return at>=cutoff&&at<=now+DAY;})
    .sort((a,b)=>b.date.localeCompare(a.date));
  return {items,publishedAt:Number(row.published_at)};
}
