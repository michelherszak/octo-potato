import {topics} from '@/lib/catalog';
import {Icon} from '../components';
import {companyCatalog} from '@/lib/content';
export const dynamic='force-dynamic';
export const metadata={title:'Themen – TechThese',description:'Acht Themenbereiche von Quanten-Technologie bis Medizintechnik.'};
export default async function Topics(){const catalog=await companyCatalog();return <main id="inhalt" className="container"><section className="page-heading"><p className="eyebrow">Die Wissenslandkarte</p><h1>Acht Bereiche.<br/><em>Viele Verbindungen.</em></h1><p>Eine Firma kann in mehreren Bereichen tätig sein. Die Zuordnung beschreibt ihren Technologiebezug und ist keine Bewertung ihrer Aktie.</p></section><div className="topic-directory">{topics.map((t,i)=><a href={'/themen/'+t.id} key={t.id}><span className="topic-number">0{i+1}</span><Icon kind={t.icon} size={36}/><h2>{t.name}</h2><p>{t.description}</p><span>{catalog.filter(c=>c.topics.includes(t.id)).length} Unternehmen entdecken ↗</span></a>)}</div></main>;}
