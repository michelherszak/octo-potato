import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {accountAudit,listFollows,recordAuthEvent,syncAccountProfile} from '@/lib/supabase-accounts';
import {authErrorResponse,AuthError,getSupabaseAdminClient,requireSameOrigin,requireVerifiedSupabaseUser} from '@/lib/supabase-server';
import {companyCatalog} from '@/lib/content';

const profileSchema=z.object({
  displayName:z.string().trim().min(2).max(80).optional(),
  avatarPath:z.string().max(180).nullable().optional(),
}).strict().refine(value=>value.displayName!==undefined||value.avatarPath!==undefined);
const deleteSchema=z.object({confirmation:z.literal('KONTO LÖSCHEN')}).strict();
const noStore={'cache-control':'no-store'};

async function authenticated(request:Request){
  if(!env.DB)throw new AuthError('Kontodatenbank fehlt.',503,'database_unavailable');
  const user=await requireVerifiedSupabaseUser(request);
  const synced=await syncAccountProfile(env.DB,user,env.ADMIN_EMAILS);
  if(synced.profile.status!=='active')throw new AuthError('Dieses Konto ist derzeit gesperrt.',403,'account_suspended');
  return {user,...synced};
}

export async function GET(request:Request){
  try{
    const {profile}=await authenticated(request);
    const [audit,follows,catalog]=await Promise.all([accountAudit(env.DB!,profile.userId),listFollows(env.DB!,profile.userId),companyCatalog()]);
    const names=new Map(catalog.map(company=>[company.ticker,company.name] as const));
    return Response.json({profile,audit,follows:follows.map(follow=>({...follow,name:names.get(follow.ticker)||follow.ticker}))},{headers:noStore});
  }catch(error){return authErrorResponse(error);}
}

export async function POST(request:Request){
  try{
    requireSameOrigin(request);
    const {profile,created}=await authenticated(request);
    await recordAuthEvent(env.DB!,profile.userId,created?'account_verified':'signed_in');
    return Response.json({profile},{headers:noStore});
  }catch(error){return authErrorResponse(error);}
}

export async function PATCH(request:Request){
  try{
    requireSameOrigin(request);
    const {profile}=await authenticated(request);
    let body:unknown;
    try{body=await request.json();}catch{throw new AuthError('Ungültige Anfrage.',400,'invalid_json');}
    const parsed=profileSchema.safeParse(body);
    if(!parsed.success)throw new AuthError('Ungültige Profildaten.',400,'invalid_profile');
    if(parsed.data.avatarPath!==undefined&&parsed.data.avatarPath!==null&&parsed.data.avatarPath!==`${profile.userId}/avatar`)throw new AuthError('Ungültiger Profilbildpfad.',400,'invalid_avatar_path');
    const now=Date.now();
    const updates=[];
    if(parsed.data.displayName!==undefined)updates.push(env.DB!.prepare('UPDATE user_profiles SET display_name=?,updated_at=? WHERE user_id=?').bind(parsed.data.displayName,now,profile.userId));
    if(parsed.data.avatarPath!==undefined)updates.push(env.DB!.prepare('UPDATE user_profiles SET avatar_path=?,updated_at=? WHERE user_id=?').bind(parsed.data.avatarPath,now,profile.userId));
    await env.DB!.batch(updates);
    await recordAuthEvent(env.DB!,profile.userId,parsed.data.avatarPath!==undefined?'avatar_updated':'profile_updated');
    return Response.json({profile:{...profile,...(parsed.data.displayName!==undefined?{displayName:parsed.data.displayName}:{}),...(parsed.data.avatarPath!==undefined?{avatarPath:parsed.data.avatarPath}:{}),updatedAt:now}},{headers:noStore});
  }catch(error){return authErrorResponse(error);}
}

export async function DELETE(request:Request){
  try{
    requireSameOrigin(request);
    const {user,profile}=await authenticated(request);
    const parsed=deleteSchema.safeParse(await request.json());
    if(!parsed.success)throw new AuthError('Die Löschbestätigung stimmt nicht.',400,'invalid_confirmation');
    if(profile.role==='super_admin')throw new AuthError('Ein Super-Admin-Konto muss zuerst von einem anderen Super Admin herabgestuft werden.',409,'admin_deletion_blocked');
    const admin=getSupabaseAdminClient();
    if(profile.avatarPath){const {error:storageError}=await admin.storage.from('avatars').remove([profile.avatarPath]);if(storageError)throw new Error(storageError.message);}
    const {error}=await admin.auth.admin.deleteUser(user.id);
    if(error)throw new Error(error.message);
    const now=Date.now();
    await env.DB!.batch([
      env.DB!.prepare(`UPDATE user_profiles SET email=?,display_name='Gelöschtes Konto',avatar_path=NULL,status='deleted',updated_at=?,deleted_at=? WHERE user_id=?`)
        .bind(`deleted-${user.id}@deleted.invalid`,now,now,user.id),
      env.DB!.prepare('DELETE FROM company_follows WHERE user_id=?').bind(user.id),
      env.DB!.prepare('DELETE FROM auth_audit_log WHERE user_id=?').bind(user.id),
      env.DB!.prepare(`INSERT INTO auth_audit_log (user_id,event,detail,created_at) VALUES (NULL,'account_deleted','{}',?)`).bind(now),
    ]);
    return new Response(null,{status:204,headers:noStore});
  }catch(error){return authErrorResponse(error);}
}
