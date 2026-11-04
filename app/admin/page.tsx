import AdminDashboard from './AdminDashboard';
import {getPublicSupabaseConfig} from '@/lib/supabase-server';
export const dynamic='force-dynamic';
export const metadata={title:'Admin-Dashboard – TechThese',robots:{index:false,follow:false}};
export default function AdminPage(){return <main id="inhalt" className="container admin-dashboard"><AdminDashboard config={getPublicSupabaseConfig()}/></main>;}
