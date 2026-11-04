import CompanyFollow from '../../CompanyFollow';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {companies} from '@/lib/catalog';
import {allArticles} from '@/lib/content';
import {getPublicSupabaseConfig} from '@/lib/supabase-server';
import {ArticleCard,Tags} from '../../components';
import FollowButton from './FollowButton';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{ticker:string}>}){const {ticker}=await params;return {title:(companies.find(c=>c.ticker===ticker)?.name||ticker)+' – TechThese'};}
export default async function Company({params}:{params:Promise<{ticker:string}>}){const {ticker}=await params;const articles=(await allArticles()).filter(a=>a.ticker===ticker);const c=companies.find(c=>c.ticker===ticker)||(articles[0]?{name:articles[0].company,ticker,topics:articles[0].topics,role:articles[0].description,source:articles[0].sources[0]?.url}:null);if(!c)notFound();return <main id="inhalt" className="container company-profile"><Link className="breadcrumb" href="/unternehmen">← Alle Unternehmen</Link><section className="page-heading"><div className="company-heading-top"><div><p className="eyebrow">Unternehmensprofil · {ticker}</p><h1>{c.name}</h1></div><FollowButton ticker={ticker} company={c.name} config={getPublicSupabaseConfig()}/></div><p>{c.role}</p><Tags ids={c.topics}/><a className="read-link" href={c.source} target="_blank" rel="noopener noreferrer">Unternehmensquelle ansehen ↗</a></section><CompanyFollow ticker={c.ticker} company={c.name}/>{articles.length?<div className="article-grid">{articles.map(a=><ArticleCard key={a.slug} article={a}/>)}</div>:<section className="search-empty"><h2>Das Unternehmen ist in der Rechercheauswahl.</h2><p>Eine Einzelanalyse ist hier noch nicht veröffentlicht. Die Themenzuordnung beschreibt das Geschäftsmodell, nicht die Attraktivität der Aktie.</p></section>}</main>;}
