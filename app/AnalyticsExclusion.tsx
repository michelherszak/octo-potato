'use client';

import {EXCLUDE_KEY,LAST_VIEW_KEY,VISITOR_KEY,notifyFlagChange,useExcluded} from './browser-flags';

export default function AnalyticsExclusion(){
  const excluded=useExcluded<null>(null);

  if(excluded===null)return <p className="admin-exclusion-state">Zählstatus dieses Browsers wird geprüft …</p>;
  return <div className="admin-exclusion">
    <div>
      <strong>{excluded?'Dieser Browser wird nicht mitgezählt.':'Dieser Browser wird derzeit mitgezählt.'}</strong>
      <p>{excluded
        ?'Seitenaufrufe aus diesem Browser landen nicht in der Besucherstatistik. Angemeldete Admin-Besuche bleiben zusätzlich immer ausgeschlossen.'
        :'Solange du hier angemeldet bist, zählt der Server deine Aufrufe ohnehin nicht. Für abgemeldetes Surfen in diesem Browser kannst du den Ausschluss dauerhaft merken.'}</p>
    </div>
    <button type="button" onClick={()=>{
      if(excluded){localStorage.removeItem(EXCLUDE_KEY);notifyFlagChange();return;}
      localStorage.setItem(EXCLUDE_KEY,'1');
      localStorage.removeItem(VISITOR_KEY);
      sessionStorage.removeItem(LAST_VIEW_KEY);
      notifyFlagChange();
    }}>{excluded?'Wieder mitzählen':'Diesen Browser nicht mitzählen'}</button>
  </div>;
}
