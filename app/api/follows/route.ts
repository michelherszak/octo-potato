import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {recordAuthEvent,syncAccountProfile} from '@/lib/supabase-accounts';
import {companyCatalog} from '@/lib/content';
import {authErrorResponse,AuthError,requireSameOrigin,requireVerifiedSupabaseUser} from '@/lib/supabase-server';

const tickerSchema=z.string().trim().toUpperCase().min(1).max(16).regex(/^[A-Z0-9.-]+$/);
const bodySchema=z.object({ticker:tickerSchema}).strict();
const noStore={'cache-control':'no-store'};

async function authenticated(request:Request){
  if(!env.DB)throw new AuthError('Kontodatenbank fehlt.',503,'database_unavailable');
  const user=await requireVerifiedSupabaseUser(request);
  const {profile}=await syncAccountProfile(env.DB,user,env.ADMIN_EMAILS);
  if(profile.status!=='active')throw new AuthError('Dieses Konto ist derzeit gesperrt.',403,'account_suspended');
  return {user,profile};
}

async function knownTicker(value:unknown){
  const parsed=tickerSchema.safeParse(value);
  if(!parsed.success)throw new AuthError('Ungültiges Unternehmen.',400,'invalid_ticker');
  const exists=(await companyCatalog()).some(company=>company.ticker===parsed.data);
  if(!exists)throw new AuthError('Unternehmen nicht gefunden.',404,'company_not_found');
  return parsed.data;
}

export async function GET(request:Request){
  try{
    const {user}=await authenticated(request);
    const ticker=await knownTicker(new URL(request.url).searchParams.get('ticker'));
    const row=await env.DB!.prepare('SELECT 1 AS followed FROM company_follows WHERE user_id=? AND ticker=?')
      .bind(user.id,ticker).first<{followed:number}>();
    return Response.json({ticker,followed:Boolean(row)},{headers:noStore});
  }catch(error){return authErrorResponse(error);}
}

async function bodyTicker(request:Request){
  let body:unknown;
  try{body=await request.json();}catch{throw new AuthError('Ungültige Anfrage.',400,'invalid_json');}
  const parsed=bodySchema.safeParse(body);
  if(!parsed.success)throw new AuthError('Ungültiges Unternehmen.',400,'invalid_ticker');
  return knownTicker(parsed.data.ticker);
}

export async function POST(request:Request){
  try{
    requireSameOrigin(request);
    const {user}=await authenticated(request);
    const ticker=await bodyTicker(request);
    const result=await env.DB!.prepare('INSERT INTO company_follows (user_id,ticker,created_at) VALUES (?,?,?) ON CONFLICT(user_id,ticker) DO NOTHING')
      .bind(user.id,ticker,Date.now()).run();
    if(Number(result.meta.changes)>0)await recordAuthEvent(env.DB!,user.id,'company_followed',{ticker});
    return Response.json({ticker,followed:true},{headers:noStore});
  }catch(error){return authErrorResponse(error);}
}

export async function DELETE(request:Request){
  try{
    requireSameOrigin(request);
    const {user}=await authenticated(request);
    const ticker=await bodyTicker(request);
    const result=await env.DB!.prepare('DELETE FROM company_follows WHERE user_id=? AND ticker=?').bind(user.id,ticker).run();
    if(Number(result.meta.changes)>0)await recordAuthEvent(env.DB!,user.id,'company_unfollowed',{ticker});
    return Response.json({ticker,followed:false},{headers:noStore});
  }catch(error){return authErrorResponse(error);}
}
