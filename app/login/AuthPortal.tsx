'use client';

import {FormEvent,useState} from 'react';
import {getSupabaseBrowserClient,safeNextPath,type PublicSupabaseConfig} from '@/lib/supabase-browser';
import {PRIVACY_VERSION,TERMS_VERSION} from '@/lib/supabase-accounts';

type Mode='login'|'register'|'forgot';
const strongPassword=(value:string)=>value.length>=12&&/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/\d/.test(value)&&/[^A-Za-z0-9]/.test(value);

function friendlyError(message:string){
  const lower=message.toLowerCase();
  if(lower.includes('invalid login credentials'))return 'E-Mail-Adresse oder Passwort sind nicht korrekt.';
  if(lower.includes('email not confirmed'))return 'Bitte bestätige zuerst deine E-Mail-Adresse.';
  if(lower.includes('already registered'))return 'Falls ein Konto existiert, erhältst du weitere Hinweise per E-Mail.';
  if(lower.includes('rate limit')||lower.includes('too many'))return 'Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.';
  return 'Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es erneut.';
}

export default function AuthPortal({config}: {config:PublicSupabaseConfig}){
  const [mode,setMode]=useState<Mode>('login');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [passwordRepeat,setPasswordRepeat]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [accepted,setAccepted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<{kind:'error'|'success';text:string}|null>(null);

  function switchMode(next:Mode){setMode(next);setMessage(null);setPassword('');setPasswordRepeat('');}

  async function submit(event:FormEvent){
    event.preventDefault();
    setMessage(null);
    if(!config.configured)return setMessage({kind:'error',text:'Die Anmeldung ist noch nicht mit Supabase verbunden.'});
    if(mode==='register'){
      if(displayName.trim().length<2)return setMessage({kind:'error',text:'Bitte gib deinen Namen ein.'});
      if(!strongPassword(password))return setMessage({kind:'error',text:'Das Passwort erfüllt noch nicht alle Sicherheitsanforderungen.'});
      if(password!==passwordRepeat)return setMessage({kind:'error',text:'Die beiden Passwörter stimmen nicht überein.'});
      if(!accepted)return setMessage({kind:'error',text:'Bitte bestätige die Nutzungs- und Datenschutzhinweise.'});
    }
    setBusy(true);
    try{
      const supabase=getSupabaseBrowserClient(config);
      if(mode==='forgot'){
        const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+'/passwort-zuruecksetzen'});
        if(error)throw error;
        setMessage({kind:'success',text:'Falls ein Konto zu dieser Adresse existiert, wurde eine E-Mail zum Zurücksetzen versendet.'});
        return;
      }
      if(mode==='register'){
        const acceptedAt=new Date().toISOString();
        const {data,error}=await supabase.auth.signUp({
          email:email.trim(),password,
          options:{emailRedirectTo:location.origin+'/auth/bestaetigen',data:{display_name:displayName.trim(),accepted_at:acceptedAt,terms_version:TERMS_VERSION,privacy_version:PRIVACY_VERSION}},
        });
        if(error)throw error;
        if(data.session){
          await supabase.auth.signOut({scope:'local'});
          setMessage({kind:'error',text:'Die verpflichtende E-Mail-Bestätigung ist in Supabase noch nicht aktiviert. Das Konto wurde nicht angemeldet.'});
          return;
        }
        setMessage({kind:'success',text:'Fast geschafft: Öffne jetzt die Bestätigungs-E-Mail von TechThese. Erst danach ist dein Konto aktiv.'});
        setPassword('');setPasswordRepeat('');
        return;
      }
      const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
      if(error)throw error;
      if(!data.user.email_confirmed_at){await supabase.auth.signOut({scope:'local'});throw new Error('Email not confirmed');}
      const response=await fetch('/api/account',{method:'POST',headers:{authorization:'Bearer '+data.session.access_token}});
      if(!response.ok){const payload=await response.json().catch(()=>null) as {detail?:string}|null;await supabase.auth.signOut({scope:'local'});throw new Error(payload?.detail||'Anmeldung fehlgeschlagen');}
      location.assign(safeNextPath(new URLSearchParams(location.search).get('next')));
    }catch(error){setMessage({kind:'error',text:friendlyError(error instanceof Error?error.message:'')});}
    finally{setBusy(false);}
  }

  async function resend(){
    if(!config.configured||!email.trim())return setMessage({kind:'error',text:'Gib zuerst deine E-Mail-Adresse ein.'});
    setBusy(true);setMessage(null);
    try{
      const {error}=await getSupabaseBrowserClient(config).auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:location.origin+'/auth/bestaetigen'}});
      if(error)throw error;
      setMessage({kind:'success',text:'Falls die Adresse noch bestätigt werden muss, wurde eine neue E-Mail versendet.'});
    }catch(error){setMessage({kind:'error',text:friendlyError(error instanceof Error?error.message:'')});}
    finally{setBusy(false);}
  }

  return <div className="auth-shell">
    <section className="auth-intro"><p className="eyebrow">TechThese Konto</p><h1>Deine Recherche.<br/><em>Ein sicherer Zugang.</em></h1><p>Dein Konto wird erst aktiv, nachdem du den Link in deiner E-Mail geöffnet hast. Passwörter werden ausschließlich durch Supabase Auth verarbeitet.</p><ul><li>E-Mail-Adresse verifiziert</li><li>Sichere, erneuerbare Sitzungen</li><li>Datenexport und Kontolöschung</li></ul></section>
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-tabs" role="tablist" aria-label="Kontozugang"><button type="button" role="tab" aria-selected={mode==='login'} onClick={()=>switchMode('login')}>Anmelden</button><button type="button" role="tab" aria-selected={mode==='register'} onClick={()=>switchMode('register')}>Konto erstellen</button></div>
      <h2 id="auth-title">{mode==='login'?'Willkommen zurück':mode==='register'?'Neues Konto':'Passwort zurücksetzen'}</h2>
      <p className="auth-subtitle">{mode==='login'?'Melde dich mit deiner bestätigten E-Mail-Adresse an.':mode==='register'?'Wir senden dir anschließend einen persönlichen Bestätigungslink.':'Du erhältst einen einmal verwendbaren Link per E-Mail.'}</p>
      {!config.configured&&<div className="auth-message error">Supabase ist noch nicht konfiguriert. Hinterlege URL und Publishable Key als Server-Secrets.</div>}
      {message&&<div className={'auth-message '+message.kind} role="status">{message.text}</div>}
      <form className="auth-form" onSubmit={submit}>
        {mode==='register'&&<label>Name<input required autoComplete="name" value={displayName} onChange={event=>setDisplayName(event.target.value)} maxLength={80}/></label>}
        <label>E-Mail-Adresse<input required type="email" autoComplete="email" inputMode="email" value={email} onChange={event=>setEmail(event.target.value)} /></label>
        {mode!=='forgot'&&<label>Passwort<input required type="password" autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={event=>setPassword(event.target.value)} /></label>}
        {mode==='register'&&<><p className={'password-hint '+(strongPassword(password)?'valid':'')}>Mindestens 12 Zeichen mit Groß- und Kleinbuchstaben, Zahl und Sonderzeichen.</p><label>Passwort wiederholen<input required type="password" autoComplete="new-password" value={passwordRepeat} onChange={event=>setPasswordRepeat(event.target.value)} /></label><label className="auth-check"><input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)}/><span>Ich akzeptiere die <a href="/rechtliches" target="_blank">Nutzungs- und Datenschutzhinweise</a>.</span></label></>}
        <button className="auth-submit" disabled={busy||!config.configured}>{busy?'Bitte warten …':mode==='login'?'Anmelden':mode==='register'?'Bestätigungs-E-Mail senden':'Link anfordern'}</button>
      </form>
      <div className="auth-actions">{mode==='login'&&<button type="button" onClick={()=>switchMode('forgot')}>Passwort vergessen?</button>}{mode==='forgot'&&<button type="button" onClick={()=>switchMode('login')}>Zurück zur Anmeldung</button>}{mode==='register'&&<button type="button" disabled={busy} onClick={resend}>Bestätigungs-E-Mail erneut senden</button>}</div>
    </section>
  </div>;
}
