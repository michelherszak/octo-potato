'use client';

import {useId,useMemo,useRef,useState} from 'react';
import {topics} from '@/lib/catalog';
import {discoveryQuestions,searchSuggestions,type SearchEntry} from '@/lib/search';

type Props={entries:SearchEntry[];initialQuery?:string;topic?:string;action?:string;companiesOnly?:boolean;compact?:boolean;questionTarget?:string;inHeader?:boolean};
export default function SearchExplorer({entries,initialQuery='',topic='',action='/',companiesOnly=false,compact=false,questionTarget='/entdecken#ergebnisse',inHeader=false}:Props) {
  const id=useId(),listId=id+'-suggestions',panelId=id+'-panel';
  const input=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState(initialQuery),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[more,setMore]=useState(false);
  const suggestions=useMemo(()=>searchSuggestions(query,entries),[query,entries]);
  const hasQuery=query.trim().length>0;
  const visible=open&&(inHeader||hasQuery);
  const questions=more?discoveryQuestions:discoveryQuestions.slice(0,4);
  const guide=<><div className="discovery-heading"><h2>Noch keine konkrete Idee?</h2><span>Starte mit einer Frage</span></div>
    <div className="discovery-grid">{questions.map(item=><a key={item.topic} href={questionTarget.split('#')[0]+'?thema='+item.topic+(questionTarget.includes('#')?'#'+questionTarget.split('#')[1]:'')}><strong>{item.question}</strong><span>{item.hint}</span><i aria-hidden="true">↗</i></a>)}</div>
    <button className="discovery-toggle" type="button" aria-expanded={more} onClick={()=>setMore(previous=>!previous)}>{more?'Weniger Einstiege anzeigen':'Weitere Themen entdecken'} <span aria-hidden="true">{more?'−':'+'}</span></button></>;
  const help=<>Ein Alltagsbegriff reicht. Wir schlagen dir {companiesOnly?'passende Themen und Unternehmen':'passende Themen, Unternehmen und vorhandene Beiträge'} vor.</>;
  return <div className={'search-explorer'+(compact?' search-compact':'')+(inHeader?' search-header':'')} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();if(inHeader)input.current?.focus();setOpen(false);setActive(-1);}
  }}>
    <label className="search-label" htmlFor={id}>{companiesOnly?'Ein Unternehmen oder ein Thema entdecken':'Was möchtest du besser verstehen?'}</label>
    <div className="search-control" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setOpen(false);setActive(-1);}}}>
      <form action={action} method="get" role="search">
        <input ref={input} id={id} name="q" type="search" value={query} maxLength={200} autoComplete="off" role="combobox" aria-label={inHeader?'Website durchsuchen':undefined} aria-autocomplete="list" aria-controls={hasQuery?listId:undefined} aria-expanded={visible&&hasQuery} aria-activedescendant={visible&&active>=0?id+'-option-'+active:undefined} aria-describedby={id+'-help'} placeholder={inHeader?'Unternehmen, Themen oder Beiträge suchen …':'Zum Beispiel: Quanten, Strom, Chips oder Xanadu …'} onFocus={()=>setOpen(true)} onChange={event=>{setQuery(event.target.value);setActive(-1);setOpen(true);}} onKeyDown={event=>{
          if(event.key==='Enter'&&visible&&active>=0&&suggestions[active]){event.preventDefault();window.location.assign(suggestions[active].href);}
          if((event.key==='ArrowDown'||event.key==='ArrowUp')&&suggestions.length){event.preventDefault();setOpen(true);setActive(previous=>event.key==='ArrowDown'?(previous+1)%suggestions.length:(previous<=0?suggestions.length-1:previous-1));}
        }}/>
        {topic&&!inHeader&&<input type="hidden" name="thema" value={topic}/>}
        {inHeader&&<button type="button" className="header-search-themes" aria-controls={panelId} aria-expanded={visible} onClick={()=>{setOpen(!visible);setActive(-1);}}>Themen <span aria-hidden="true">⌄</span></button>}
        <button type="submit">Suchen ↗</button>
      </form>
      {visible&&<div className="search-dropdown" id={panelId} role={inHeader?'region':undefined} aria-label={inHeader?'Suche und Themen':undefined}>
        {hasQuery&&<><p className="suggestion-heading">Passende Einstiege</p>
        <ul id={listId} role="listbox" aria-label="Suchvorschläge">
          {suggestions.map((entry,index)=><li key={entry.id} id={id+'-option-'+index} role="option" aria-selected={active===index}>
            <a href={entry.href} tabIndex={-1} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)}><span className="suggestion-kind">{entry.kind}</span><span className="suggestion-copy"><strong>{entry.label}</strong><small>{entry.detail}</small></span><span aria-hidden="true">↗</span></a>
          </li>)}
        </ul>
        {!suggestions.length&&<p className="suggestion-empty">Dazu gibt es noch keinen passenden Vorschlag. Versuche einen Begriff wie „Chips“ oder wähle unten eine Einstiegsfrage.</p>}
        {suggestions.length>0&&<p className="suggestion-help">↑ ↓ auswählen · Enter öffnen · Esc schließen</p>}
        </>}
        {inHeader&&<div className="header-search-discovery">
          <p className="search-help">{help}</p>
          {hasQuery?<details className="search-question-guide"><summary>Mit einer Frage starten</summary><div>{guide}</div></details>:guide}
          <div className="header-search-filters"><p className="eyebrow">Themen eingrenzen</p><div className="filter-row">
            <a href={'/entdecken?q='+encodeURIComponent(query)+'#ergebnisse'} aria-current={!topic?'page':undefined}>Alle Themen</a>
            {topics.map(item=><a key={item.id} href={'/entdecken?thema='+item.id+'&q='+encodeURIComponent(query)+'#ergebnisse'} aria-current={topic===item.id?'page':undefined}>{item.short}</a>)}
          </div></div>
          <a className="header-company-directory" href="/#unternehmen">Alle Unternehmen ansehen ↗</a>
        </div>}
      </div>}
    </div>
    <p className={inHeader?'sr-only':'search-help'} id={id+'-help'}>{help}</p>
    {!inHeader&&(compact?<details className="search-question-guide"><summary>Mit einer Frage starten</summary><div>{guide}</div></details>:guide)}
    <span className="sr-only" role="status" aria-live="polite">{visible&&hasQuery?(suggestions.length?suggestions.length+' Suchvorschläge verfügbar.':'Keine passenden Suchvorschläge.') : ''}</span>
  </div>;
}
