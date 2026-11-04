import AuthPortal from './AuthPortal';
import {getPublicSupabaseConfig} from '@/lib/supabase-server';

export const dynamic='force-dynamic';
export const metadata={title:'Login & Konto – TechThese',robots:{index:false,follow:false}};

export default function LoginPage(){return <main id="inhalt" className="container"><AuthPortal config={getPublicSupabaseConfig()}/></main>;}
