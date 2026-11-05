import {z} from 'zod';

const pageViewSchema=z.object({
  visitorId:z.string().uuid(),
  path:z.string().min(1).max(500).refine(path=>path.startsWith('/')&&!path.startsWith('//'),'Ungültiger Pfad'),
  title:z.string().trim().max(240).default(''),
}).strict();

type PageViewEvent=z.infer<typeof pageViewSchema>;
const ANALYTICS_RETENTION_DAYS=180;

export function parsePageView(value:unknown){return pageViewSchema.safeParse(value);}

export function isAdminEmail(email:string,configuredEmails:string|undefined,allowLocalPreview=false){
  const configured=(configuredEmails||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
  if(configured.includes(email.trim().toLowerCase()))return true;
  return allowLocalPreview&&!configured.length&&email.trim().toLowerCase()==='seedy@sites.test';
}

export async function recordPageView(db:D1Database,event:PageViewEvent,now=Date.now()){
  const retentionCutoff=now-(ANALYTICS_RETENTION_DAYS*86_400_000);
  await db.batch([
    db.prepare('DELETE FROM analytics_page_views WHERE visited_at < ?').bind(retentionCutoff),
    db.prepare('DELETE FROM analytics_visitors WHERE last_seen_at < ?').bind(retentionCutoff),
    db.prepare(`INSERT INTO analytics_visitors (visitor_id, first_seen_at, last_seen_at)
      VALUES (?, ?, ?)
      ON CONFLICT(visitor_id) DO UPDATE SET last_seen_at=excluded.last_seen_at`).bind(event.visitorId,now,now),
    db.prepare(`INSERT INTO analytics_page_views (visitor_id, path, title, visited_at)
      VALUES (?, ?, ?, ?)`).bind(event.visitorId,event.path,event.title,now),
  ]);
}

export type AnalyticsDashboard={
  visitorsToday:number;
  visitors7Days:number;
  visitors30Days:number;
  visitorsTotal:number;
  pageViews30Days:number;
  funnel:VisitorFunnel;
};

export async function getAnalyticsDashboard(db:D1Database,now=Date.now()):Promise<AnalyticsDashboard>{
  const day=86_400_000;
  const visitorCounts=await db.prepare(`SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS today,
    SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS seven_days,
    SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS thirty_days
    FROM analytics_visitors`).bind(now-day,now-(7*day),now-(30*day)).first<{total:number;today:number|null;seven_days:number|null;thirty_days:number|null}>();
  const pageCounts=await db.prepare(`SELECT COUNT(*) AS total FROM analytics_page_views WHERE visited_at >= ?`).bind(now-(30*day)).first<{total:number}>();
  const {results:journeyRows}=await db.prepare(`SELECT visitor_id, path, visited_at
    FROM analytics_page_views WHERE visited_at >= ? ORDER BY visitor_id, visited_at LIMIT 20000`)
    .bind(now-(30*day)).all<{visitor_id:string;path:string;visited_at:number}>();
  return {
    funnel:buildVisitorFunnel(journeyRows),
    visitorsToday:Number(visitorCounts?.today||0),
    visitors7Days:Number(visitorCounts?.seven_days||0),
    visitors30Days:Number(visitorCounts?.thirty_days||0),
    visitorsTotal:Number(visitorCounts?.total||0),
    pageViews30Days:Number(pageCounts?.total||0),
  };
}

const FUNNEL_STEPS=4;
const FUNNEL_BRANCHES=4;
const SESSION_GAP_MS=30*60_000;
const FAST_VIEW_MS=10_000;

type FunnelNode={
  id:string;step:number;label:string;sessions:number;kind:'page'|'exit';
  source:string|null;medianDwellMs:number|null;measured:number;fast:number;
};
type FunnelLink={from:string;to:string;sessions:number;kind:'continue'|'exit'};
export type VisitorFunnel={sessions:number;steps:number;nodes:FunnelNode[];links:FunnelLink[]};

// Einzelne Kürzel und Slugs würden den Trichter zersplittern, deshalb Routenmuster.
export function routePattern(path:string){
  const clean=(path.split('?')[0].split('#')[0]||'/').replace(/\/+$/,'')||'/';
  const segments=clean.split('/').filter(Boolean);
  if(!segments.length)return '/';
  if(segments[0]==='unternehmen'&&segments[1])return '/unternehmen/:ticker';
  if(segments[0]==='analysen'&&segments[1])return '/analysen/:slug';
  if(segments[0]==='themen'&&segments[1])return '/themen/:thema';
  return '/'+segments.slice(0,2).join('/');
}

function median(values:number[]){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:Math.round((sorted[middle-1]+sorted[middle])/2);
}

// Aufeinanderfolgende Aufrufe eines Besuchers mit großer Pause sind getrennte Besuche.
export function buildVisitorFunnel(
  rows:Array<{visitor_id:string;path:string;visited_at:number}>,
  steps=FUNNEL_STEPS,
  branches=FUNNEL_BRANCHES,
):VisitorFunnel{
  const ordered=[...rows].sort((a,b)=>a.visitor_id===b.visitor_id?Number(a.visited_at)-Number(b.visited_at):(a.visitor_id<b.visitor_id?-1:1));
  type Stop={pattern:string;at:number};
  const journeys:Stop[][]=[];
  let current:Stop[]|null=null;let lastVisitor='';let lastAt=0;
  for(const row of ordered){
    const at=Number(row.visited_at);
    const pattern=routePattern(row.path);
    if(!current||row.visitor_id!==lastVisitor||at-lastAt>SESSION_GAP_MS){current=[];journeys.push(current);}
    if(current[current.length-1]?.pattern!==pattern)current.push({pattern,at});
    lastVisitor=row.visitor_id;lastAt=at;
  }
  const kept=journeys.filter(journey=>journey.length);
  // Pro Stufe nur die häufigsten Seiten zeigen, der Rest wird gebündelt.
  const allowed:Array<Set<string>>=[];
  for(let step=0;step<steps;step++){
    const counts=new Map<string,number>();
    for(const journey of kept)if(journey[step])counts.set(journey[step].pattern,(counts.get(journey[step].pattern)||0)+1);
    allowed.push(new Set([...counts.entries()].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1)).slice(0,branches).map(([path])=>path)));
  }
  const label=(step:number,journey:Stop[])=>allowed[step].has(journey[step].pattern)?journey[step].pattern:'Andere Seiten';
  const nodes=new Map<string,FunnelNode>();
  const dwells=new Map<string,number[]>();
  const links=new Map<string,FunnelLink>();
  const pageId=(step:number,name:string)=>step+'|'+name;
  const exitId=(step:number,name:string)=>'exit|'+step+'|'+name;
  const touch=(id:string,step:number,label:string,kind:'page'|'exit',source:string|null)=>{
    const node=nodes.get(id)||{id,step,label,sessions:0,kind,source,medianDwellMs:null,measured:0,fast:0};
    node.sessions+=1;nodes.set(id,node);return node;
  };
  for(const journey of kept){
    for(let step=0;step<steps&&journey[step];step++){
      const name=label(step,journey);
      const id=pageId(step,name);
      const node=touch(id,step,name,'page',null);
      const next=journey[step+1];
      // Die letzte Seite eines Besuchs hat keine messbare Verweildauer.
      if(next){
        const dwell=next.at-journey[step].at;
        node.measured+=1;
        if(dwell<FAST_VIEW_MS)node.fast+=1;
        dwells.set(id,[...(dwells.get(id)||[]),dwell]);
      }
      const continues=Boolean(next)&&step+1<steps;
      const to=continues?pageId(step+1,label(step+1,journey)):exitId(step+1,name);
      if(!continues)touch(to,step+1,name,'exit',name);
      const key=id+'>'+to;
      const link=links.get(key)||{from:id,to,sessions:0,kind:continues?'continue' as const:'exit' as const};
      link.sessions+=1;links.set(key,link);
    }
  }
  for(const node of nodes.values())node.medianDwellMs=median(dwells.get(node.id)||[]);
  return {
    sessions:kept.length,
    steps,
    nodes:[...nodes.values()].sort((a,b)=>a.step-b.step||Number(a.kind==='exit')-Number(b.kind==='exit')||b.sessions-a.sessions||(a.label<b.label?-1:1)),
    links:[...links.values()].sort((a,b)=>b.sessions-a.sessions),
  };
}
