import {allArticles,companyCatalog} from '@/lib/content';
import {topics} from '@/lib/catalog';
import {Tags,dateText} from './components';
import SearchExplorer from './SearchExplorer';
import {buildSearchEntries,matchesCompany} from '@/lib/search';
import {jsonLd,organizationLd,pageMetadata,websiteLd} from '@/lib/seo';

export const dynamic='force-dynamic';
export const metadata=pageMetadata({path:'/',title:'Unternehmen – TechThese',description:'Technologieunternehmen nach ihren Rollen und Themenbereichen entdecken.'});

const published=(a:{published_at?:string;updated_at?:string;data_as_of:string})=>a.updated_at||a.published_at||a.data_as_of;

export default async function Home({searchParams}:{searchParams:Promise<{q?:string;thema?:string}>}){
  const {q='',thema=''}=await searchParams;
  const [all,articles]=await Promise.all([companyCatalog(),allArticles()]);
  const selected=topics.find(topic=>topic.id===thema);
  // Die Einstiegsfragen oben wählen über ?thema= die Liste darunter aus.
  const catalog=all.filter(company=>matchesCompany(q,company)&&(!selected||company.topics.includes(selected.id)));
  // Beispielbeiträge bleiben sichtbar, solange noch nichts Echtes erschienen ist.
  const ranked=[...articles].sort((a,b)=>Date.parse(published(b))-Date.parse(published(a)));
  const real=ranked.filter(article=>!article.example);
  const latest=(real.length?real:ranked).slice(0,6);
  return <main id="inhalt" className="container company-index">
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd([organizationLd(),websiteLd()])}/>
    <section className="browse"><SearchExplorer entries={buildSearchEntries(all,articles)} initialQuery={q} action="/" questionTarget="/#unternehmen" companiesOnly/></section>
    <div className="index-layout">
      <section aria-labelledby="unternehmen-titel">
        <div className="section-title" id="unternehmen">
          <h1 id="unternehmen-titel">{selected?'Unternehmen: '+selected.name:'Unternehmen'}</h1>
          <span>{catalog.length} {catalog.length===1?'Unternehmen':'Unternehmen'}<a className="topic-search-shortcut" href="/entdecken">Themen entdecken ↗</a></span>
        </div>
        {selected&&<div className="topic-selection"><span>Thema: <strong>{selected.short}</strong></span><a href="/#unternehmen">Auswahl zurücksetzen ↗</a></div>}
        <div className="topic-filter-row" role="group" aria-label="Nach Thema eingrenzen">
          <a aria-current={!selected?'page':undefined} href="/#unternehmen">Alle</a>
          {topics.map(topic=><a key={topic.id} aria-current={selected?.id===topic.id?'page':undefined} href={'/?thema='+topic.id+'#unternehmen'}>{topic.short}</a>)}
        </div>
        <div className="company-list">
          {!catalog.length&&<div className="search-empty">
            <h2>Hierzu haben wir noch kein Unternehmen in der Auswahl.</h2>
            <p>Versuche einen Begriff wie „Strom“, „Chips“ oder „Satelliten“ – oder wähle ein anderes Thema.</p>
            <a className="read-link" href="/#unternehmen">Alle Unternehmen ansehen ↗</a>
          </div>}
          {catalog.map(company=><article key={company.ticker}>
            <a className="ticker" href={'/unternehmen/'+company.ticker}>{company.ticker}</a>
            <div><h3><a href={'/unternehmen/'+company.ticker}>{company.name}</a></h3><p>{company.role}</p></div>
            <Tags ids={company.topics}/>
          </article>)}
        </div>
      </section>
      <aside className="latest-panel" aria-labelledby="neu-titel">
        <div className="section-title"><h2 id="neu-titel">Neu veröffentlicht</h2><span>{!latest.length?'Noch nichts erschienen':real.length?'Zuletzt erschienen':'Beispiele bis zur ersten Veröffentlichung'}</span></div>
        {latest.length?<ol className="latest-list">{latest.map(article=><li key={article.slug}>
          <a href={'/analysen/'+article.slug}>
            <span className="latest-kind">{article.kind}{article.ticker?' · '+article.ticker:''}</span>
            <strong>{article.title}</strong>
            <time dateTime={published(article)}>{article.example?'Beispielbeitrag':dateText(published(article))}</time>
          </a>
        </li>)}</ol>:<p className="muted">Sobald ein Beitrag freigegeben ist, erscheint er hier.</p>}
        <a className="read-link" href="/entdecken">Alle Themen und Beiträge ↗</a>
      </aside>
    </div>
  </main>;
}
