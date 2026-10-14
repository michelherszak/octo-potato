import {notFound} from 'next/navigation';
import {topics} from '@/lib/catalog';
import {allArticles,companyCatalog} from '@/lib/content';
import {ArticleRow,Tags} from '../../components';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const t=topics.find(t=>t.id===id);return {title:(t?.name||'Thema')+' – TechThese',description:t?.description};}
export default async function Topic({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;const t=topics.find(t=>t.id===id);if(!t)notFound();
  const catalog=await companyCatalog();const articles=(await allArticles()).filter(a=>a.topics.includes(id));
  const firms=catalog.filter(c=>c.topics.includes(id));
  return <main id="inhalt" className="container">
    <a className="breadcrumb" href="/themen">← Alle Themen</a>
    <section className="page-heading"><p className="eyebrow">Wissensbereich</p><h1>{t.name}</h1><p>{t.description}</p><div className="topic-page-counts"><span>{articles.length} {articles.length===1?'Beitrag':'Beiträge'}</span><a href="#unternehmen">{firms.length} Unternehmen ↘</a></div></section>
    <section><div className="section-title"><h2>Analysen, Memos & Grundlagen</h2><span>{articles.length} Beiträge</span></div>{articles.length?<div className="topic-article-list">{articles.map(a=><ArticleRow key={a.slug} article={a}/>)}</div>:<p className="muted">Eine Analyse zu diesem Thema ist noch nicht veröffentlicht. Entdecke die Unternehmen in der Rechercheauswahl.</p>}</section>
    <section id="unternehmen"><div className="section-title"><h2>Unternehmen in diesem Bereich</h2></div><div className="company-list">{firms.map(c=><article key={c.ticker}><a className="ticker" href={'/unternehmen/'+c.ticker}>{c.ticker}</a><div><h3><a href={'/unternehmen/'+c.ticker}>{c.name}</a></h3><p>{c.role}</p></div><Tags ids={c.topics}/><a href={c.source} target="_blank" rel="noopener noreferrer">Quelle ↗</a></article>)}</div></section>
  </main>;
}
