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
export async function GET(request:Request) {if(!await publisherAuthorized(request))return Response.json({detail:'Nicht autorisiert.'},{status:401});if(!env.DB)return Response.json({detail:'Inhaltsdatenbank fehlt.'},{status:503});const slug=new URL(request.url).searchParams.get('slug');const row=slug?await env.DB.prepare('SELECT revision FROM articles WHERE slug=?').bind(slug).first<{revision:number}>():null;return Response.json({revision:row?.revision||0,contract_version:2,capabilities:{email_updates:true,company_news:true}});}
