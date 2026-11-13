import type {TrafficReport as Report} from '@/lib/traffic-query';

const ENTRY_LABELS:Record<string,string>={suchmaschine:'Über Suchmaschinen',extern:'Von anderen Seiten',direkt:'Direkt aufgerufen',intern:'Weiterklick auf der Seite'};
const DEVICE_LABELS:Record<string,string>={rechner:'Rechner',mobil:'Mobilgerät',bot:'Maschinen und Bots'};
const share=(part:number,whole:number)=>whole?Math.round((part/whole)*100)+' %':'–';
const duration=(ms:number)=>ms>=1000?(ms/1000).toFixed(1).replace('.',',')+' s':ms+' ms';

function Bars({rows,total,label}:{rows:Array<{name:string;views:number}>;total:number;label:string}){
  if(!rows.length)return null;
  return <div className="traffic-group">
    <h3>{label}</h3>
    <ul className="traffic-bars">{rows.map(row=><li key={row.name}>
      <span className="traffic-name">{row.name}</span>
      <span className="traffic-bar" aria-hidden="true"><i style={{width:Math.max(2,Math.round((row.views/Math.max(1,rows[0].views))*100))+'%'}}/></span>
      <span className="traffic-value">{row.views.toLocaleString('de-DE')}<small>{share(row.views,total)}</small></span>
    </li>)}</ul>
  </div>;
}

export default function TrafficReport({traffic}:{traffic:Report|null}){
  if(!traffic||traffic.unavailable)return <div className="admin-empty">
    <h3>Serverseitige Zählung nicht verfügbar</h3>
    <p>Für die Auswertung fehlt ein Cloudflare-Token mit der Berechtigung „Account Analytics · Read“ als Worker-Secret <code>CLOUDFLARE_ANALYTICS_TOKEN</code>.</p>
  </div>;
  if(traffic.pending)return <div className="admin-empty">
    <h3>Noch keine Daten</h3>
    <p>Die Zählung beginnt mit dem ersten Seitenaufruf, nachdem die neue Fassung ausgeliefert wurde. Danach dauert es einige Minuten, bis Cloudflare die Werte bereitstellt.</p>
  </div>;
  const human=traffic.views-traffic.botViews;
  const peak=Math.max(1,...traffic.daily.map(day=>day.views));
  return <div className="traffic">
    <div className="admin-stat-grid">
      <article><span>Seitenaufrufe</span><strong>{human.toLocaleString('de-DE')}</strong><small>von Menschen, {traffic.days} Tage</small></article>
      <article><span>Maschinen</span><strong>{traffic.botViews.toLocaleString('de-DE')}</strong><small>{share(traffic.botViews,traffic.views)} aller Abrufe</small></article>
      <article><span>Je Tag</span><strong>{Math.round(human/Math.max(1,traffic.days)).toLocaleString('de-DE')}</strong><small>im Mittel</small></article>
      <article><span>Nicht gefunden</span><strong>{traffic.notFound.reduce((sum,row)=>sum+row.views,0).toLocaleString('de-DE')}</strong><small>Aufrufe mit Fehler 404</small></article>
    </div>

    {traffic.daily.length>0&&<div className="traffic-group">
      <h3>Verlauf</h3>
      <ol className="traffic-days">{traffic.daily.map(day=><li key={day.date}>
        <span className="traffic-day-bar" style={{height:Math.max(3,Math.round((day.views/peak)*100))+'%'}} aria-hidden="true"/>
        <span className="traffic-day-label">{day.date.slice(8)}.{day.date.slice(5,7)}.</span>
        <span className="sr-only">{day.date}: {day.views} Aufrufe</span>
      </li>)}</ol>
    </div>}

    <Bars label="Meistbesuchte Seiten" total={human} rows={traffic.pages.map(page=>({name:page.path,views:page.views}))}/>
    {traffic.pages.length>0&&<p className="muted traffic-note">Antwortzeit im Mittel: {traffic.pages.slice(0,3).map(page=>page.path+' '+duration(page.medianMs)).join(' · ')}</p>}
    <Bars label="Wie Leser hierher kommen" total={human} rows={traffic.entries.map(entry=>({name:ENTRY_LABELS[entry.entry]||entry.entry,views:entry.views}))}/>
    <Bars label="Verweisende Seiten" total={human} rows={traffic.referrers.map(referrer=>({name:referrer.host,views:referrer.views}))}/>
    <Bars label="Geräte" total={traffic.views} rows={traffic.devices.map(device=>({name:DEVICE_LABELS[device.device]||device.device,views:device.views}))}/>
    <Bars label="Aufgerufen, aber nicht vorhanden" total={human} rows={traffic.notFound.map(row=>({name:row.path,views:row.views}))}/>

    <p className="news-note">Serverseitig gezählt, ohne Cookie, ohne Kennung im Browser und ohne IP-Adresse. Adressen sind auf Routenmuster verkürzt, von Verweisquellen wird nur die Domain gespeichert.</p>
  </div>;
}
