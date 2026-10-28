import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {articleSchema,importSchema,metadataFor} from '../lib/contract.ts';
import {importArticle,ImportConflict} from '../lib/import-service.ts';
import {seeds} from '../lib/seeds.ts';
import {companies,topics} from '../lib/catalog.ts';

const review={reviewer:'Michel Herszak',reviewed_at:'2026-10-20T12:00:00Z',edited:true as const,facts_checked:true as const,commercial_rights_confirmed:true as const,rights_basis:'Eigene Formulierungen und kommerziell lizenzierte Kennzahlen.',conflicts:'Keine Positionen oder Vergütungen in diesem Test.',advertising:'none' as const,advertising_details:'Keine Vergütung für diesen Testbeitrag.'};
function fixture(){const {example,...article}=seeds[0];void example;return {...articleSchema.parse(article),editorial_review:review};}
function database(){const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));function prepare(sql:string){let values:unknown[]=[];return {bind(...args:unknown[]){values=args;return this},async first(){return sqlite.prepare(sql).get(...values as never[])||null},async run(){const result=sqlite.prepare(sql).run(...values as never[]);return {meta:{changes:Number(result.changes)}}}};}return {prepare,async batch(statements:{run():Promise<unknown>}[]){sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}},sqlite} as unknown as D1Database & {sqlite:DatabaseSync};}
test('all eight clusters are populated, with explicit overlap',()=>{assert.equal(companies.length,24);assert.equal(topics.length,8);for(const t of topics)assert.ok(companies.filter(c=>c.topics.includes(t.id)).length>=3);assert.ok(companies.some(c=>c.topics.length>1));});
test('private fields cannot enter the publication contract',()=>{assert.equal(articleSchema.safeParse({...fixture(),portfolio:{secret:1}}).success,false);});
test('unsafe source URLs and unknown topics are rejected',()=>{assert.equal(articleSchema.safeParse({...fixture(),sources:[{title:'unsafe',url:'javascript:alert(1)'}]}).success,false);assert.equal(articleSchema.safeParse({...fixture(),topics:['anything']}).success,false);});
test('the import contract requires a revision and request identity',()=>{assert.equal(importSchema.safeParse({article:fixture()}).success,false);});
test('retries are idempotent and historical dates are stable',async()=>{const db=database();const packet={publication_id:randomUUID(),expected_revision:0,article:fixture()};const first=await importArticle(db,packet,'https://example.test','2026-10-14T10:00:00Z');assert.equal(first.revision,1);const retry=await importArticle(db,packet,'https://example.test');assert.equal(retry.idempotent,true);const update={...packet,publication_id:randomUUID(),expected_revision:1,article:{...fixture(),title:'Eine aktualisierte und nachvollziehbare Analyse'}};await importArticle(db,update,'https://example.test','2026-10-15T10:00:00Z');const saved=JSON.parse((db.sqlite.prepare('SELECT payload FROM articles').get() as {payload:string}).payload);assert.equal(saved.published_at,'2026-10-14T10:00:00Z');assert.equal(saved.updated_at,'2026-10-15T10:00:00Z');assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM article_versions').get()!.n,2);});
test('stale writers cannot replace a newer version',async()=>{const db=database();const packet={publication_id:randomUUID(),expected_revision:0,article:fixture()};await importArticle(db,packet,'https://example.test');await assert.rejects(importArticle(db,{...packet,publication_id:randomUUID()},'https://example.test'),ImportConflict);assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM article_versions').get()!.n,1);});
test('reusing a request identity for changed text is rejected',async()=>{const db=database();const packet={publication_id:randomUUID(),expected_revision:0,article:fixture()};await importArticle(db,packet,'https://example.test');await assert.rejects(importArticle(db,{...packet,article:{...packet.article,title:'Ein anderer Artikel mit gleicher Übertragungskennung'}},'https://example.test'),ImportConflict);});
test('metadata identifies a single canonical article',()=>{const m=metadataFor(fixture(),'https://example.test');assert.equal(m.alternates.canonical,'https://example.test/analysen/'+fixture().slug);assert.equal(m.openGraph.type,'article');});

test('imports reject missing review, unchecked rights and missing conflicts',()=>{
  const article=fixture();
  const packet={publication_id:randomUUID(),expected_revision:0,article};
  assert.equal(importSchema.safeParse(packet).success,true);
  for(const editorial_review of [undefined,{...review,edited:false},{...review,facts_checked:false},{...review,commercial_rights_confirmed:false},{...review,conflicts:''},{...review,rights_basis:''}]){
    assert.equal(importSchema.safeParse({...packet,article:{...article,editorial_review}}).success,false);
  }
});
test('direct service calls cannot bypass review or write unreviewed versions',async()=>{
  const db=database();
  await assert.rejects(importArticle(db,{publication_id:randomUUID(),expected_revision:0,article:{...fixture(),editorial_review:undefined}} as never,'https://example.test'));
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM articles').get()!.n,0);
});
