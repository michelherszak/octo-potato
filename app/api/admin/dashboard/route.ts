import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getAnalyticsDashboard} from '@/lib/analytics';
import {listAccounts,recordAuthEvent,syncAccountProfile} from '@/lib/supabase-accounts';
import {authErrorResponse,AuthError,requireSameOrigin,requireVerifiedSupabaseUser} from '@/lib/supabase-server';

const mutationSchema=z.object({
  userId:z.string().uuid(),
  role:z.enum(['user','buyer','super_admin']),
  status:z.enum(['active','suspended']),
}).strict();

async function requireAdmin(request:Request){
  if(!env.DB)throw new AuthError('Datenbank fehlt.',503,'database_unavailable');
  const user=await requireVerifiedSupabaseUser(request);
  const {profile}=await syncAccountProfile(env.DB,user,env.ADMIN_EMAILS);
  if(profile.status!=='active')throw new AuthError('Dieses Konto ist gesperrt.',403,'account_suspended');
  if(profile.role!=='super_admin')throw new AuthError('Für diesen Bereich fehlen die Super-Admin-Rechte.',403,'admin_required');
  return {user,profile};
}

export async function GET(request:Request){
  try{
    const {profile}=await requireAdmin(request);
    const [analytics,users]=await Promise.all([getAnalyticsDashboard(env.DB!),listAccounts(env.DB!)]);
    return Response.json({account:profile,analytics,users},{headers:{'cache-control':'no-store'}});
  }catch(error){return authErrorResponse(error);}
}

export async function PATCH(request:Request){
  try{
    requireSameOrigin(request);
    const {user}=await requireAdmin(request);
    const parsed=mutationSchema.safeParse(await request.json());
    if(!parsed.success)throw new AuthError('Ungültige Benutzeränderung.',400,'invalid_user_change');
    if(parsed.data.userId===user.id)throw new AuthError('Die eigenen Rechte können hier nicht geändert werden.',409,'self_change_blocked');
    const target=await env.DB!.prepare('SELECT user_id FROM user_profiles WHERE user_id=? AND status != ?')
      .bind(parsed.data.userId,'deleted').first<{user_id:string}>();
    if(!target)throw new AuthError('Benutzerkonto nicht gefunden.',404,'user_not_found');
    await env.DB!.prepare('UPDATE user_profiles SET role=?,status=?,updated_at=? WHERE user_id=?')
      .bind(parsed.data.role,parsed.data.status,Date.now(),parsed.data.userId).run();
    await recordAuthEvent(env.DB!,user.id,'admin_user_changed',{targetUserId:parsed.data.userId,role:parsed.data.role,status:parsed.data.status});
    return Response.json({ok:true},{headers:{'cache-control':'no-store'}});
  }catch(error){return authErrorResponse(error);}
}
