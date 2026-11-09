import {automaticCompanyNews} from './company-news-feeds.ts';
import {COMPANY_NEWS_LIMIT,recentCompanyNews,type CompanyNewsItem,type RecentNews} from './news.ts';

export function latestNewsItems(items:CompanyNewsItem[]):CompanyNewsItem[]{
  const urls=new Set<string>(),headlines=new Set<string>();
  return [...items].sort((a,b)=>b.date.localeCompare(a.date)).filter(item=>{
    const title=item.headline.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
    if(urls.has(item.source_url)||headlines.has(title))return false;
    urls.add(item.source_url);headlines.add(title);
    return true;
  }).slice(0,COMPANY_NEWS_LIMIT);
}

export async function latestCompanyNews(ticker:string,db?:Pick<D1Database,'prepare'>,load=automaticCompanyNews):Promise<RecentNews>{
  const [reviewed,automatic]=await Promise.allSettled([
    db?recentCompanyNews(db,ticker):Promise.resolve({items:[],publishedAt:null}),load(ticker),
  ]);
  const saved=reviewed.status==='fulfilled'?reviewed.value:{items:[],publishedAt:null};
  const feed=automatic.status==='fulfilled'?automatic.value:null;
  return {items:latestNewsItems([...saved.items,...(feed?.items||[])]),
    publishedAt:feed?.checkedAt??saved.publishedAt,unavailable:!feed||feed.unavailable};
}
