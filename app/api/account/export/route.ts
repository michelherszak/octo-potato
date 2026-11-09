import {env} from 'cloudflare:workers';
import {accountAudit,syncAccountProfile} from '@/lib/supabase-accounts';
import {authErrorResponse,AuthError,requireVerifiedSupabaseUser} from '@/lib/supabase-server';

export async function GET(request:Request){
  try{
    if(!env.DB)throw new AuthError('Kontodatenbank fehlt.',503,'database_unavailable');
    const user=await requireVerifiedSupabaseUser(request);
    const {profile}=await syncAccountProfile(env.DB,user,env.ADMIN_EMAILS);
    if(profile.status!=='active')throw new AuthError('Dieses Konto ist derzeit gesperrt.',403,'account_suspended');
    const {results:follows}=await env.DB.prepare('SELECT ticker,created_at FROM company_follows WHERE user_id=? ORDER BY created_at DESC').bind(user.id).all<{ticker:string;created_at:number}>();
    // Die Einwilligung gehört zu den gespeicherten Daten und damit in den Export.
    const consent=await env.DB.prepare('SELECT verified_at,general_news,consent_at,consent_version FROM subscribers WHERE email=?')
      .bind(profile.email).first<{verified_at:number|null;general_news:number;consent_at:number|null;consent_version:string|null}>();
    const emailUpdates=consent?{enabled:consent.consent_at!==null,allNewArticles:Boolean(consent.general_news),
      consentedAt:consent.consent_at,consentVersion:consent.consent_version}:{enabled:false};
    const body=JSON.stringify({exportedAt:new Date().toISOString(),profile,emailUpdates,follows:follows.map(row=>({ticker:row.ticker,followedAt:Number(row.created_at)})),audit:await accountAudit(env.DB,user.id)},null,2);
    return new Response(body,{headers:{'content-type':'application/json; charset=utf-8','content-disposition':'attachment; filename="techthese-kontodaten.json"','cache-control':'no-store'}});
  }catch(error){return authErrorResponse(error);}
}
