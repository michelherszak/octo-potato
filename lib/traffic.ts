// Serverseitige Nutzungsmessung ohne Cookie, ohne Kennung im Browser und ohne IP-Adresse.
// Es wird nichts im Endgerät gespeichert oder ausgelesen, daher ist keine Einwilligung
// nach § 25 TDDDG nötig und es werden alle Besuche gezählt, nicht nur eingewilligte.

export type TrafficEvent={
  path:string;            // aufgerufene Seite, auf Routenmuster reduziert
  referrerHost:string;    // nur die Domain der Verweisquelle, nie die volle Adresse
  entry:'intern'|'suchmaschine'|'extern'|'direkt';
  device:'mobil'|'rechner'|'bot';
  status:number;
  durationMs:number;
};

const MAX=64;

// Eigene Seiten aus dem Verweis erkennen, damit interne Klicks nicht als fremde Herkunft zählen.
const SEARCH=/(google|bing|duckduckgo|ecosia|yahoo|yandex|baidu|startpage|qwant|brave)\./i;
const BOT=/bot|crawl|spider|slurp|facebookexternalhit|bingpreview|headless|lighthouse|monitor|curl|wget|python-requests/i;
const MOBILE=/android|iphone|ipad|ipod|mobile|windows phone/i;

// Kürzel und Slugs würden die Auswertung zersplittern: /unternehmen/MRVL wird zu /unternehmen/:ticker.
export function routePattern(path:string){
  const clean=(path.split('?')[0].split('#')[0]||'/').replace(/\/+$/,'')||'/';
  const parts=clean.split('/').filter(Boolean);
  if(!parts.length)return '/';
  if(parts[0]==='unternehmen'&&parts[1])return '/unternehmen/:ticker';
  if(parts[0]==='analysen'&&parts[1])return '/analysen/:slug';
  if(parts[0]==='themen'&&parts[1])return '/themen/:thema';
  if(parts[0]==='_next'||parts[0]==='favicon.svg')return '/_asset';
  return ('/'+parts.slice(0,2).join('/')).slice(0,MAX);
}

function hostOf(referrer:string){
  try{return new URL(referrer).hostname.replace(/^www\./,'').toLowerCase().slice(0,MAX);}
  catch{return '';}
}

export function classify(referrer:string,ownHost:string){
  const host=hostOf(referrer);
  if(!host)return {referrerHost:'',entry:'direkt' as const};
  if(host===ownHost.replace(/^www\./,'').toLowerCase())return {referrerHost:'',entry:'intern' as const};
  return {referrerHost:host,entry:(SEARCH.test(host)?'suchmaschine':'extern') as 'suchmaschine'|'extern'};
}

export function deviceOf(userAgent:string):TrafficEvent['device']{
  if(!userAgent||BOT.test(userAgent))return 'bot';
  return MOBILE.test(userAgent)?'mobil':'rechner';
}

// Nur Seitenaufrufe zählen. Bilder, Skripte und Schnittstellen verfälschen sonst jede Auswertung.
export function isPageRequest(request:{method:string;headers:{get(name:string):string|null}},path:string){
  if(request.method!=='GET'&&request.method!=='HEAD')return false;
  if(path.startsWith('/_next/')||path.startsWith('/api/')||path==='/_asset')return false;
  if(/\.(ico|svg|png|jpe?g|webp|css|js|map|txt|xml|woff2?)$/i.test(path))return false;
  const accept=request.headers.get('accept')||'';
  return accept.includes('text/html')||accept==='';
}

export function trafficEvent(
  request:{method:string;url:string;headers:{get(name:string):string|null}},
  status:number,durationMs:number,
):TrafficEvent|null{
  const url=new URL(request.url);
  const path=routePattern(url.pathname);
  if(!isPageRequest(request,url.pathname))return null;
  return {
    path,
    ...classify(request.headers.get('referer')||'',url.hostname),
    device:deviceOf(request.headers.get('user-agent')||''),
    status,
    durationMs:Math.min(Math.max(Math.round(durationMs),0),60_000),
  };
}

// Analytics Engine: bis zu 20 Blobs, 20 Doubles, ein Index je Datenpunkt.
export function toDataPoint(event:TrafficEvent){
  return {
    blobs:[event.path,event.referrerHost,event.entry,event.device,String(event.status)],
    doubles:[1,event.durationMs],
    indexes:[event.path],
  };
}
