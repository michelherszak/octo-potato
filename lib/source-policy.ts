// Veröffentlichte Zahlen brauchen Quellen, die kostenlos zugänglich sind UND die
// Weitergabe erlauben. Siehe docs/quellen-lizenzen.md.
export const BLOCKED_SOURCES: ReadonlyArray<{label:string;reason:string;patterns:RegExp[]}> = [
  {label:'Yahoo Finance',reason:'Weiterveröffentlichung nicht gestattet',
    patterns:[/yahoo/i,/\byfinance\b/i]},
  {label:'FRED (St. Louis Fed)',reason:'Speichern und Weitergabe laut API-Bedingungen untersagt',
    patterns:[/stlouisfed/i,/\bFRED\b/]},
  {label:'Alpha Vantage',reason:'Gratis-Stufe erlaubt keine öffentliche Anzeige',
    patterns:[/alphavantage/i,/alpha\s+vantage/i]},
  {label:'Finnhub',reason:'Gratis-Stufe nur für persönliche Nutzung',
    patterns:[/finnhub/i]},
  {label:'Twelve Data',reason:'externe Anzeige erst ab kostenpflichtiger Stufe',
    patterns:[/twelvedata/i,/twelve\s+data/i]},
  {label:'Financial Modeling Prep',reason:'Anzeige in Mehrbenutzer-Anwendungen vertraglich ausgeschlossen',
    patterns:[/financialmodelingprep/i,/financial\s+modeling\s+prep/i]},
  {label:'NewsAPI',reason:'Gratis-Plan nur für Entwicklung und Tests, Produktivbetrieb untersagt',
    patterns:[/newsapi\.org/i,/\bnewsapi\b/i]},
];

export function blockedSource(value:unknown){
  if(typeof value!=='string'||!value.trim())return null;
  for(const entry of BLOCKED_SOURCES)
    if(entry.patterns.some(pattern=>pattern.test(value)))return entry;
  return null;
}

type Finding={path:string;value:string;label:string;reason:string};

// Nur Felder, die eine Herkunft angeben. Fließtext bleibt ausgenommen: ein Memo darf
// Yahoo als Unternehmen besprechen, es darf seine Zahlen nur nicht von dort beziehen.
const SOURCE_KEYS=new Set(['source','source_url','url','rights_basis']);
const isSourceField=(key:string,path:string)=>
  SOURCE_KEYS.has(key)||(key==='title'&&path.startsWith('sources['));

// Quellen stehen an mehreren Stellen: als Link, als Freitext je Kennzahl und in der
// Memo-Übersicht. Alle werden geprüft, damit nichts durchrutscht.
export function findBlockedSources(article:unknown):Finding[]{
  const findings:Finding[]=[];
  const seen=new Set<string>();
  const visit=(value:unknown,path:string,key:string)=>{
    if(typeof value==='string'){
      if(!isSourceField(key,path))return;
      const hit=blockedSource(value);
      if(hit){
        const id=path+'|'+value;
        if(!seen.has(id)){seen.add(id);findings.push({path,value:value.slice(0,160),label:hit.label,reason:hit.reason});}
      }
      return;
    }
    if(Array.isArray(value)){value.forEach((entry,index)=>visit(entry,path+'['+index+']',key));return;}
    if(value&&typeof value==='object')
      for(const [childKey,entry] of Object.entries(value as Record<string,unknown>))
        visit(entry,path?path+'.'+childKey:childKey,childKey);
  };
  visit(article,'','');
  return findings;
}
