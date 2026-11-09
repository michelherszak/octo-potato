'use client';
/* eslint-disable @next/next/no-img-element -- avatar host is configured at runtime by Supabase. */

import {FormEvent,useEffect,useState} from 'react';
import type {AccountProfile} from '@/lib/supabase-accounts';
import {AVATAR_BUCKET,getSupabaseBrowserClient,publicAvatarUrl,type PublicSupabaseConfig} from '@/lib/supabase-browser';
import PasswordField from '../PasswordField';

type AuditEntry={event:string;detail:Record<string,unknown>;createdAt:number};
type Follow={ticker:string;name:string;createdAt:number};
type EmailUpdates={enabled:boolean;generalNews:boolean};
type AccountData={profile:AccountProfile;audit:AuditEntry[];follows:Follow[];emailUpdates:EmailUpdates};
const dateTime=new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'});
const eventNames:Record<string,string>={account_verified:'Konto bestätigt',signed_in:'Angemeldet',profile_updated:'Profil aktualisiert',password_changed:'Passwort geändert',email_change_requested:'E-Mail-Änderung angefordert',company_followed:'Unternehmen gefolgt',company_unfollowed:'Unternehmen nicht mehr gefolgt',email_updates_enabled:'E-Mail-Benachrichtigung aktiviert',email_updates_disabled:'E-Mail-Benachrichtigung deaktiviert'};

