// Auswertung der serverseitig gezählten Seitenaufrufe über die Analytics-Engine-SQL-Schnittstelle.
// Geschrieben wird in lib/traffic.ts; die Spaltennamen müssen zu toDataPoint() passen.
export const DATASET='events.techthese_traffic';
const ENDPOINT='https://api.cloudflare.com/client/v4/analytics/sql';

// blob1 Pfad · blob2 Verweis-Domain · blob3 Einstieg · blob4 Gerät · blob5 Status · double2 Dauer
export type TrafficReport={
  days:number;
  views:number;
  botViews:number;
  pages:Array<{path:string;views:number;medianMs:number}>;
  entries:Array<{entry:string;views:number}>;
  referrers:Array<{host:string;views:number}>;
  devices:Array<{device:string;views:number}>;
  notFound:Array<{path:string;views:number}>;
  daily:Array<{date:string;views:number}>;
  unavailable:boolean;
  pending:boolean;
};

const EMPTY=(days:number,pending:boolean,unavailable:boolean):TrafficReport=>
  ({days,views:0,botViews:0,pages:[],entries:[],referrers:[],devices:[],notFound:[],daily:[],unavailable,pending});

type Row=Record<string,unknown>;
const num=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)?n:0;};
const str=(value:unknown)=>typeof value==='string'?value:String(value??'');

// Menschen und Maschinen getrennt: Bots verfälschen sonst jede Aussage über Nutzung.
const HUMAN=`blob4 != 'bot'`;

// Der Zeitraum wird als fester Zeitpunkt eingesetzt statt über Intervallrechnung:
// die Unterstützung von "now() - INTERVAL" ist nicht dokumentiert, toDateTime dagegen schon.
export function sinceLiteral(days:number,now=Date.now()){
  return new Date(now-days*86_400_000).toISOString().slice(0,19).replace('T',' ');
}

export function queries(days:number,now=Date.now()){
  const window=`timestamp > toDateTime('${sinceLiteral(days,now)}')`;
  return {
    totals:`SELECT sum(_sample_interval) AS views, sumIf(_sample_interval, blob4 = 'bot') AS bots
      FROM ${DATASET} WHERE ${window}`,
    pages:`SELECT blob1 AS path, sum(_sample_interval) AS views, quantileWeighted(0.5, double2, _sample_interval) AS median
      FROM ${DATASET} WHERE ${window} AND ${HUMAN} GROUP BY path ORDER BY views DESC LIMIT 15`,
    entries:`SELECT blob3 AS entry, sum(_sample_interval) AS views
      FROM ${DATASET} WHERE ${window} AND ${HUMAN} GROUP BY entry ORDER BY views DESC`,
    referrers:`SELECT blob2 AS host, sum(_sample_interval) AS views
      FROM ${DATASET} WHERE ${window} AND ${HUMAN} AND blob2 != '' GROUP BY host ORDER BY views DESC LIMIT 10`,
    devices:`SELECT blob4 AS device, sum(_sample_interval) AS views
      FROM ${DATASET} WHERE ${window} GROUP BY device ORDER BY views DESC`,
    notFound:`SELECT blob1 AS path, sum(_sample_interval) AS views
      FROM ${DATASET} WHERE ${window} AND blob5 = '404' GROUP BY path ORDER BY views DESC LIMIT 10`,
    daily:`SELECT toStartOfDay(timestamp) AS day, sum(_sample_interval) AS views
      FROM ${DATASET} WHERE ${window} AND ${HUMAN} GROUP BY day ORDER BY day`,
  };
}

type Outcome={rows:Row[];missing:boolean};

async function run(query:string,token:string,accountId:string,fetcher:typeof fetch):Promise<Outcome>{
  const response=await fetcher(ENDPOINT,{
    method:'POST',
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({query,scope:{accountTag:accountId}}),
    signal:AbortSignal.timeout(10_000),
  });
  const text=await response.text();
  // Vor dem ersten Schreibvorgang gibt es den Datensatz noch nicht; das ist kein Fehler.
  if(!response.ok)return {rows:[],missing:/not found/i.test(text)};
  try{
    const parsed=JSON.parse(text) as {data?:Row[]};
    return {rows:Array.isArray(parsed.data)?parsed.data:[],missing:false};
  }catch{return {rows:[],missing:false};}
}

export async function trafficReport(
  {token,accountId,days=7,fetcher=fetch}:{token?:string;accountId?:string;days?:number;fetcher?:typeof fetch},
):Promise<TrafficReport>{
  if(!token||!accountId)return EMPTY(days,false,true);
  const q=queries(days);
  const keys=['totals','pages','entries','referrers','devices','notFound','daily'] as const;
  const settled=await Promise.allSettled(keys.map(key=>run(q[key],token,accountId,fetcher)));
  const results=settled.map(entry=>entry.status==='fulfilled'?entry.value:null);
  // Alle Abfragen gescheitert heißt: Schnittstelle nicht erreichbar.
  if(results.every(result=>result===null))return EMPTY(days,false,true);
  if(results.some(result=>result?.missing))return EMPTY(days,true,false);
  const rows=Object.fromEntries(keys.map((key,index)=>[key,results[index]?.rows??[]])) as Record<typeof keys[number],Row[]>;
  const totals=rows.totals[0]??{};
  return {
    days,
    views:num(totals.views),
    botViews:num(totals.bots),
    pages:rows.pages.map(row=>({path:str(row.path),views:num(row.views),medianMs:Math.round(num(row.median))})),
    entries:rows.entries.map(row=>({entry:str(row.entry),views:num(row.views)})),
    referrers:rows.referrers.map(row=>({host:str(row.host),views:num(row.views)})),
    devices:rows.devices.map(row=>({device:str(row.device),views:num(row.views)})),
    notFound:rows.notFound.map(row=>({path:str(row.path),views:num(row.views)})),
    daily:rows.daily.map(row=>({date:str(row.day).slice(0,10),views:num(row.views)})),
    unavailable:false,pending:false,
  };
}
