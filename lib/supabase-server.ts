import {env} from 'cloudflare:workers';
import {createClient, type User} from '@supabase/supabase-js';
import type {PublicSupabaseConfig} from '@/lib/supabase-browser';

export class AuthError extends Error{
  constructor(message:string,public status=401,public code='unauthorized'){super(message);}
}

export function getPublicSupabaseConfig():PublicSupabaseConfig{
  const url=(env.SUPABASE_URL||'').trim();
  const publishableKey=(env.SUPABASE_PUBLISHABLE_KEY||'').trim();
  return {url,publishableKey,configured:Boolean(url&&publishableKey)};
}

function serverClient(){
  const config=getPublicSupabaseConfig();
  if(!config.configured)throw new AuthError('Die Anmeldung ist noch nicht konfiguriert.',503,'auth_not_configured');
  return createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}

export async function requireVerifiedSupabaseUser(request:Request):Promise<User>{
  const authorization=request.headers.get('authorization')||'';
  const token=authorization.startsWith('Bearer ')?authorization.slice(7).trim():'';
  if(!token)throw new AuthError('Bitte melde dich an.',401,'missing_session');
  const {data,error}=await serverClient().auth.getUser(token);
  if(error||!data.user)throw new AuthError('Die Sitzung ist ungültig oder abgelaufen.',401,'invalid_session');
  if(!data.user.email||!data.user.email_confirmed_at)throw new AuthError('Bitte bestätige zuerst deine E-Mail-Adresse.',403,'email_not_verified');
  return data.user;
}

export function requireSameOrigin(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)throw new AuthError('Fremde Herkunft abgewiesen.',403,'invalid_origin');
}

export function authErrorResponse(error:unknown){
  if(error instanceof AuthError)return Response.json({detail:error.message,code:error.code},{status:error.status,headers:{'cache-control':'no-store'}});
  console.error('Auth request failed',error);
  return Response.json({detail:'Die Anfrage konnte nicht verarbeitet werden.',code:'internal_error'},{status:500,headers:{'cache-control':'no-store'}});
}

export function getSupabaseAdminClient(){
  const url=(env.SUPABASE_URL||'').trim();
  const serviceRoleKey=(env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
  if(!url||!serviceRoleKey)throw new AuthError('Die serverseitige Kontoverwaltung ist noch nicht konfiguriert.',503,'admin_auth_not_configured');
  return createClient(url,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
