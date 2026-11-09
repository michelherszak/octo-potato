'use client';

import {useEffect,useState} from 'react';
import {getSupabaseBrowserClient,type PublicSupabaseConfig} from '@/lib/supabase-browser';

type FollowState={followed?:boolean;emailUpdates?:boolean;detail?:string};

export default function FollowButton({ticker,company,config}:{ticker:string;company:string;config:PublicSupabaseConfig}){
  const [followed,setFollowed]=useState(false);
  const [emailUpdates,setEmailUpdates]=useState(false);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{(async()=>{
    if(!config.configured){setReady(true);return;}
    const {data}=await getSupabaseBrowserClient(config).auth.getSession();
    if(!data.session){setReady(true);return;}
    const response=await fetch('/api/follows?ticker='+encodeURIComponent(ticker),{headers:{authorization:'Bearer '+data.session.access_token}});
    if(response.ok){const payload=await response.json() as FollowState;setFollowed(Boolean(payload.followed));setEmailUpdates(Boolean(payload.emailUpdates));}
    setReady(true);
  })();},[config,ticker]);

  async function session(){
    const next=location.pathname;
    if(!config.configured){location.assign('/login?next='+encodeURIComponent(next));return null;}
    const supabase=getSupabaseBrowserClient(config);
    const {data}=await supabase.auth.getSession();
    if(!data.session){location.assign('/login?next='+encodeURIComponent(next));return null;}
    return {supabase,token:data.session.access_token,next};
  }

  async function toggle(){
    setError('');
    const current=await session();
    if(!current)return;
    setBusy(true);
    const response=await fetch('/api/follows',{method:followed?'DELETE':'POST',headers:{'content-type':'application/json',authorization:'Bearer '+current.token},body:JSON.stringify({ticker})});
    if(response.status===401){await current.supabase.auth.signOut({scope:'local'});location.assign('/login?next='+encodeURIComponent(current.next));return;}
    const payload=await response.json().catch(()=>null) as FollowState|null;
    if(!response.ok||typeof payload?.followed!=='boolean')setError(payload?.detail||'Die Auswahl konnte nicht gespeichert werden.');
    else{setFollowed(payload.followed);setEmailUpdates(Boolean(payload.emailUpdates));}
    setBusy(false);
  }

  // Die Einwilligung entsteht nur durch diesen ausdrücklichen Klick, nie durch das Folgen allein.
  async function enableMail(){
    setError('');
    const current=await session();
    if(!current)return;
    setBusy(true);
    const response=await fetch('/api/account/notifications',{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer '+current.token},body:JSON.stringify({enabled:true,generalNews:false})});
    const payload=await response.json().catch(()=>null) as {enabled?:boolean;detail?:string}|null;
    if(!response.ok)setError(payload?.detail||'Die E-Mail-Benachrichtigung konnte nicht aktiviert werden.');
    else setEmailUpdates(Boolean(payload?.enabled));
    setBusy(false);
  }

  return <div className="company-follow-control">
    <button type="button" className={'company-follow-button '+(followed?'is-following':'')} aria-pressed={followed} aria-label={(followed?'Nicht mehr folgen: ':'Folgen: ')+company} disabled={busy||!ready} onClick={toggle}>{busy?'Wird gespeichert …':followed?'✓ Gefolgt':'+ Folgen'}</button>
    {followed&&!emailUpdates&&<div className="follow-mail-offer" role="group" aria-label="E-Mail-Benachrichtigung">
      <p>Neue Beiträge zu {company} auch per E-Mail erhalten?</p>
      <button type="button" disabled={busy} onClick={enableMail}>Ja, per E-Mail benachrichtigen</button>
      <small>An die Adresse deines Kontos, für alle Unternehmen, denen du folgst. Jederzeit im Konto abschaltbar. <a href="/rechtliches#email-updates">Datenschutz</a></small>
    </div>}
    {followed&&emailUpdates&&<p className="follow-mail-active" role="status">✓ Neue Beiträge zu {company} kommen per E-Mail.</p>}
    {error&&<span role="status">{error}</span>}
  </div>;
}
