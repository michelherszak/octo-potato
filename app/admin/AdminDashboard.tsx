'use client';

import {useEffect,useState} from 'react';
import type {AccountProfile,AccountRole,AccountStatus} from '@/lib/supabase-accounts';
import type {AnalyticsDashboard} from '@/lib/analytics';
import VisitorFlow from './VisitorFlow';
import {getSupabaseBrowserClient,type PublicSupabaseConfig} from '@/lib/supabase-browser';
import AnalyticsExclusion from '@/app/AnalyticsExclusion';

type DashboardData={account:AccountProfile;analytics:AnalyticsDashboard;users:AccountProfile[]};
const dateTime=new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'});

export default function AdminDashboard({config}:{config:PublicSupabaseConfig}){
  const [data,setData]=useState<DashboardData|null>(null);const [token,setToken]=useState('');const [error,setError]=useState('');const [busyUser,setBusyUser]=useState('');
  async function load(accessToken:string){const response=await fetch('/api/admin/dashboard',{headers:{authorization:'Bearer '+accessToken}});if(response.status===401){location.replace('/login?next=/admin');return;}const payload=await response.json().catch(()=>null) as (DashboardData&{detail?:string})|null;if(!response.ok||!payload){setError(payload?.detail||'Das Dashboard konnte nicht geladen werden.');return;}setData(payload);}
  useEffect(()=>{(async()=>{if(!config.configured)return setError('Supabase ist noch nicht konfiguriert.');const {data:session}=await getSupabaseBrowserClient(config).auth.getSession();if(!session.session){location.replace('/login?next=/admin');return;}setToken(session.session.access_token);await load(session.session.access_token);})();},[config]);
  async function updateUser(userId:string,role:AccountRole,status:AccountStatus){setBusyUser(userId);setError('');const response=await fetch('/api/admin/dashboard',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({userId,role,status})});const payload=await response.json().catch(()=>null) as {detail?:string}|null;if(!response.ok)setError(payload?.detail||'Das Benutzerkonto konnte nicht geändert werden.');else await load(token);setBusyUser('');}
  if(!data)return <div className="admin-login"><p className="eyebrow">Geschützter Bereich</p><h1>Admin-Dashboard wird geladen …</h1>{error&&<div className="auth-message error">{error}</div>}</div>;
  const a=data.analytics;
  return <>
    <header className="admin-heading"><div><p className="eyebrow">TechThese intern</p><h1>Besucher & Benutzer</h1><p>Pseudonyme Seitenaufrufe und verifizierte Konten · Stand {dateTime.format(new Date())}</p></div><div className="admin-account"><span>{data.account.email}</span><a href="/konto">Mein Konto</a></div></header>
    {error&&<div className="auth-message error">{error}</div>}
    <section className="admin-stat-grid" aria-label="Besucherstatistik"><article><span>Heute aktiv</span><strong>{a.visitorsToday}</strong><small>Unique Visitors</small></article><article><span>Letzte 7 Tage</span><strong>{a.visitors7Days}</strong><small>Unique Visitors</small></article><article><span>Letzte 30 Tage</span><strong>{a.visitors30Days}</strong><small>Unique Visitors</small></article><article><span>Konten</span><strong>{data.users.length}</strong><small>Bestätigte Benutzer</small></article></section>
    <AnalyticsExclusion/>
    <section className="admin-users"><div className="section-title"><h2>Benutzerkonten</h2><span>{data.users.length} aktive oder gesperrte Konten</span></div><div className="admin-user-table"><div className="admin-user-row admin-page-head"><span>Konto</span><span>Rolle</span><span>Status</span><span>Letzte Anmeldung</span></div>{data.users.map(user=><div className="admin-user-row" key={user.userId}><span><strong>{user.displayName}</strong><small>{user.email}</small></span><select aria-label={'Rolle von '+user.email} value={user.role} disabled={busyUser===user.userId||user.userId===data.account.userId} onChange={event=>updateUser(user.userId,event.target.value as AccountRole,user.status)}><option value="user">User</option><option value="buyer">Buyer</option><option value="super_admin">Super Admin</option></select><select aria-label={'Status von '+user.email} value={user.status} disabled={busyUser===user.userId||user.userId===data.account.userId} onChange={event=>updateUser(user.userId,user.role,event.target.value as AccountStatus)}><option value="active">Aktiv</option><option value="suspended">Gesperrt</option></select><time>{dateTime.format(new Date(user.lastLoginAt))}</time></div>)}</div></section>
    <section className="admin-visitors" aria-labelledby="visitor-title"><div className="section-title"><h2 id="visitor-title">Besucher und Seitenverlauf</h2><span>Einstieg und Absprung über alle Besuche</span></div><VisitorFlow funnel={a.funnel}/></section>
  </>;
}
