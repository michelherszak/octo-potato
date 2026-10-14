'use client';

import {useId,useMemo,useState} from 'react';
import {discoveryQuestions,searchSuggestions,type SearchEntry} from '@/lib/search';

type Props={entries:SearchEntry[];initialQuery?:string;topic?:string;action?:string;companiesOnly?:boolean};
export default function SearchExplorer({entries,initialQuery='',topic='',action='/',companiesOnly=false}:Props) {
  const id=useId(),listId=id+'-suggestions';
  const [query,setQuery]=useState(initialQuery),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[more,setMore]=useState(false);
  const suggestions=useMemo(()=>searchSuggestions(query,entries),[query,entries]);
  const visible=open&&query.trim().length>0;
  const questions=more?discoveryQuestions:discoveryQuestions.slice(0,4);
  return <div className="search-explorer">
    <label className="search-label" htmlFor={id}>{companiesOnly?'Ein Unternehmen oder ein Thema entdecken':'Was möchtest du besser verstehen?'}</label>
    <div className="search-control" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setOpen(false);setActive(-1);}}}>
      <form action={action} method="get" role="search">
        <input id={id} name="q" type="search" value={query} maxLength={200} autoComplete="off" role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded={visible} aria-activedescendant={visible&&active>=0?id+'-option-'+active:undefined} aria-describedby={id+'-help'} placeholder="Zum Beispiel: Quanten, Strom, Chips oder Xanadu …" onFocus={()=>setOpen(true)} onChange={event=>{setQuery(event.target.value);setActive(-1);setOpen(true);}} onKeyDown={event=>{
          if(event.key==='Enter'&&visible&&active>=0&&suggestions[active]){event.preventDefault();window.location.assign(suggestions[active].href);}
          if(event.key==='Escape'){event.preventDefault();setOpen(false);setActive(-1);}
          if((event.key==='ArrowDown'||event.key==='ArrowUp')&&suggestions.length){event.preventDefault();setOpen(true);setActive(previous=>event.key==='ArrowDown'?(previous+1)%suggestions.length:(previous<=0?suggestions.length-1:previous-1));}
        }}/>
        {topic&&<input type="hidden" name="thema" value={topic}/>}
        <button type="submit">Suchen ↗</button>
      </form>
      {visible&&<div className="search-dropdown">
        <p className="suggestion-heading">Passende Einstiege</p>
        <ul id={listId} role="listbox" aria-label="Suchvorschläge">
          {suggestions.map((entry,index)=><li key={entry.id} id={id+'-option-'+index} role="option" aria-selected={active===index}>
            <a href={entry.href} tabIndex={-1} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)}><span className="suggestion-kind">{entry.kind}</span><span className="suggestion-copy"><strong>{entry.label}</strong><small>{entry.detail}</small></span><span aria-hidden="true">↗</span></a>
          </li>)}
        </ul>
        {!suggestions.length&&<p className="suggestion-empty">Dazu gibt es noch keinen passenden Vorschlag. Versuche einen Begriff wie „Chips“ oder wähle unten eine Einstiegsfrage.</p>}
        {suggestions.length>0&&<p className="suggestion-help">↑ ↓ auswählen · Enter öffnen · Esc schließen</p>}
      </div>}
    </div>
    <p className="search-help" id={id+'-help'}>Ein Alltagsbegriff reicht. Wir schlagen dir {companiesOnly?'passende Themen und Unternehmen':'passende Themen, Unternehmen und vorhandene Beiträge'} vor.</p>
    <div className="discovery-heading"><h2>Noch keine konkrete Idee?</h2><span>Starte mit einer Frage</span></div>
    <div className="discovery-grid">{questions.map(item=><a key={item.topic} href={'/?thema='+item.topic+'#ergebnisse'}><strong>{item.question}</strong><span>{item.hint}</span><i aria-hidden="true">↗</i></a>)}</div>
    <button className="discovery-toggle" type="button" aria-expanded={more} onClick={()=>setMore(previous=>!previous)}>{more?'Weniger Einstiege anzeigen':'Weitere Themen entdecken'} <span aria-hidden="true">{more?'−':'+'}</span></button>
    <span className="sr-only" role="status" aria-live="polite">{visible?(suggestions.length?suggestions.length+' Suchvorschläge verfügbar.':'Keine passenden Suchvorschläge.') : ''}</span>
  </div>;
}
