'use client';

import {useEffect,useState} from 'react';
import {getSupabaseBrowserClient,type PublicSupabaseConfig} from '@/lib/supabase-browser';

export default function ConfirmAccount({config}:{config:PublicSupabaseConfig}){
  const [state,setState]=useState<'working'|'done'|'error'>('working');
  useEffect(()=>{(async()=>{
    if(!config.configured)return setState('error');
    const supabase=getSupabaseBrowserClient(config);
    const {data}=await supabase.auth.getSession();
    if(!data.session||!data.session.user.email_confirmed_at)return setState('error');
    const response=await fetch('/api/account',{method:'POST',headers:{authorization:'Bearer '+data.session.access_token}});
    if(!response.ok)return setState('error');
    setState('done');setTimeout(()=>location.replace('/konto?verified=1'),900);
  })();},[config]);
  return <main id="inhalt" className="container narrow auth-result"><p className="eyebrow">E-Mail-Bestätigung</p><h1>{state==='working'?'Wir bestätigen dein Konto …':state==='done'?'Dein Konto ist bestätigt.':'Der Link konnte nicht bestätigt werden.'}</h1><p>{state==='working'?'Bitte schließe dieses Fenster noch nicht.':state==='done'?'Du wirst gleich zu deinem Konto weitergeleitet.':'Der Link ist möglicherweise abgelaufen oder wurde bereits verwendet. Fordere auf der Login-Seite einen neuen Link an.'}</p>{state==='error'&&<a className="admin-primary-link" href="/login">Zur Login-Seite ↗</a>}</main>;
}
