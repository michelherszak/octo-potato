import {NEWS_CATEGORIES} from '@/lib/news-categories';
import {COMPANY_NEWS_LIMIT,type RecentNews} from '@/lib/news';
import {dateText} from '../../components';
import {isYahooSource} from '@/lib/source-policy';

const sourceLabel=(url:string)=>{
  try{const host=new URL(url).hostname;return host==='sec.gov'||host.endsWith('.sec.gov')?'Original bei der SEC':'Originalquelle';}
  catch{return 'Originalquelle';}
};

// Die fünf neuesten verfügbaren Einträge, unabhängig vom Alter oder einem manuellen Digest.
export default function CompanyNews({news,company}:{news:RecentNews;company:string}){
  const items=[...news.items].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,COMPANY_NEWS_LIMIT);
  const automatic=items.some(item=>item.origin);
  return <section id="nachrichten" className="company-news" aria-labelledby="news-titel">
    <div className="section-title">
      <h2 id="news-titel">Aktuelle Nachrichten</h2>
      {news.publishedAt!==null&&<span>Stand {dateText(new Date(news.publishedAt).toISOString())}</span>}
    </div>
    <p className="muted">Die fünf neuesten verfügbaren Meldungen – auch wenn sie älter als 30 Tage sind.</p>
    {items.length?<ol className="news-list">{items.map((item,index)=><li key={item.date+'-'+index}>
      <div className="news-meta">
        <time dateTime={item.date}>{item.category==='medienbericht'&&!item.origin?'Erfasst ':''}{dateText(item.date)}</time>
        <span className="news-category">{item.origin==='company_feed'?'Unternehmensmeldung':NEWS_CATEGORIES[item.category]}</span>
      </div>
      <h3>{item.headline}</h3>
      {item.summary&&<p>{item.summary}</p>}
      {!isYahooSource(item.source)&&!isYahooSource(item.source_url)&&<p className="news-source">{item.source} · <a href={item.source_url} target="_blank" rel="noopener noreferrer">{item.category==='medienbericht'?'Zum Bericht':sourceLabel(item.source_url)} ↗</a></p>}
    </li>)}</ol>:<p className="muted">{news.unavailable?'Nachrichten konnten gerade nicht geladen werden. Bitte später erneut versuchen.':`Aktuell sind keine Meldungen zu ${company} verfügbar.`}</p>}
    {!!items.length&&news.unavailable&&<p className="news-note">Die Nachrichtenquellen sind gerade nicht erreichbar. Vorhandene Meldungen bleiben sichtbar.</p>}
    <p className="news-note">{automatic?'Automatisch geladene Schlagzeilen und gegebenenfalls redaktionelle Zusammenfassungen. Unternehmensmeldungen geben die Sicht des Unternehmens wieder.':'Eigene Zusammenfassungen der Redaktion auf Grundlage von Unternehmensveröffentlichungen und Medienberichten.'} Keine Kaufempfehlung und keine Anlageberatung.</p>
    {items.some(item=>item.category==='medienbericht'&&!item.origin)&&<p className="news-note">Medienberichte gefunden über das <a href="https://www.gdeltproject.org/" target="_blank" rel="noopener noreferrer">GDELT Project</a>. „Erfasst“ bezeichnet das Erfassungsdatum bei GDELT, nicht zwingend das Veröffentlichungsdatum des Artikels.</p>}
  </section>;
}
