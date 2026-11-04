import AccountClient from './AccountClient';
import {getPublicSupabaseConfig} from '@/lib/supabase-server';
export const dynamic='force-dynamic';
export const metadata={title:'Mein Konto – TechThese',robots:{index:false,follow:false}};
export default function AccountPage(){return <main id="inhalt" className="container"><AccountClient config={getPublicSupabaseConfig()}/></main>;}
