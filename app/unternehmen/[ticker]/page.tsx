import {env} from 'cloudflare:workers';
import {notFound} from 'next/navigation';
import {companies} from '@/lib/catalog';
import {allArticles,companyCatalog} from '@/lib/content';
import {getPublicSupabaseConfig} from '@/lib/supabase-server';
import {ArticleCard,Tags} from '../../components';
import {breadcrumbLd,jsonLd,pageMetadata} from '@/lib/seo';
import FollowButton from '../../FollowButton';
import {recentCompanyNews} from '@/lib/news';
import CompanyNews from './CompanyNews';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{ticker:string}>}){
  const {ticker}=await params;
  // Auch nachgezogene Unternehmen aus Beiträgen sollen Titel und Beschreibung bekommen.
  const company=(await companyCatalog()).find(entry=>entry.ticker===ticker);
  return pageMetadata({
    path:'/unternehmen/'+ticker,
    title:(company?.name||ticker)+' ('+ticker+') – TechThese',
    description:company?.role||('Analysen, Memos und Themenbezüge zu '+ticker+' auf TechThese.'),
  });
}
// Meldungen sind eine Ergänzung: fehlt die Tabelle (Migration noch nicht eingespielt) oder
// scheitert die Abfrage, bleibt die Unternehmensseite trotzdem erreichbar.
async function companyNewsOrNothing(ticker:string){
  if(!env.DB)return {items:[],publishedAt:null};
  try{return await recentCompanyNews(env.DB,ticker);}
  catch(error){console.error('Meldungen für',ticker,'nicht geladen',error);return {items:[],publishedAt:null};}
}
export default async function Company({params}:{params:Promise<{ticker:string}>}){const {ticker}=await params;const articles=(await allArticles()).filter(a=>a.ticker===ticker);const c=companies.find(c=>c.ticker===ticker)||(articles[0]?{name:articles[0].company,ticker,topics:articles[0].topics,role:articles[0].description,source:articles[0].sources[0]?.url}:null);if(!c)notFound();const news=await companyNewsOrNothing(ticker);return <main id="inhalt" className="container company-profile"><script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd([{name:'Unternehmen',path:'/'},{name:c.name,path:'/unternehmen/'+ticker}]))}/><a className="breadcrumb" href="/unternehmen">← Alle Unternehmen</a><section className="page-heading"><div className="company-heading-top"><div><p className="eyebrow">Unternehmensprofil · {ticker}</p><h1>{c.name}</h1></div><FollowButton ticker={ticker} company={c.name} config={getPublicSupabaseConfig()}/></div><p>{c.role}</p><Tags ids={c.topics}/><a className="read-link" href={c.source} target="_blank" rel="noopener noreferrer">Unternehmensquelle ansehen ↗</a></section><CompanyNews news={news} company={c.name}/>{articles.length?<div className="article-grid">{articles.map(a=><ArticleCard key={a.slug} article={a}/>)}</div>:<section className="search-empty"><h2>Das Unternehmen ist in der Rechercheauswahl.</h2><p>Eine Einzelanalyse ist hier noch nicht veröffentlicht. Die Themenzuordnung beschreibt das Geschäftsmodell, nicht die Attraktivität der Aktie.</p></section>}</main>;}
