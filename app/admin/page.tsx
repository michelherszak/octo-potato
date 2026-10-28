import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import AnalyticsExclusion from '@/app/AnalyticsExclusion';
import {chatGPTSignInPath,chatGPTSignOutPath,getChatGPTUser} from '@/app/chatgpt-auth';
import {getAnalyticsDashboard,isAdminEmail} from '@/lib/analytics';

export const dynamic='force-dynamic';
export const metadata={title:'Admin-Dashboard – TechThese',robots:{index:false,follow:false}};

const dateTime=new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'});
const dateOnly=new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeZone:'Europe/Berlin'});

export default async function AdminDashboard(){
  const user=await getChatGPTUser();
  if(!user)return <main id="inhalt" className="container narrow admin-login"><p className="eyebrow">Geschützter Bereich</p><h1>Admin-Dashboard</h1><p>Melde dich an, um die pseudonyme Besucherstatistik von TechThese zu sehen.</p><a className="admin-primary-link" href={chatGPTSignInPath('/admin')} target="_top">Als Admin anmelden ↗</a></main>;
  const host=(await headers()).get('host')||'';
  const allowLocalPreview=host.startsWith('localhost:')||host.startsWith('127.0.0.1:');
  if(!isAdminEmail(user.email,env.ADMIN_EMAILS,allowLocalPreview))return <main id="inhalt" className="container narrow admin-login"><p className="eyebrow">Kein Zugriff</p><h1>Dieses Konto ist nicht als Admin freigeschaltet.</h1><p>Angemeldet als {user.email}. Hinterlege die Adresse in der Server-Einstellung <code>ADMIN_EMAILS</code>.</p><a className="admin-primary-link" href={chatGPTSignOutPath('/admin')} target="_top">Abmelden ↗</a></main>;
  if(!env.DB)throw new Error('Statistikdatenbank fehlt.');
  const data=await getAnalyticsDashboard(env.DB);
  return <main id="inhalt" className="container admin-dashboard">
    <header className="admin-heading"><div><p className="eyebrow">TechThese intern</p><h1>Besucher-Dashboard</h1><p>Pseudonyme, einwilligungsbasierte Seitenaufrufe · Stand {dateTime.format(new Date())}</p></div><div className="admin-account"><span>{user.email}</span><a href={chatGPTSignOutPath('/')} target="_top">Abmelden</a></div></header>
    <section className="admin-stat-grid" aria-label="Besucherstatistik">
      <article><span>Heute aktiv</span><strong>{data.visitorsToday}</strong><small>Unique Visitors</small></article>
      <article><span>Letzte 7 Tage</span><strong>{data.visitors7Days}</strong><small>Unique Visitors</small></article>
      <article><span>Letzte 30 Tage</span><strong>{data.visitors30Days}</strong><small>Unique Visitors</small></article>
      <article><span>Seitenaufrufe · 30 Tage</span><strong>{data.pageViews30Days}</strong><small>{data.visitorsTotal} Besucher insgesamt</small></article>
    </section>
    <AnalyticsExclusion/>
    <section className="admin-visitors" aria-labelledby="visitor-title">
      <div className="section-title"><h2 id="visitor-title">Besucher und Seitenverlauf</h2><span>Die letzten {data.visitors.length} Besucher</span></div>
      {!data.visitors.length?<div className="admin-empty"><h3>Noch keine Statistikdaten</h3><p>Seitenaufrufe erscheinen hier, sobald ein Besucher der anonymen Statistik zugestimmt hat.</p></div>:data.visitors.map((visitor,index)=><details className="admin-visitor" key={visitor.visitorId} open={index===0}>
        <summary><span><i aria-hidden="true"/> Besucher {visitor.visitorId.slice(0,8)}</span><span>{visitor.pageCount} {visitor.pageCount===1?'Seite':'Seiten'}</span><time dateTime={new Date(visitor.lastSeenAt).toISOString()}>Zuletzt {dateTime.format(new Date(visitor.lastSeenAt))}</time><b aria-hidden="true">⌄</b></summary>
        <div className="admin-visitor-meta"><span>Erster Besuch: {dateOnly.format(new Date(visitor.firstSeenAt))}</span><span>Pseudonyme ID: {visitor.visitorId}</span></div>
        <div className="admin-page-table" role="table" aria-label={'Seiten von Besucher '+visitor.visitorId.slice(0,8)}>
          <div className="admin-page-row admin-page-head" role="row"><span role="columnheader">Seite</span><span role="columnheader">Titel</span><span role="columnheader">Zeitpunkt</span></div>
          {visitor.pages.map((page,pageIndex)=><div className="admin-page-row" role="row" key={page.visitedAt+'-'+pageIndex}><a role="cell" href={page.path}>{page.path}</a><span role="cell">{page.title||'—'}</span><time role="cell" dateTime={new Date(page.visitedAt).toISOString()}>{dateTime.format(new Date(page.visitedAt))}</time></div>)}
        </div>
        {visitor.pageCount>visitor.pages.length&&<p className="admin-truncated">Gezeigt werden die letzten {visitor.pages.length} Seiten dieses Besuchers.</p>}
      </details>)}
    </section>
  </main>;
}
