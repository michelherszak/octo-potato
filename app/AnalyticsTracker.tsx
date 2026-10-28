'use client';

import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';

const CONSENT_KEY='techthese-analytics-consent';
const VISITOR_KEY='techthese-visitor-id';
const LAST_VIEW_KEY='techthese-last-pageview';

type Consent='unknown'|'accepted'|'rejected';

function visitorId(){
  const existing=localStorage.getItem(VISITOR_KEY);
  if(existing)return existing;
  const created=crypto.randomUUID();
  localStorage.setItem(VISITOR_KEY,created);
  return created;
}

export default function AnalyticsTracker(){
  const pathname=usePathname();
  const [consent,setConsent]=useState<Consent>('unknown');

  useEffect(()=>{
    const saved=localStorage.getItem(CONSENT_KEY);
    setConsent(saved==='accepted'?'accepted':saved==='rejected'?'rejected':'unknown');
  },[]);

  useEffect(()=>{
    if(consent!=='accepted'||!pathname||pathname.startsWith('/admin'))return;
    const id=visitorId();
    const now=Date.now();
    let last:{key?:string;at?:number}|null=null;
    try{last=JSON.parse(sessionStorage.getItem(LAST_VIEW_KEY)||'null') as {key?:string;at?:number}|null;}catch{sessionStorage.removeItem(LAST_VIEW_KEY);}
    const key=id+':'+pathname;
    if(last?.key===key&&now-Number(last.at||0)<5000)return;
    sessionStorage.setItem(LAST_VIEW_KEY,JSON.stringify({key,at:now}));
    void fetch('/api/analytics/visit',{
      method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',keepalive:true,
      body:JSON.stringify({visitorId:id,path:pathname,title:document.title}),
    }).catch(()=>{});
  },[consent,pathname]);

  if(pathname?.startsWith('/admin')||consent!=='unknown')return null;
  return <aside className="analytics-consent" aria-label="Einstellungen zur Besucherstatistik">
    <div><strong>Hilf uns, TechThese besser zu machen.</strong><p>Mit deiner Einwilligung zählen wir pseudonym, welche Seiten besucht werden. Keine Werbenetzwerke, keine IP-Speicherung. <a href="/rechtliches">Mehr erfahren</a></p></div>
    <div className="analytics-consent-actions">
      <button type="button" className="consent-secondary" onClick={()=>{localStorage.setItem(CONSENT_KEY,'rejected');localStorage.removeItem(VISITOR_KEY);setConsent('rejected')}}>Nur notwendige</button>
      <button type="button" onClick={()=>{localStorage.setItem(CONSENT_KEY,'accepted');setConsent('accepted')}}>Anonyme Statistik erlauben</button>
    </div>
  </aside>;
}
