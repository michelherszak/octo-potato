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

export type AnalyticsVisitor={
  visitorId:string;
  firstSeenAt:number;
  lastSeenAt:number;
  pageCount:number;
  pages:Array<{path:string;title:string;visitedAt:number}>;
};

export type AnalyticsDashboard={
  visitorsToday:number;
  visitors7Days:number;
  visitors30Days:number;
  visitorsTotal:number;
  pageViews30Days:number;
  visitors:AnalyticsVisitor[];
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
  const {results:visitorRows}=await db.prepare(`SELECT
    v.visitor_id, v.first_seen_at, v.last_seen_at, COUNT(p.id) AS page_count
    FROM analytics_visitors v
    LEFT JOIN analytics_page_views p ON p.visitor_id=v.visitor_id
    GROUP BY v.visitor_id, v.first_seen_at, v.last_seen_at
    ORDER BY v.last_seen_at DESC
    LIMIT 100`).all<{visitor_id:string;first_seen_at:number;last_seen_at:number;page_count:number}>();
  const {results:pageRows}=await db.prepare(`SELECT visitor_id, path, title, visited_at
    FROM analytics_page_views ORDER BY visited_at DESC LIMIT 2000`).all<{visitor_id:string;path:string;title:string;visited_at:number}>();
  const pagesByVisitor=new Map<string,AnalyticsVisitor['pages']>();
  for(const row of pageRows){
    const pages=pagesByVisitor.get(row.visitor_id)||[];
    if(pages.length<30)pages.push({path:row.path,title:row.title,visitedAt:row.visited_at});
    pagesByVisitor.set(row.visitor_id,pages);
  }
  return {
    visitorsToday:Number(visitorCounts?.today||0),
    visitors7Days:Number(visitorCounts?.seven_days||0),
    visitors30Days:Number(visitorCounts?.thirty_days||0),
    visitorsTotal:Number(visitorCounts?.total||0),
    pageViews30Days:Number(pageCounts?.total||0),
    visitors:visitorRows.map(row=>({
      visitorId:row.visitor_id,
      firstSeenAt:Number(row.first_seen_at),
      lastSeenAt:Number(row.last_seen_at),
      pageCount:Number(row.page_count),
      pages:pagesByVisitor.get(row.visitor_id)||[],
    })),
  };
}
