import ConfirmAccount from './ConfirmAccount';
import {getPublicSupabaseConfig} from '@/lib/supabase-server';
export const dynamic='force-dynamic';
export const metadata={title:'E-Mail bestätigen – TechThese',robots:{index:false,follow:false}};
export default function ConfirmPage(){return <ConfirmAccount config={getPublicSupabaseConfig()}/>;}
