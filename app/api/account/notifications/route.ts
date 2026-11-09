import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {recordAuthEvent,syncAccountProfile} from '@/lib/supabase-accounts';
import {disableEmailUpdates,emailUpdateStatus,enableEmailUpdates} from '@/lib/follow-updates';
import {authErrorResponse,AuthError,requireSameOrigin,requireVerifiedSupabaseUser} from '@/lib/supabase-server';

// enabled:true ist die ausdrückliche Einwilligung; sie entsteht nur durch eine Handlung im Konto.
const bodySchema=z.object({enabled:z.boolean(),generalNews:z.boolean().default(false)}).strict();
const noStore={'cache-control':'no-store'};

async function authenticated(request:Request){
  if(!env.DB)throw new AuthError('Kontodatenbank fehlt.',503,'database_unavailable');
  const user=await requireVerifiedSupabaseUser(request);
  const {profile}=await syncAccountProfile(env.DB,user,env.ADMIN_EMAILS);
  if(profile.status!=='active')throw new AuthError('Dieses Konto ist derzeit gesperrt.',403,'account_suspended');
  return {user,profile};
}

export async function GET(request:Request){
  try{
    const {profile}=await authenticated(request);
    return Response.json(await emailUpdateStatus(env.DB!,profile.email),{headers:noStore});
  }catch(error){return authErrorResponse(error);}
}

export async function PUT(request:Request){
  try{
    requireSameOrigin(request);
    const {user,profile}=await authenticated(request);
    let body:unknown;
    try{body=await request.json();}catch{throw new AuthError('Ungültige Anfrage.',400,'invalid_json');}
    const parsed=bodySchema.safeParse(body);
    if(!parsed.success)throw new AuthError('Ungültige Auswahl.',400,'invalid_preferences');
    if(parsed.data.enabled)await enableEmailUpdates(env.DB!,user.id,profile.email,parsed.data.generalNews);
    else await disableEmailUpdates(env.DB!,profile.email);
    await recordAuthEvent(env.DB!,user.id,parsed.data.enabled?'email_updates_enabled':'email_updates_disabled',{generalNews:parsed.data.generalNews});
    return Response.json(await emailUpdateStatus(env.DB!,profile.email),{headers:noStore});
  }catch(error){return authErrorResponse(error);}
}
