'use client';

import {useEffect,useState} from 'react';
import {getSupabaseBrowserClient,type PublicSupabaseConfig} from '@/lib/supabase-browser';

export default function FollowButton({ticker,company,config}:{ticker:string;company:string;config:PublicSupabaseConfig}){
  const [followed,setFollowed]=useState(false);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{(async()=>{
    if(!config.configured){setReady(true);return;}
    const {data}=await getSupabaseBrowserClient(config).auth.getSession();
    if(!data.session){setReady(true);return;}
    const response=await fetch('/api/follows?ticker='+encodeURIComponent(ticker),{headers:{authorization:'Bearer '+data.session.access_token}});
    if(response.ok){const payload=await response.json() as {followed:boolean};setFollowed(payload.followed);}
    setReady(true);
  })();},[config,ticker]);

  async function toggle(){
    setError('');
    const next='/unternehmen/'+encodeURIComponent(ticker);
    if(!config.configured){location.assign('/login?next='+encodeURIComponent(next));return;}
    const supabase=getSupabaseBrowserClient(config);
    const {data}=await supabase.auth.getSession();
    if(!data.session){location.assign('/login?next='+encodeURIComponent(next));return;}
    setBusy(true);
    const response=await fetch('/api/follows',{method:followed?'DELETE':'POST',headers:{'content-type':'application/json',authorization:'Bearer '+data.session.access_token},body:JSON.stringify({ticker})});
    if(response.status===401){await supabase.auth.signOut({scope:'local'});location.assign('/login?next='+encodeURIComponent(next));return;}
    const payload=await response.json().catch(()=>null) as {followed?:boolean;detail?:string}|null;
    if(!response.ok||typeof payload?.followed!=='boolean')setError(payload?.detail||'Die Auswahl konnte nicht gespeichert werden.');
    else setFollowed(payload.followed);
    setBusy(false);
  }

  return <div className="company-follow-control"><button type="button" className={'company-follow-button '+(followed?'is-following':'')} aria-pressed={followed} aria-label={(followed?'Nicht mehr folgen: ':'Folgen: ')+company} disabled={busy||!ready} onClick={toggle}>{busy?'Wird gespeichert …':followed?'✓ Gefolgt':'+ Folgen'}</button>{error&&<span role="status">{error}</span>}</div>;
}
