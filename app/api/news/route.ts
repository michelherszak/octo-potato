import {env} from 'cloudflare:workers';
import {newsDigestSchema} from '@/lib/contract';
import {NewsConflict,storeNewsDigest} from '@/lib/news';
import {publisherAuthorized,readLimitedJson} from '@/lib/publish-auth';

// Meldungs-Digests aus dem privaten Publisher. Gleiche Prüfung wie bei Beiträgen.
export async function POST(request:Request){
  if(!await publisherAuthorized(request))return Response.json({detail:'Veröffentlichung nicht autorisiert.'},{status:401});
  if(!env.DB)return Response.json({detail:'Inhaltsdatenbank fehlt.'},{status:503});
  const body=await readLimitedJson(request,120000);
  if(!body.ok)return Response.json({detail:body.detail},{status:body.status});
  const parsed=newsDigestSchema.safeParse(body.value);
  if(!parsed.success)return Response.json({detail:parsed.error.flatten()},{status:422});
  try{
    const result=await storeNewsDigest(env.DB,parsed.data);
    return Response.json(result,{status:result.idempotent?200:201});
  }catch(error){
    if(error instanceof NewsConflict)return Response.json({detail:error.message},{status:409});
    throw error;
  }
}
