import type {z} from 'zod';
import {importSchema} from './contract.ts';
export type Packet=z.infer<typeof importSchema>;
type Database=Pick<D1Database,'prepare'|'batch'>;
export class ImportConflict extends Error {}
function matches(payload:string,article:Packet['article']) {
  const prior=JSON.parse(payload);const selected=Object.fromEntries(Object.keys(article).map(k=>[k,prior[k]]));
  return JSON.stringify(selected)===JSON.stringify(article);
}
export async function importArticle(db:Database,packet:Packet,base:string,now=new Date().toISOString()) {
  const {article,publication_id,expected_revision}=packet;
  async function repeated(){const prior=await db.prepare('SELECT payload FROM article_versions WHERE publication_id=?').bind(publication_id).first<{payload:string}>();if(!prior)return null;if(!matches(prior.payload,article))throw new ImportConflict('Übertragungskennung wurde bereits für einen anderen Inhalt verwendet.');const p=JSON.parse(prior.payload);return {slug:p.slug,revision:p.revision,url:base+'/analysen/'+p.slug,idempotent:true};}
  const retry=await repeated();if(retry)return retry;
  const existing=await db.prepare('SELECT payload,revision FROM articles WHERE slug=?').bind(article.slug).first<{payload:string;revision:number}>();
  if((existing?.revision||0)!==expected_revision)throw new ImportConflict('Artikel wurde zwischenzeitlich geändert. Bitte die Vorschau neu laden.');
  const previous=existing?JSON.parse(existing.payload):null;
  const payload=JSON.stringify({...article,published_at:previous?.published_at||now,updated_at:now,revision:expected_revision+1});
  try {
    const results=await db.batch([
      db.prepare('INSERT INTO articles(slug,revision,publication_id,payload) VALUES(?,?,?,?) ON CONFLICT(slug) DO UPDATE SET revision=excluded.revision,publication_id=excluded.publication_id,payload=excluded.payload WHERE articles.revision=?').bind(article.slug,expected_revision+1,publication_id,payload,expected_revision),
      db.prepare('INSERT INTO article_versions(publication_id,slug,revision,payload) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM articles WHERE slug=? AND publication_id=?)').bind(publication_id,article.slug,expected_revision+1,payload,article.slug,publication_id),
    ]);
    if(!results[0].meta.changes)throw new ImportConflict('Artikel wurde zwischenzeitlich geändert.');
  } catch(error) {const retry=await repeated();if(retry)return retry;throw error;}
  return {slug:article.slug,revision:expected_revision+1,url:base+'/analysen/'+article.slug,idempotent:false};
}
