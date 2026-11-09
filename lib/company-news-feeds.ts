import {XMLParser} from 'fast-xml-parser';
import {blockedSource} from './source-policy.ts';
import type {CompanyNewsItem} from './news.ts';

type Feed={url:string;source:string;origin:'company_feed'|'news_feed'};
type Snapshot={items:CompanyNewsItem[];checkedAt:number;unavailable:boolean};
const TTL=15*60_000;
const MAX_BYTES=1_000_000;
const companyFeeds:Record<string,string>={
  ARQQ:'https://ir.arqit.uk/news-events/press-releases/rss',
};
const parser=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,htmlEntities:true});
const array=(value:unknown):unknown[]=>Array.isArray(value)?value:value?[value]:[];
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'?value as Record<string,unknown>:{};
const text=(value:unknown):string=>typeof value==='string'?value:textValue(object(value)['#text']);
const textValue=(value:unknown):string=>typeof value==='string'?value:'';

function articleUrl(value:string):string{
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||blockedSource(value))return '';
    for(const key of [...url.searchParams.keys()])if(key.startsWith('utm_')||key==='.tsrc')url.searchParams.delete(key);
    url.hash='';
    return url.href;
  }catch{return '';}
}

export function parseNewsFeed(xml:string,feed:Feed,now=Date.now()):CompanyNewsItem[]{
  // External entities and document declarations are unnecessary for RSS/Atom.
  if(xml.length>MAX_BYTES||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Unsupported news feed');
  const data=parser.parse(xml);
  if(!data?.rss?.channel&&!data?.feed)throw new Error('Invalid news feed');
  const rows=array(data?.rss?.channel?.item??data?.feed?.entry);
  return rows.flatMap(value=>{
    const row=object(value);
    const title=text(row.title);
    const decoded=text(parser.parse('<text>'+title.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</text>').text);
    const headline=decoded.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
    const links=array(row.link);
    const alternate=links.find(link=>object(link)['@_rel']==='alternate')??links.find(link=>object(link)['@_href'])??row.link;
    const url=articleUrl(text(object(alternate)['@_href'])||text(alternate));
    const at=Date.parse(text(row.pubDate??row.published??row.updated));
    if(headline.length<8||!url||!Number.isFinite(at)||at>now+86_400_000)return [];
    return [{date:new Date(at).toISOString().slice(0,10),headline,summary:'',
      category:feed.origin==='company_feed'?'pressemitteilung' as const:'medienbericht' as const,
      source:feed.source,source_url:url,origin:feed.origin}];
  });
}

async function readFeed(response:Response):Promise<string>{
  if(!response.ok||Number(response.headers.get('content-length'))>MAX_BYTES)throw new Error('News feed unavailable');
  const reader=response.body?.getReader();
  if(!reader)return '';
  const chunks:Uint8Array[]=[];
  let length=0;
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      length+=value.byteLength;
      if(length>MAX_BYTES){await reader.cancel();throw new Error('News feed too large');}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder().decode(bytes);
}

// Feed URLs are fixed here; only a validated ticker is inserted into the Yahoo query.
// Requests never contain publisher credentials, account details or visitor data.
export function createCompanyNewsLoader(fetcher:typeof fetch=fetch,clock=Date.now){
  const cache=new Map<string,Snapshot>();
  const pending=new Map<string,Promise<Snapshot>>();
  return async function load(ticker:string):Promise<Snapshot>{
    ticker=ticker.trim().toUpperCase();
    if(!/^[A-Z0-9.-]{1,30}$/.test(ticker))return {items:[],checkedAt:clock(),unavailable:true};
    const previous=cache.get(ticker);
    if(previous&&clock()-previous.checkedAt<(previous.unavailable?60_000:TTL))return previous;
    const existing=pending.get(ticker);
    if(existing)return existing;
    const request=(async()=>{
      const feeds:Feed[]=[];
      if(companyFeeds[ticker])feeds.push({url:companyFeeds[ticker],source:'Investor Relations · '+ticker,origin:'company_feed'});
      feeds.push({url:'https://feeds.finance.yahoo.com/rss/2.0/headline?'+new URLSearchParams({s:ticker,region:'US',lang:'en-US'}),source:'Yahoo Finance',origin:'news_feed'});
      const results=await Promise.allSettled(feeds.map(async feed=>{
        const response=await fetcher(feed.url,{headers:{Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml',
          'User-Agent':'TechThese/1.0'},signal:AbortSignal.timeout(6000),redirect:'manual',
          cf:{cacheTtlByStatus:{'200-299':900,'400-599':0},cacheEverything:true}});
        return parseNewsFeed(await readFeed(response),feed,clock());
      }));
      results.forEach((result,index)=>{
        if(result.status==='rejected')console.warn('Company news feed unavailable',new URL(feeds[index].url).hostname,
          result.reason instanceof Error?result.reason.message:'Fetch failed');
      });
      const items=results.flatMap(result=>result.status==='fulfilled'?result.value:[]);
      const unavailable=results.every(result=>result.status==='rejected');
      const snapshot={items:unavailable&&previous?previous.items:items,checkedAt:clock(),unavailable};
      if(cache.size>=100)cache.delete(cache.keys().next().value!);
      cache.set(ticker,snapshot);
      return snapshot;
    })();
    pending.set(ticker,request);
    try{return await request;}finally{pending.delete(ticker);}
  };
}

export const automaticCompanyNews=createCompanyNewsLoader();
