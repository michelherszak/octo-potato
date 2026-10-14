import {env} from 'cloudflare:workers';
import type {Article} from './contract.ts';
import {seeds} from './seeds.ts';
import {companies} from './catalog.ts';
export function siteUrl() {return (env.SITE_URL || 'http://localhost:5180').replace(/\/$/,'');}
export async function allArticles():Promise<Article[]> {if(!env.DB)throw new Error('Die Inhaltsdatenbank ist nicht verbunden.');const {results}=await env.DB.prepare('SELECT payload FROM articles ORDER BY rowid DESC').all<{payload:string}>();const saved=results.map(r=>JSON.parse(r.payload) as Article);return [...saved,...seeds.filter(s=>!saved.some(a=>a.slug===s.slug))];}
export async function getArticle(slug:string) {return (await allArticles()).find(a=>a.slug===slug);}
export async function companyCatalog(){const articles=await allArticles();const known=companies.map(c=>({...c,topics:[...new Set([...c.topics,...articles.filter(a=>a.ticker===c.ticker).flatMap(a=>a.topics)])] as string[]}));const extra=articles.filter(a=>a.ticker&&!known.some(c=>c.ticker===a.ticker)).map(a=>({ticker:a.ticker,name:a.company,role:a.description,topics:a.topics,source:a.sources[0]?.url||''}));return [...known,...extra.filter((c,i,a)=>a.findIndex(x=>x.ticker===c.ticker)===i)];}
