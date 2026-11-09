import {NEWS_CATEGORIES} from '@/lib/news-categories';
import {NEWS_WINDOW_DAYS,type RecentNews} from '@/lib/news';
import {dateText} from '../../components';

const sourceLabel=(url:string)=>{
  try{return new URL(url).hostname.endsWith('sec.gov')?'Original bei der SEC':'Originalquelle';}
  catch{return 'Originalquelle';}
};

// Ohne freigegebenen Digest erscheint der Abschnitt gar nicht: keine Meldung ist hier etwas
// anderes als „nichts passiert".
export default function CompanyNews({news,company}:{news:RecentNews;company:string}){
  if(news.publishedAt===null)return null;
  return <section className="company-news" aria-labelledby="news-titel">
    <div className="section-title">
      <h2 id="news-titel">Was im letzten Monat passiert ist</h2>
      <span>Stand {dateText(new Date(news.publishedAt).toISOString())}</span>
    </div>
    {news.items.length?<ol className="news-list">{news.items.map((item,index)=><li key={item.date+'-'+index}>
      <div className="news-meta">
        <time dateTime={item.date}>{dateText(item.date)}</time>
        <span className="news-category">{NEWS_CATEGORIES[item.category]}</span>
      </div>
      <h3>{item.headline}</h3>
      {item.summary&&<p>{item.summary}</p>}
      <p className="news-source">{item.source} · <a href={item.source_url} target="_blank" rel="noopener noreferrer">{sourceLabel(item.source_url)} ↗</a></p>
    </li>)}</ol>:<p className="muted">In den letzten {NEWS_WINDOW_DAYS} Tagen hat {company} keine Ereignisse gemeldet, die hier aufgenommen werden.</p>}
    <p className="news-note">Zusammenfassungen der Redaktion auf Grundlage der Pflichtveröffentlichungen des Unternehmens. Keine Kaufempfehlung und keine Anlageberatung.</p>
  </section>;
}
