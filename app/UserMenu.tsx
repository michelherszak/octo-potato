'use client';
/* eslint-disable @next/next/no-img-element -- avatar host is configured at runtime by Supabase. */

import {useEffect,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {getSupabaseBrowserClient,publicAvatarUrl,type PublicSupabaseConfig} from '@/lib/supabase-browser';

// Abgemeldet: offene Silhouette. Angemeldet: gefüllte Silhouette mit Haken.
function GuestIcon(){
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4.5 20c.7-4 3.2-6 7.5-6s6.8 2 7.5 6"/>
  </svg>;
}

function MemberIcon(){
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none">
    <circle cx="11" cy="7.5" r="4"/>
    <path d="M3.5 20c.7-4 3-6 7.5-6 1.2 0 2.2.1 3.1.4A5.6 5.6 0 0 0 18 20Z"/>
    <path d="M18.4 11.6a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm2.3 3.7-2.7 3a.9.9 0 0 1-1.3.05l-1.3-1.2a.85.85 0 1 1 1.15-1.25l.63.58 2.11-2.33a.85.85 0 1 1 1.26 1.14Z"/>
  </svg>;
}

export default function UserMenu({config}:{config:PublicSupabaseConfig}){
  const [user,setUser]=useState<User|null>(null);
  const [ready,setReady]=useState(!config.configured);
  const [imageFailed,setImageFailed]=useState(false);
  useEffect(()=>{
    if(!config.configured)return;
    const supabase=getSupabaseBrowserClient(config);
    void supabase.auth.getSession().then(({data})=>{setUser(data.session?.user||null);setReady(true);});
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user||null);setImageFailed(false);setReady(true);});
    return ()=>listener.subscription.unsubscribe();
  },[config]);
  const client=config.configured&&user?getSupabaseBrowserClient(config):null;
  const avatar=client&&user&&!imageFailed?publicAvatarUrl(client,user.id,user.user_metadata?.avatar_path,user.user_metadata?.avatar_updated_at):null;
  const label=user?`Konto von ${user.user_metadata?.display_name||user.email}`:'Anmelden';
  return <a className={'header-user '+(user?'is-authenticated':'')} href={user?'/konto':'/login'} aria-label={label} title={label}>
    {!ready?<span className="header-user-placeholder"/>:avatar?<img src={avatar} width="42" height="42" alt="" onError={()=>setImageFailed(true)}/>:user?<MemberIcon/>:<GuestIcon/>}
  </a>;
}
