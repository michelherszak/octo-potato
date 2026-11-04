'use client';
/* eslint-disable @next/next/no-img-element -- avatar host is configured at runtime by Supabase. */

import {useEffect,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {getSupabaseBrowserClient,publicAvatarUrl,type PublicSupabaseConfig} from '@/lib/supabase-browser';

function initials(user:User){
  const name=typeof user.user_metadata?.display_name==='string'?user.user_metadata.display_name.trim():'';
  if(name)return name.split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join('');
  return user.email?.slice(0,1).toUpperCase()||'U';
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
    {!ready?<span className="header-user-placeholder"/>:avatar?<img src={avatar} width="42" height="42" alt="" onError={()=>setImageFailed(true)}/>:user?<span className="header-user-initials" aria-hidden="true">{initials(user)}</span>:<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c.7-4 3.2-6 7.5-6s6.8 2 7.5 6"/></svg>}
  </a>;
}
