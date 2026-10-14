import {topics} from './catalog.ts';
import type {Article} from './contract.ts';

export const discoveryQuestions = [
  {topic:'quanten', question:'Was steckt hinter Quantenaktien?', hint:'Computer, Sensoren und Verschlüsselung'},
  {topic:'ki', question:'Welche Firmen machen KI möglich?', hint:'Modelle, Daten und Rechenzentren'},
  {topic:'energie', question:'Woher kommt der Strom für neue Technik?', hint:'Netze, Speicher und Kernenergie'},
  {topic:'cybersecurity', question:'Wer schützt unsere digitale Welt?', hint:'Identitäten, Zugänge und Datensicherheit'},
  {topic:'halbleiter', question:'Wer baut die Chips von morgen?', hint:'Halbleiter, Fertigung und Verbindungstechnik'},
  {topic:'robotik', question:'Welche Unternehmen automatisieren die Arbeit?', hint:'Roboter, Lager und intelligente Fabriken'},
  {topic:'raumfahrt', question:'Welche Firmen verbinden die Welt?', hint:'Satelliten, Raumfahrt und Kommunikation'},
  {topic:'biotech', question:'Welche Technik verändert die Medizin?', hint:'Therapien, Diagnostik und medizinische Geräte'},
] as const;

const aliases:Record<string,string> = {
  quanten:'quantum quantencomputer quantenaktien quantensensoren quantensensorik kryptografie verschlüsselung post quantum',
  ki:'ai künstliche intelligenz artificial intelligence maschinelles lernen daten modelle cloud rechenzentren',
  halbleiter:'chips chip semiconductor semiconductors prozessoren speicher chipfertigung computer netzwerktechnik',
  energie:'strom stromerzeugung power generation stromnetze stromnetz netze batteriespeicher batterien kernenergie atomkraft energieversorgung',
  robotik:'roboter robots robotics automation automatisierung industrieroboter fabriken drohnen lagerlogistik',
  cybersecurity:'cyber security sicherheit datensicherheit it sicherheit identität identitäten zugangsschutz hacker',
  raumfahrt:'space satelliten satellite raketen mobilfunk telekommunikation optische kommunikation datenübertragung',
  biotech:'biotechnologie medizin medizintechnik therapien diagnosen diagnostik genetik dna laborautomation insulin',
};

export type SearchCompany = {ticker:string;name:string;role:string;topics:readonly string[]};
export type SearchEntry = {id:string;kind:'Thema'|'Unternehmen'|'Beitrag';label:string;detail:string;href:string;searchText:string};

export function normalizeSearch(text:string) {
  return text.toLowerCase().replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
const stopWords = new Set(['was','wer','wie','welche','welcher','welches','ist','sind','der','die','das','den','dem','ein','eine','einer','und','oder','mit','von','fur','hinter','steckt','kommt','woher','unternehmen','firmen','aktien','aktie','stocks']);
function tokens(query:string) {return normalizeSearch(query).split(' ').filter(t=>t&&!stopWords.has(t));}

function distance(a:string,b:string) {
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=0;i<a.length;i++) {const next=[i+1];for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+Number(a[i]!==b[j])));row=next;}
  return row[b.length];
}
function wordScore(query:string,word:string) {
  if(query===word)return 30;
  if(query.length>=3&&word.startsWith(query))return 20;
  if(word.length>=5&&query.startsWith(word))return 16;
  const tolerance=query.length>=8?2:query.length>=5?1:0;
  if(tolerance&&Math.abs(query.length-word.length)<=tolerance&&distance(query,word)<=tolerance)return 10;
  return 0;
}
export function searchScore(query:string,text:string) {
  const wanted=tokens(query);if(!wanted.length)return 0;
  const normalized=normalizeSearch(text),words=normalized.split(' ');
  const scores=wanted.map(token=>Math.max(0,...words.map(word=>wordScore(token,word))));
  if(scores.some(score=>score===0))return 0;
  return scores.reduce((sum,score)=>sum+score,0)+(normalized===normalizeSearch(query)?100:0);
}
function topicText(id:string) {const topic=topics.find(t=>t.id===id);return [topic?.name,topic?.description,aliases[id]].join(' ');}

export function buildSearchEntries(companies:SearchCompany[],articles:Pick<Article,'slug'|'title'|'description'|'ticker'|'company'|'topics'>[]):SearchEntry[] {
  return [
    ...topics.map(t=>({id:'topic-'+t.id,kind:'Thema' as const,label:t.name,detail:t.description,href:'/themen/'+t.id,searchText:topicText(t.id)})),
    ...companies.map(c=>({id:'company-'+c.ticker,kind:'Unternehmen' as const,label:c.name+' · '+c.ticker,detail:c.role,href:'/unternehmen/'+encodeURIComponent(c.ticker),searchText:[c.name,c.ticker,c.role,...c.topics.map(topicText)].join(' ')})),
    ...articles.map(a=>({id:'article-'+a.slug,kind:'Beitrag' as const,label:a.title,detail:a.description,href:'/analysen/'+a.slug,searchText:[a.title,a.description,a.ticker,a.company,...a.topics.map(topicText)].join(' ')})),
  ];
}

export function searchSuggestions(query:string,entries:SearchEntry[],limit=7) {
  if(!normalizeSearch(query))return [];
  const scored=entries.map(entry=>({entry,score:searchScore(query,entry.searchText)+searchScore(query,entry.label)*2})).filter(item=>item.score>0);
  // Reserve a place for each available kind, so broad topics do not hide articles.
  const kindOrder={Thema:0,Beitrag:1,Unternehmen:2};
  scored.sort((a,b)=>b.score-a.score||kindOrder[a.entry.kind]-kindOrder[b.entry.kind]||a.entry.label.localeCompare(b.entry.label,'de'));
  const selected:SearchEntry[]=[];
  for(const kind of ['Thema','Unternehmen','Beitrag'] as const) {const item=scored.find(item=>item.entry.kind===kind);if(item&&selected.length<limit)selected.push(item.entry);}
  for(const item of scored) {if(selected.length>=limit)break;if(!selected.some(entry=>entry.id===item.entry.id))selected.push(item.entry);}
  return selected.sort((a,b)=>scored.findIndex(item=>item.entry.id===a.id)-scored.findIndex(item=>item.entry.id===b.id));
}

export function matchingTopics(query:string) {return topics.filter(t=>searchScore(query,topicText(t.id))>0).map(t=>t.id);}
export function matchesArticle(query:string,article:Article) {return !normalizeSearch(query)||searchScore(query,[article.title,article.description,article.ticker,article.company,article.thesis,article.memo,...article.topics.map(topicText)].join(' '))>0;}
export function matchesCompany(query:string,company:SearchCompany) {return !normalizeSearch(query)||searchScore(query,[company.name,company.ticker,company.role,...company.topics.map(topicText)].join(' '))>0;}
