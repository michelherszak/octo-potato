import {allArticles,companyCatalog} from '@/lib/content';
import {topics} from '@/lib/catalog';
import {ArticleRow,Icon} from './components';
import SearchExplorer from './SearchExplorer';
import {buildSearchEntries,matchesArticle,matchesCompany,matchingTopics} from '@/lib/search';

export const dynamic='force-dynamic';

export default async function Home({searchParams}:{searchParams:Promise<{q?:string;thema?:string}>}) {
  const {q='',thema=''}=await searchParams;
  const [all,catalog]=await Promise.all([allArticles(),companyCatalog()]);
  const articles=all.filter(a=>matchesArticle(q,a));
  const companies=catalog.filter(c=>matchesCompany(q,c));
  const matching=matchingTopics(q);
  const groups=topics.filter(t=>!thema||t.id===thema).map(t=>({
    topic:t,
    articles:articles.filter(a=>a.topics.includes(t.id)).sort((a,b)=>Date.parse(b.updated_at||b.published_at||b.data_as_of)-Date.parse(a.updated_at||a.published_at||a.data_as_of)),
    companies:companies.filter(c=>c.topics.includes(t.id)),
  })).filter(g=>!q||matching.includes(g.topic.id)||g.articles.length>0||g.companies.length>0);
  const selected=topics.find(t=>t.id===thema);
  const latestArticle=[...all].sort((a,b)=>Date.parse(b.updated_at||b.published_at||b.data_as_of)-Date.parse(a.updated_at||a.published_at||a.data_as_of))[0];
  const latestDate=latestArticle&&(latestArticle.updated_at||latestArticle.published_at||latestArticle.data_as_of);
  const latestDateLabel=latestDate?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(latestDate)):'';

  return <main id="inhalt" className="container">
    <div className="edition"><span><i/> Technik, Unternehmen & Perspektiven</span><span>Das Wissensmagazin</span></div>
    {latestArticle&&<a className="publication-notice" href={'/analysen/'+latestArticle.slug} aria-label={'Neu veröffentlicht: '+latestArticle.title}>
      <span className="publication-notice-status"><i aria-hidden="true"/> Neu veröffentlicht</span>
      <strong>{latestArticle.title}</strong>
      <span className="publication-notice-meta">{latestDateLabel}<b aria-hidden="true">↗</b></span>
    </a>}
    <div className="topic-home-layout">
      <section id="ergebnisse" className="topic-stream" aria-labelledby="topic-overview-title">
        <div className="section-title"><h1 id="topic-overview-title">{selected?selected.name:q?'Themen zu deiner Suche':'Themen im Überblick'}</h1><span>{groups.length} {groups.length===1?'Bereich':'Bereiche'}<a className="topic-search-shortcut" href="#suche">Suche ↗</a></span></div>
        <p className="topic-overview-intro">Wähle eine Technologie. Entdecke dazu Analysen, Memos und die Unternehmen dahinter.</p>
        {(q||thema)&&<div className="topic-selection"><span>{q&&<>Suchbegriff: <strong>{q}</strong></>}{q&&thema?' · ':''}{selected&&<>Thema: <strong>{selected.short}</strong></>}</span><a href="/#ergebnisse">Auswahl zurücksetzen ↗</a></div>}

        <div className="topic-feed">
          {groups.map(({topic:t,articles:related,companies:relatedCompanies})=><section className="topic-feed-section" key={t.id} aria-labelledby={'topic-'+t.id}>
            <div className="topic-feed-heading">
              <a className="topic-feed-symbol" href={'/themen/'+t.id} aria-label={t.name+' entdecken'}><Icon kind={t.icon} size={28}/></a>
              <div className="topic-feed-copy"><h2 id={'topic-'+t.id}><a href={'/themen/'+t.id}>{t.name}</a></h2><p>{t.description}</p></div>
              <a className="topic-feed-open" href={'/themen/'+t.id} aria-label={'Alle Inhalte zu '+t.name+' ansehen'}>↗</a>
            </div>
            <div className="topic-feed-meta"><a href={'/themen/'+t.id}>{related.length} {related.length===1?'Beitrag':'Beiträge'}</a><span aria-hidden="true">·</span><a href={'/themen/'+t.id+'#unternehmen'}>{relatedCompanies.length} Unternehmen</a></div>
            {related[0]?<div className="topic-feed-latest"><span className="topic-latest-label">{q?'Passender Beitrag':'Zuletzt ergänzt'}</span><ArticleRow article={related[0]} headingLevel="h3"/></div>:<p className="topic-feed-empty">{q?'Noch kein passender Beitrag.':'Noch keine Analyse veröffentlicht.'} <a href={'/themen/'+t.id+'#unternehmen'}>Unternehmen entdecken ↗</a></p>}
          </section>)}
        </div>
        {!groups.length&&<div className="search-empty"><h3>Hierzu haben wir noch kein passendes Thema.</h3><p>Versuche einen Alltagsbegriff wie „Chips“ oder „Strom“, oder starte mit einer der Einstiegsfragen.</p><a className="read-link" href="/#ergebnisse">Alle acht Themen entdecken ↗</a></div>}
      </section>

      <div className="topic-sidebar">
        <aside id="suche" className="topic-search-panel" aria-label="Themen und Inhalte finden">
          <p className="eyebrow">Dein Einstieg</p>
          <SearchExplorer entries={buildSearchEntries(catalog,all)} initialQuery={q} topic={thema} compact/>
          <div className="topic-search-filters"><p className="eyebrow">Themen eingrenzen</p><div className="filter-row"><a aria-current={!thema?'page':undefined} href={'/?q='+encodeURIComponent(q)+'#ergebnisse'}>Alle Themen</a>{topics.map(t=><a aria-current={thema===t.id?'page':undefined} href={'/?thema='+t.id+'&q='+encodeURIComponent(q)+'#ergebnisse'} key={t.id}>{t.short}</a>)}</div></div>
          <a className="topic-company-directory" href="/unternehmen"><strong>{catalog.length} Unternehmen</strong><span>Nach Technologie eingeordnet ↗</span></a>
        </aside>
        <section className="demo-ad" aria-label="Demo-Anzeige">
          <span className="demo-ad-label">Demo-Anzeige</span>
          <div className="demo-ad-mark" aria-hidden="true">N<span>°</span></div>
          <p className="demo-ad-brand">NOVA GRID</p>
          <h2>Rechenleistung für Ideen von morgen.</h2>
          <p className="demo-ad-copy">Eine frei erfundene Kampagne als Platzhalter für zukünftige Werbeflächen.</p>
          <span className="demo-ad-action">Mehr erfahren ↗</span>
        </section>
      </div>
    </div>

    <section className="knowledge-strip"><div><p className="eyebrow">Der Hintergrund jeder These</p><h2>Ein Thema endet selten<br/>an seiner eigenen Grenze.</h2><p>Rechenzentren brauchen Chips und Energie. Quanten-Technologie braucht Sicherheit. Unsere Themen verbinden das Wissen dahinter.</p><a className="read-link" href="/unternehmen">Unternehmen und Verbindungen entdecken ↗</a></div><div className="knowledge-stats"><strong>{catalog.length}<span>recherchierte Unternehmen</span></strong><strong>{topics.length}<span>verknüpfte Themenbereiche</span></strong><span className="muted">Die erste Rechercheauswahl wächst mit jedem freigegebenen Beitrag.</span></div></section>
  </main>;
}
