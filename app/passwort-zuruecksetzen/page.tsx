import ResetPassword from './ResetPassword';
import {getPublicSupabaseConfig} from '@/lib/supabase-server';
export const dynamic='force-dynamic';
export const metadata={title:'Passwort zurücksetzen – TechThese',robots:{index:false,follow:false}};
export default function ResetPasswordPage(){return <ResetPassword config={getPublicSupabaseConfig()}/>;}
