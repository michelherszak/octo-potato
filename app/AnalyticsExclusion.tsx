'use client';

import {useEffect,useState} from 'react';

const EXCLUDE_KEY='techthese-analytics-exclude';
const VISITOR_KEY='techthese-visitor-id';
const LAST_VIEW_KEY='techthese-last-pageview';

export default function AnalyticsExclusion(){
  const [excluded,setExcluded]=useState<boolean|null>(null);

  useEffect(()=>{setExcluded(localStorage.getItem(EXCLUDE_KEY)==='1');},[]);

  if(excluded===null)return <p className="admin-exclusion-state">Zählstatus dieses Browsers wird geprüft …</p>;
  return <div className="admin-exclusion">
    <div>
      <strong>{excluded?'Dieser Browser wird nicht mitgezählt.':'Dieser Browser wird derzeit mitgezählt.'}</strong>
      <p>{excluded
        ?'Seitenaufrufe aus diesem Browser landen nicht in der Besucherstatistik. Angemeldete Admin-Besuche bleiben zusätzlich immer ausgeschlossen.'
        :'Solange du hier angemeldet bist, zählt der Server deine Aufrufe ohnehin nicht. Für abgemeldetes Surfen in diesem Browser kannst du den Ausschluss dauerhaft merken.'}</p>
    </div>
    <button type="button" onClick={()=>{
      if(excluded){localStorage.removeItem(EXCLUDE_KEY);setExcluded(false);return;}
      localStorage.setItem(EXCLUDE_KEY,'1');
      localStorage.removeItem(VISITOR_KEY);
      sessionStorage.removeItem(LAST_VIEW_KEY);
      setExcluded(true);
    }}>{excluded?'Wieder mitzählen':'Diesen Browser nicht mitzählen'}</button>
  </div>;
}
