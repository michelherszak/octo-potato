import {env} from 'cloudflare:workers';
import {importSchema} from '@/lib/contract';
import {siteUrl} from '@/lib/content';
import {importArticle,ImportConflict} from '@/lib/import-service';
import {publisherAuthorized,readLimitedJson} from '@/lib/publish-auth';
export async function POST(request:Request) {
  if(!await publisherAuthorized(request))return Response.json({detail:'Veröffentlichung nicht autorisiert.'},{status:401});
  if(!env.DB)return Response.json({detail:'Inhaltsdatenbank fehlt.'},{status:503});
  const body=await readLimitedJson(request,400000);
  if(!body.ok)return Response.json({detail:body.detail},{status:body.status});
  const parsed=importSchema.safeParse(body.value);if(!parsed.success)return Response.json({detail:parsed.error.flatten()},{status:422});
  try{const result=await importArticle(env.DB,parsed.data,siteUrl());return Response.json(result,{status:result.idempotent?200:201});}
  catch(error){if(error instanceof ImportConflict)return Response.json({detail:error.message},{status:409});throw error;}
}
export async function GET(request:Request) {
  if(!await publisherAuthorized(request))return Response.json({detail:'Nicht autorisiert.'},{status:401});
  if(!env.DB)return Response.json({detail:'Inhaltsdatenbank fehlt.'},{status:503});
  const params=new URL(request.url).searchParams;
  const capabilities={email_updates:true,company_news:true,article_series:true};
  // Bestehende Analysen eines Unternehmens, damit der Publisher zwischen neuem Beitrag und Aktualisierung wählen kann.
  const ticker=(params.get('ticker')||'').trim().toUpperCase();
  if(ticker){
    if(!/^[A-Z0-9.-]{1,30}$/.test(ticker))return Response.json({detail:'Ungültiges Börsenkürzel.'},{status:400});
    const {results}=await env.DB.prepare(`SELECT slug,revision,json_extract(payload,'$.title') AS title,
      json_extract(payload,'$.published_at') AS published_at,json_extract(payload,'$.updated_at') AS updated_at
      FROM articles WHERE json_extract(payload,'$.ticker')=? AND COALESCE(json_extract(payload,'$.example'),0)=0
      ORDER BY json_extract(payload,'$.published_at') DESC`).bind(ticker).all<{slug:string;revision:number;title:string;published_at:string|null;updated_at:string|null}>();
    return Response.json({ticker,articles:results,contract_version:2,capabilities});
  }
  const slug=params.get('slug');
  const row=slug?await env.DB.prepare('SELECT revision FROM articles WHERE slug=?').bind(slug).first<{revision:number}>():null;
  return Response.json({revision:row?.revision||0,contract_version:2,capabilities});
}
