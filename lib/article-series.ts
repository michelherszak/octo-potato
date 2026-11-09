import type {Article} from './contract.ts';

// Maßgeblich ist die Erstveröffentlichung: eine korrigierte ältere Analyse wird dadurch nicht „neuer".
export function firstPublished(article:Pick<Article,'published_at'|'data_as_of'>){
  return Date.parse(article.published_at||article.data_as_of);
}

// Alle echten Analysen eines Unternehmens, neueste zuerst.
export function analysesFor<T extends Pick<Article,'ticker'|'example'|'published_at'|'data_as_of'|'slug'>>(articles:T[],ticker:string){
  if(!ticker)return [];
  return articles.filter(article=>article.ticker===ticker&&!article.example)
    .sort((a,b)=>firstPublished(b)-firstPublished(a)||a.slug.localeCompare(b.slug));
}

// Die jüngste Analyse desselben Unternehmens, falls sie nach dieser erschienen ist.
export function newerAnalysis<T extends Pick<Article,'ticker'|'example'|'published_at'|'data_as_of'|'slug'>>(current:T,articles:T[]){
  if(!current.ticker||current.example)return null;
  const latest=analysesFor(articles,current.ticker)[0];
  if(!latest||latest.slug===current.slug)return null;
  return firstPublished(latest)>firstPublished(current)?latest:null;
}
