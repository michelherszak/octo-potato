import {z} from 'zod';

const pageViewSchema=z.object({
  visitorId:z.string().uuid(),
  path:z.string().min(1).max(500).refine(path=>path.startsWith('/')&&!path.startsWith('//'),'Ungültiger Pfad'),
  title:z.string().trim().max(240).default(''),
}).strict();

export type PageViewEvent=z.infer<typeof pageViewSchema>;
export const ANALYTICS_RETENTION_DAYS=180;

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

export const FUNNEL_STEPS=4;
export const FUNNEL_BRANCHES=4;
export const SESSION_GAP_MS=30*60_000;

export type FunnelNode={id:string;step:number;label:string;sessions:number};
export type FunnelLink={from:string;to:string;sessions:number;kind:'continue'|'exit'};
export type VisitorFunnel={
  sessions:number;
  steps:number;
  nodes:FunnelNode[];
  links:FunnelLink[];
  exits:Array<{step:number;sessions:number}>;
};

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

// Aufeinanderfolgende Aufrufe eines Besuchers mit großer Pause sind getrennte Besuche.
export function buildVisitorFunnel(
  rows:Array<{visitor_id:string;path:string;visited_at:number}>,
  steps=FUNNEL_STEPS,
  branches=FUNNEL_BRANCHES,
):VisitorFunnel{
  const ordered=[...rows].sort((a,b)=>a.visitor_id===b.visitor_id?Number(a.visited_at)-Number(b.visited_at):(a.visitor_id<b.visitor_id?-1:1));
  const journeys:string[][]=[];
  let current:string[]|null=null;let lastVisitor='';let lastAt=0;
  for(const row of ordered){
    const at=Number(row.visited_at);
    const pattern=routePattern(row.path);
    if(!current||row.visitor_id!==lastVisitor||at-lastAt>SESSION_GAP_MS){current=[];journeys.push(current);}
    if(current[current.length-1]!==pattern)current.push(pattern);
    lastVisitor=row.visitor_id;lastAt=at;
  }
  const kept=journeys.filter(journey=>journey.length);
  // Pro Stufe nur die häufigsten Seiten zeigen, der Rest wird gebündelt.
  const allowed:Array<Set<string>>=[];
  for(let step=0;step<steps;step++){
    const counts=new Map<string,number>();
    for(const journey of kept)if(journey[step])counts.set(journey[step],(counts.get(journey[step])||0)+1);
    allowed.push(new Set([...counts.entries()].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1)).slice(0,branches).map(([path])=>path)));
  }
  const label=(step:number,journey:string[])=>allowed[step].has(journey[step])?journey[step]:'Andere Seiten';
  const nodeCounts=new Map<string,FunnelNode>();
  const linkCounts=new Map<string,FunnelLink>();
  const exits=new Map<number,number>();
  const nodeId=(step:number,name:string)=>step+'|'+name;
  for(const journey of kept){
    for(let step=0;step<steps&&journey[step];step++){
      const name=label(step,journey);
      const id=nodeId(step,name);
      const node=nodeCounts.get(id)||{id,step,label:name,sessions:0};
      node.sessions+=1;nodeCounts.set(id,node);
      const continues=Boolean(journey[step+1])&&step+1<steps;
      const to=continues?nodeId(step+1,label(step+1,journey)):'exit|'+step;
      const key=id+'>'+to;
      const link=linkCounts.get(key)||{from:id,to,sessions:0,kind:continues?'continue' as const:'exit' as const};
      link.sessions+=1;linkCounts.set(key,link);
      if(!continues)exits.set(step,(exits.get(step)||0)+1);
    }
  }
  return {
    sessions:kept.length,
    steps,
    nodes:[...nodeCounts.values()].sort((a,b)=>a.step-b.step||b.sessions-a.sessions||(a.label<b.label?-1:1)),
    links:[...linkCounts.values()].sort((a,b)=>b.sessions-a.sessions),
    exits:[...exits.entries()].sort((a,b)=>a[0]-b[0]).map(([step,sessions])=>({step,sessions})),
  };
}