export default function AccountClient({config}:{config:PublicSupabaseConfig}){
  const [data,setData]=useState<AccountData|null>(null);
  const [token,setToken]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [newEmail,setNewEmail]=useState('');
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [avatarUrl,setAvatarUrl]=useState<string|null>(null);
  const [deleteText,setDeleteText]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<{kind:'error'|'success';text:string}|null>(null);

  useEffect(()=>{(async()=>{
    if(!config.configured)return setMessage({kind:'error',text:'Supabase ist noch nicht konfiguriert.'});
    const supabase=getSupabaseBrowserClient(config);
    const {data:sessionData}=await supabase.auth.getSession();
    if(!sessionData.session){location.replace('/login?next=/konto');return;}
    const accessToken=sessionData.session.access_token;setToken(accessToken);
    const response=await fetch('/api/account',{headers:{authorization:'Bearer '+accessToken}});
    if(response.status===401){location.replace('/login?next=/konto');return;}
    if(!response.ok){const payload=await response.json().catch(()=>null) as {detail?:string}|null;return setMessage({kind:'error',text:payload?.detail||'Das Konto konnte nicht geladen werden.'});}
    const account=await response.json() as AccountData;setData(account);setDisplayName(account.profile.displayName);setNewEmail(account.profile.email);setAvatarUrl(publicAvatarUrl(supabase,sessionData.session.user.id,sessionData.session.user.user_metadata?.avatar_path,sessionData.session.user.user_metadata?.avatar_updated_at));
  })();},[config]);

  async function uploadAvatar(file:File){
    setMessage(null);
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))return setMessage({kind:'error',text:'Erlaubt sind ausschließlich JPEG-, PNG- oder WebP-Bilder.'});
    if(file.size>2*1024*1024)return setMessage({kind:'error',text:'Das Profilbild darf höchstens 2 MB groß sein.'});
    try{
      const bitmap=await createImageBitmap(file);
      const validSize=bitmap.width>=80&&bitmap.height>=80&&bitmap.width<=4096&&bitmap.height<=4096;bitmap.close();
      if(!validSize)throw new Error('Das Bild muss zwischen 80 × 80 und 4096 × 4096 Pixel groß sein.');
    }catch(error){return setMessage({kind:'error',text:error instanceof Error?error.message:'Die Bilddatei konnte nicht gelesen werden.'});}
    setBusy(true);
    try{
      const supabase=getSupabaseBrowserClient(config);
      const {data:sessionData}=await supabase.auth.getSession();
      if(!sessionData.session)throw new Error('Bitte melde dich erneut an.');
      const path=`${sessionData.session.user.id}/avatar`;const version=new Date().toISOString();
      const {error:uploadError}=await supabase.storage.from(AVATAR_BUCKET).upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});
      if(uploadError)throw uploadError;
      const {data:userData,error:metadataError}=await supabase.auth.updateUser({data:{avatar_path:path,avatar_updated_at:version}});
      if(metadataError)throw metadataError;
      const response=await fetch('/api/account',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+sessionData.session.access_token},body:JSON.stringify({avatarPath:path})});
      const payload=await response.json().catch(()=>null) as {detail?:string;profile?:AccountProfile}|null;
      if(!response.ok||!payload?.profile)throw new Error(payload?.detail||'Das Profilbild konnte nicht gespeichert werden.');
      setData(previous=>previous?{...previous,profile:payload.profile!}:previous);setAvatarUrl(publicAvatarUrl(supabase,userData.user.id,path,version));setMessage({kind:'success',text:'Dein Profilbild wurde gespeichert.'});
    }catch(error){setMessage({kind:'error',text:error instanceof Error?error.message:'Das Profilbild konnte nicht gespeichert werden.'});}
    finally{setBusy(false);}
  }

  async function removeAvatar(){
    setBusy(true);setMessage(null);
    try{
      const supabase=getSupabaseBrowserClient(config);const {data:sessionData}=await supabase.auth.getSession();
      if(!sessionData.session)throw new Error('Bitte melde dich erneut an.');
      const path=`${sessionData.session.user.id}/avatar`;
      const {error:removeError}=await supabase.storage.from(AVATAR_BUCKET).remove([path]);if(removeError)throw removeError;
      const {error:metadataError}=await supabase.auth.updateUser({data:{avatar_path:null,avatar_updated_at:new Date().toISOString()}});if(metadataError)throw metadataError;
      const response=await fetch('/api/account',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+sessionData.session.access_token},body:JSON.stringify({avatarPath:null})});
      const payload=await response.json().catch(()=>null) as {detail?:string;profile?:AccountProfile}|null;if(!response.ok||!payload?.profile)throw new Error(payload?.detail||'Das Profilbild konnte nicht entfernt werden.');
      setData(previous=>previous?{...previous,profile:payload.profile!}:previous);setAvatarUrl(null);setMessage({kind:'success',text:'Dein Profilbild wurde entfernt.'});
    }catch(error){setMessage({kind:'error',text:error instanceof Error?error.message:'Das Profilbild konnte nicht entfernt werden.'});}
    finally{setBusy(false);}
  }

  async function saveProfile(event:FormEvent){
    event.preventDefault();setBusy(true);setMessage(null);
    try{
      const supabase=getSupabaseBrowserClient(config);
      const {error}=await supabase.auth.updateUser({data:{display_name:displayName.trim()}});
      if(error)throw error;
      const response=await fetch('/api/account',{method:'PATCH',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({displayName})});
      const payload=await response.json().catch(()=>null) as {detail?:string;profile?:AccountProfile}|null;
      if(!response.ok||!payload?.profile)throw new Error(payload?.detail||'Profil konnte nicht gespeichert werden.');
      const savedProfile=payload.profile;
      setData(previous=>previous?{...previous,profile:savedProfile}:previous);setMessage({kind:'success',text:'Dein Profil wurde gespeichert.'});
    }catch(error){setMessage({kind:'error',text:error instanceof Error?error.message:'Profil konnte nicht gespeichert werden.'});}
    finally{setBusy(false);}
  }

  async function changeEmail(event:FormEvent){
    event.preventDefault();setBusy(true);setMessage(null);
    try{
      const {error}=await getSupabaseBrowserClient(config).auth.updateUser({email:newEmail.trim()},{emailRedirectTo:location.origin+'/auth/bestaetigen'});
      if(error)throw error;
      setMessage({kind:'success',text:'Öffne die Bestätigungs-E-Mail. Bis dahin bleibt deine bisherige Adresse aktiv.'});
    }catch(error){setMessage({kind:'error',text:error instanceof Error?error.message:'Die E-Mail-Adresse konnte nicht geändert werden.'});}
    finally{setBusy(false);}
  }

  async function changePassword(event:FormEvent){
    event.preventDefault();setBusy(true);setMessage(null);
    if(newPassword.length<12)return void(setBusy(false),setMessage({kind:'error',text:'Das neue Passwort muss mindestens 12 Zeichen lang sein.'}));
    try{
      const {error}=await getSupabaseBrowserClient(config).auth.updateUser({password:newPassword,current_password:currentPassword} as never);
      if(error)throw error;
      setCurrentPassword('');setNewPassword('');setMessage({kind:'success',text:'Dein Passwort wurde geändert.'});
    }catch(error){setMessage({kind:'error',text:error instanceof Error?error.message:'Das Passwort konnte nicht geändert werden.'});}
    finally{setBusy(false);}
  }

  async function exportData(){
    setBusy(true);setMessage(null);
    try{
      const response=await fetch('/api/account/export',{headers:{authorization:'Bearer '+token}});
      if(!response.ok)throw new Error('Der Export konnte nicht erstellt werden.');
      const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download='techthese-kontodaten.json';link.click();URL.revokeObjectURL(url);
    }catch(error){setMessage({kind:'error',text:error instanceof Error?error.message:'Der Export ist fehlgeschlagen.'});}
    finally{setBusy(false);}
  }

  async function signOut(){await getSupabaseBrowserClient(config).auth.signOut({scope:'local'});location.assign('/');}
  async function deleteAccount(){
    if(deleteText!=='KONTO LÖSCHEN')return setMessage({kind:'error',text:'Bitte gib die Löschbestätigung exakt ein.'});
    setBusy(true);setMessage(null);
    try{
      const response=await fetch('/api/account',{method:'DELETE',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({confirmation:deleteText})});
      if(!response.ok){const payload=await response.json().catch(()=>null) as {detail?:string}|null;throw new Error(payload?.detail||'Das Konto konnte nicht gelöscht werden.');}
      await getSupabaseBrowserClient(config).auth.signOut({scope:'local'});location.replace('/?account=deleted');
    }catch(error){setMessage({kind:'error',text:error instanceof Error?error.message:'Das Konto konnte nicht gelöscht werden.'});setBusy(false);}
  }

  if(!data)return <div className="account-loading"><p className="eyebrow">TechThese Konto</p><h1>Konto wird geladen …</h1>{message&&<div className={'auth-message '+message.kind}>{message.text}</div>}</div>;
  async function saveEmailUpdates(next:EmailUpdates){
    setMessage(null);setBusy(true);
    const response=await fetch('/api/account/notifications',{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(next)});
    const payload=await response.json().catch(()=>null) as (EmailUpdates&{detail?:string})|null;
    if(response.ok&&payload){
      setData(current=>current?{...current,emailUpdates:{enabled:payload.enabled,generalNews:payload.generalNews}}:current);
      setMessage({kind:'success',text:payload.enabled?'E-Mail-Benachrichtigung ist aktiv.':'E-Mail-Benachrichtigung ist ausgeschaltet. Deine Unternehmen bleiben gespeichert.'});
    }else setMessage({kind:'error',text:payload?.detail||'Die Einstellung konnte nicht gespeichert werden.'});
    setBusy(false);
  }

  async function unfollow(ticker:string){
    setMessage(null);setBusy(true);
    const response=await fetch('/api/follows',{method:'DELETE',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({ticker})});
    if(response.ok)setData(current=>current?{...current,follows:current.follows.filter(follow=>follow.ticker!==ticker)}:current);
    else{const payload=await response.json().catch(()=>null) as {detail?:string}|null;setMessage({kind:'error',text:payload?.detail||'Das Unternehmen konnte nicht entfernt werden.'});}
    setBusy(false);
  }

  return <div className="account-shell">
    <header className="account-heading"><div><p className="eyebrow">TechThese Konto</p><h1>{data.profile.displayName}</h1><p>{data.profile.email} · E-Mail bestätigt</p></div><div className="account-heading-actions"><span>{data.profile.role==='super_admin'?'Super Admin':data.profile.role==='buyer'?'Buyer':'Benutzerkonto'}</span>{data.profile.role==='super_admin'&&<a href="/admin">Zum Admin-Dashboard ↗</a>}<button onClick={signOut}>Abmelden</button></div></header>
    {message&&<div className={'auth-message '+message.kind} role="status">{message.text}</div>}
    <div className="account-hub-grid">
      <section className="account-card account-follows"><h2>Meine Unternehmen</h2>{data.follows.length?<><p className="muted">{data.follows.length===1?'Du folgst einem Unternehmen.':'Du folgst '+data.follows.length+' Unternehmen.'}</p><ul className="follow-list">{data.follows.map(follow=><li key={follow.ticker}><a href={'/unternehmen/'+follow.ticker}><span className="ticker">{follow.ticker}</span><span>{follow.name}</span></a><button type="button" disabled={busy} onClick={()=>unfollow(follow.ticker)} aria-label={'Nicht mehr folgen: '+follow.name}>Nicht mehr folgen</button></li>)}</ul></>:<p className="muted">Du folgst noch keinem Unternehmen. Öffne ein Unternehmen und klicke dort auf „Folgen“. <a href="/">Unternehmen ansehen ↗</a></p>}</section><section className="account-card account-mail" id="benachrichtigungen"><h2>E-Mail-Benachrichtigung</h2>
        <p className="muted">{data.emailUpdates.enabled?'Aktiv. Neue Beiträge zu deinen Unternehmen kommen an '+data.profile.email+'.':'Ausgeschaltet. Folgen allein verschickt keine E-Mails.'}</p>
        <label className="auth-check"><input type="checkbox" checked={data.emailUpdates.enabled} disabled={busy} onChange={event=>saveEmailUpdates({enabled:event.target.checked,generalNews:data.emailUpdates.generalNews})}/><span>Neue Beiträge zu den Unternehmen, denen ich folge, per E-Mail erhalten.</span></label>
        <label className="auth-check"><input type="checkbox" checked={data.emailUpdates.generalNews} disabled={busy||!data.emailUpdates.enabled} onChange={event=>saveEmailUpdates({enabled:true,generalNews:event.target.checked})}/><span>Zusätzlich über alle neuen Beiträge informieren.</span></label>
        <small className="muted">Keine Öffnungs- oder Klickverfolgung. Jede E-Mail enthält einen Abmeldelink. <a href="/rechtliches#email-updates">Datenschutz</a></small>
      </section>
      <section className="account-card"><h2>Profil</h2><div className="avatar-editor"><span className="avatar-preview">{avatarUrl?<img src={avatarUrl} width="82" height="82" alt="Aktuelles Profilbild"/>:<b aria-hidden="true">{data.profile.displayName.slice(0,1).toUpperCase()}</b>}</span><div><label className="avatar-upload">Profilbild auswählen<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadAvatar(file);event.target.value='';}}/></label><small>JPEG, PNG oder WebP · 80–4096 px · maximal 2 MB</small>{avatarUrl&&<button type="button" className="avatar-remove" disabled={busy} onClick={removeAvatar}>Bild entfernen</button>}</div></div><form onSubmit={saveProfile}><label>Anzeigename<input value={displayName} minLength={2} maxLength={80} onChange={event=>setDisplayName(event.target.value)}/></label><button disabled={busy}>Profil speichern</button></form></section>
      <section className="account-card"><h2>E-Mail-Adresse</h2><form onSubmit={changeEmail}><label>Bestätigte Adresse<input type="email" value={newEmail} onChange={event=>setNewEmail(event.target.value)}/></label><button disabled={busy||newEmail===data.profile.email}>Neue Adresse bestätigen</button></form></section>
      <section className="account-card"><h2>Passwort ändern</h2><form onSubmit={changePassword}><PasswordField label="Aktuelles Passwort" autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword}/><PasswordField label="Neues Passwort" autoComplete="new-password" value={newPassword} onChange={setNewPassword}/><button disabled={busy}>Passwort ändern</button></form></section>
      <section className="account-card"><h2>Deine Daten</h2><p>Lade dein gespeichertes Profil und das Sicherheitsprotokoll als JSON-Datei herunter.</p><button disabled={busy} onClick={exportData}>Daten exportieren</button></section>
    </div>
    <section className="account-audit"><div className="section-title"><h2>Sicherheitsprotokoll</h2><span>Letzte Kontoaktivitäten</span></div>{data.audit.length?<ul>{data.audit.map((entry,index)=><li key={entry.createdAt+'-'+index}><strong>{eventNames[entry.event]||entry.event}</strong><time>{dateTime.format(new Date(entry.createdAt))}</time></li>)}</ul>:<p className="muted">Noch keine Aktivitäten gespeichert.</p>}</section>
    <section className="danger-zone"><p className="eyebrow">Gefahrenbereich</p><h2>Konto dauerhaft löschen</h2><p>Dadurch werden deine Anmeldung bei Supabase entfernt und dein lokales Profil anonymisiert. Dieser Schritt kann nicht rückgängig gemacht werden.</p><label>Zur Bestätigung „KONTO LÖSCHEN“ eingeben<input value={deleteText} onChange={event=>setDeleteText(event.target.value)}/></label><button disabled={busy||deleteText!=='KONTO LÖSCHEN'} onClick={deleteAccount}>Konto endgültig löschen</button></section>
  </div>;
}
