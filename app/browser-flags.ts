'use client';

import {useSyncExternalStore} from 'react';

export const CONSENT_KEY='techthese-analytics-consent';
export const VISITOR_KEY='techthese-visitor-id';
export const LAST_VIEW_KEY='techthese-last-pageview';
export const EXCLUDE_KEY='techthese-analytics-exclude';

export type Consent='unknown'|'accepted'|'rejected';

// localStorage ist ein externer Speicher. React liest ihn über useSyncExternalStore,
// damit kein Effect den Wert nachträglich in den State schreiben muss.
const listeners=new Set<()=>void>();

export function notifyFlagChange(){for(const listener of [...listeners])listener();}

function subscribe(listener:()=>void){
  listeners.add(listener);
  window.addEventListener('storage',listener);
  return ()=>{listeners.delete(listener);window.removeEventListener('storage',listener);};
}

// Der Serverwert entspricht dem Zustand vor dem ersten Lesen und hält die Hydration stabil.
function useFlag<T>(read:()=>T,serverValue:T){
  return useSyncExternalStore(subscribe,read,()=>serverValue);
}

export function useExcluded<T extends boolean|null>(serverValue:T){
  return useFlag<boolean|T>(()=>localStorage.getItem(EXCLUDE_KEY)==='1',serverValue);
}

export function useConsent(){
  return useFlag<Consent>(()=>{
    const saved=localStorage.getItem(CONSENT_KEY);
    return saved==='accepted'?'accepted':saved==='rejected'?'rejected':'unknown';
  },'unknown');
}
