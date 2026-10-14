import type {Article} from '@/lib/contract';
import {topics,topicName} from '@/lib/catalog';
import type {TopicId} from '@/lib/catalog';
export function Icon({kind='atom',size=24}:{kind?:string;size?:number}) {
  const paths:Record<string,React.ReactNode>={
    atom:<><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1"/></>,
    spark:<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8Z"/>,
    chip:<><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/></>,
    energy:<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>,
    robot:<><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 16h8M1 11v5m22-5v5"/><circle cx="8" cy="11" r="1"/><circle cx="16" cy="11" r="1"/></>,
    shield:<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Zm-4 10 3 3 5-6"/>,
    orbit:<><circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="12" ry="5" transform="rotate(-40 12 12)"/></>,
    dna:<><path d="M6 2c0 10 12 10 12 20M18 2C18 12 6 12 6 22M7 4h10M8 8h8M8 16h8M7 20h10"/></>,
  };return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]||paths.atom}</svg>;
}
export function Tags({ids}:{ids:readonly string[]}) {return <div className="tags">{ids.map(id=><a key={id} href={'/themen/'+id}>{topicName(id)}</a>)}</div>;}
export function ArticleCard({article:a,featured=false}:{article:Article;featured?:boolean}) {const topic=topics.find(t=>t.id===a.topics[0]);return <article className={'article-card '+(featured?'featured':'')}><a className="artwork" href={'/analysen/'+a.slug} aria-label={a.title}><div className="diagram"><Icon kind={topic?.icon} size={featured?100:64}/><span className="diagram-orbit"/><span className="diagram-dot"/><span className="diagram-label">{a.ticker||topic?.short}</span></div><span className="artwork-kind">{a.kind}</span></a><div className="article-card-text"><Tags ids={a.topics}/><h2><a href={'/analysen/'+a.slug}>{a.title}</a></h2><p>{a.description}</p><div className="byline"><span>{a.author}</span><span>{a.example?'Beispielbeitrag':dateText(a.published_at||a.data_as_of)}</span></div><a className="read-link" href={'/analysen/'+a.slug}>Beitrag lesen <span>↗</span></a></div></article>;}
export function dateText(d:string){return new Date(d).toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'});}
function inline(text:string) {return text.split(/(\*\*[^*]+\*\*)/g).map((p,i)=>p.startsWith('**')?<strong key={i}>{p.slice(2,-2)}</strong>:p);}
export function Prose({text}:{text:string}) {return <div className="prose">{text.replace(/\r/g,'').split(/\n\s*\n/).filter(Boolean).map((block,i)=>{const lines=block.split('\n');if(/^#{1,3} /.test(block)){const [first,...rest]=lines;return <section key={i}><h3>{inline(first.replace(/^#{1,3} /,''))}</h3>{rest.length>0&&<p>{inline(rest.join(' '))}</p>}</section>;}if(lines.every(l=>/^[-*] /.test(l)))return <ul key={i}>{lines.map((l,j)=><li key={j}>{inline(l.slice(2))}</li>)}</ul>;return <p key={i}>{inline(block)}</p>;})}</div>;}
export function TopicLink({id}:{id:TopicId}){const t=topics.find(t=>t.id===id)!;return <a className="topic-link" href={'/themen/'+id}><Icon kind={t.icon}/><span>{t.name}</span><span>↗</span></a>;}
