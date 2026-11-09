import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {articleEmailStatement} from '../lib/notifications.ts';
import {deleteEmailUpdateStatements,disableEmailUpdates,emailUpdateStatus,enableEmailUpdates,syncFollowSubscriptions} from '../lib/follow-updates.ts';

type Statement={bind(...values:unknown[]):Statement;first<T>():Promise<T|null>;all<T>():Promise<{results:T[]}>;run():Promise<{meta:{changes:number}}>;execute():void};

function database(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort())
    sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  function prepare(sql:string):Statement{
    let values:unknown[]=[];
    const statement:Statement={
      bind(...args){values=args;return statement;},
      async first<T>(){return (sqlite.prepare(sql).get(...values as never[])||null) as T|null;},
      async all<T>(){return {results:sqlite.prepare(sql).all(...values as never[]) as T[]};},
      async run(){const result=sqlite.prepare(sql).run(...values as never[]);return {meta:{changes:Number(result.changes)}};},
      execute(){sqlite.prepare(sql).run(...values as never[]);},
    };
    return statement;
  }
  // Wie D1: alles oder nichts.
  async function batch(statements:Statement[]){
    sqlite.exec('BEGIN');
    try{for(const statement of statements)statement.execute();sqlite.exec('COMMIT');}
    catch(error){sqlite.exec('ROLLBACK');throw error;}
    return [];
  }
  const db={prepare,batch} as unknown as D1Database;
  // node:sqlite liefert Objekte ohne Prototyp; für den Vergleich in normale Objekte umwandeln.
  const rows=<T>(sql:string,...args:unknown[])=>(sqlite.prepare(sql).all(...args as never[]) as T[]).map(row=>({...row}));
  const follow=(userId:string,ticker:string)=>sqlite.prepare('INSERT INTO company_follows(user_id,ticker,created_at) VALUES(?,?,1)').run(userId,ticker);
  const unfollow=(userId:string,ticker:string)=>sqlite.prepare('DELETE FROM company_follows WHERE user_id=? AND ticker=?').run(userId,ticker);
  // Ein veröffentlichter Beitrag zu einem Unternehmen, wie ihn der Import anlegt.
  const publish=(slug:string,ticker:string)=>{
    const id=crypto.randomUUID();
    const payload=JSON.stringify({ticker});
    sqlite.prepare('INSERT INTO articles(slug,revision,publication_id,payload) VALUES(?,1,?,?)').run(slug,id,payload);
    sqlite.prepare('INSERT INTO article_versions(publication_id,slug,revision,payload) VALUES(?,?,1,?)').run(id,slug,payload);
    return id;
  };
  const queueFor=async(slug:string,ticker:string)=>{
    const id=publish(slug,ticker);
    await articleEmailStatement(db,slug,id,ticker,Date.now()).run();
    return rows<{email:string}>(`SELECT s.email FROM email_deliveries d JOIN subscribers s ON s.id=d.subscriber_id WHERE d.publication_id=?`,id).map(row=>row.email);
  };
  const exec=(sql:string,...args:unknown[])=>sqlite.prepare(sql).run(...args as never[]);
  return {db,rows,exec,follow,unfollow,queueFor};
}

const user='2f1c0a9e-6b3d-4e8a-9c71-5d4b3a2f1e0d';
const email='leserin@example.com';

test('following alone never sends mail without an explicit opt-in',async()=>{
  const {db,follow,queueFor}=database();
  follow(user,'MRVL');
  await syncFollowSubscriptions(db,user,email);
  assert.deepEqual(await emailUpdateStatus(db,email),{enabled:false,generalNews:false});
  assert.deepEqual(await queueFor('mrvl-memo','MRVL'),[]);
});

test('after opting in, a followed company triggers exactly the matching mail',async()=>{
  const {db,follow,queueFor,rows}=database();
  follow(user,'MRVL');
  await enableEmailUpdates(db,user,email,false);
  assert.deepEqual(await emailUpdateStatus(db,email),{enabled:true,generalNews:false});
  assert.deepEqual(rows('SELECT ticker FROM stock_subscriptions'),[{ticker:'MRVL'}]);
  assert.deepEqual(await queueFor('mrvl-memo','MRVL'),[email]);
  // Ein Unternehmen, dem nicht gefolgt wird, löst nichts aus.
  assert.deepEqual(await queueFor('arqq-memo','ARQQ'),[]);
});

test('later follows and unfollows reach the mail list immediately',async()=>{
  const {db,follow,unfollow,queueFor}=database();
  await enableEmailUpdates(db,user,email,false);
  follow(user,'ARQQ');
  await syncFollowSubscriptions(db,user,email);
  assert.deepEqual(await queueFor('arqq-memo','ARQQ'),[email]);
  unfollow(user,'ARQQ');
  await syncFollowSubscriptions(db,user,email);
  assert.deepEqual(await queueFor('arqq-memo-2','ARQQ'),[]);
});

test('switching mail off stops delivery but keeps the followed companies',async()=>{
  const {db,follow,queueFor,rows}=database();
  follow(user,'MRVL');
  await enableEmailUpdates(db,user,email,false);
  await disableEmailUpdates(db,email);
  assert.deepEqual(await emailUpdateStatus(db,email),{enabled:false,generalNews:false});
  assert.deepEqual(await queueFor('mrvl-memo','MRVL'),[]);
  assert.deepEqual(rows('SELECT ticker FROM company_follows'),[{ticker:'MRVL'}]);
});

test('an earlier mail-only selection is carried into the account, not lost',async()=>{
  const {db,rows,exec}=database();
  const legacy='legacy-subscriber';
  exec(`INSERT INTO subscribers(id,email,created_at,verified_at,general_news,consent_at,consent_version) VALUES(?,?,1,1,0,1,'email-updates-2026-10-27')`,legacy,email);
  exec('INSERT INTO stock_subscriptions(subscriber_id,ticker) VALUES(?,?)',legacy,'LAES');
  await enableEmailUpdates(db,user,email,false);
  // Dieselbe Adresse ist derselbe Abonnent; seine Auswahl steht jetzt im Konto.
  assert.deepEqual(rows('SELECT id FROM subscribers'),[{id:legacy}]);
  assert.deepEqual(rows('SELECT ticker FROM company_follows WHERE user_id=?',user),[{ticker:'LAES'}]);
  assert.deepEqual(rows('SELECT ticker FROM stock_subscriptions WHERE subscriber_id=?',legacy),[{ticker:'LAES'}]);
});

test('general news reaches the reader for every company',async()=>{
  const {db,queueFor}=database();
  await enableEmailUpdates(db,user,email,true);
  assert.deepEqual(await queueFor('irgendein-memo','XYZ'),[email]);
});

test('deleting the account leaves no address behind in the mail system',async()=>{
  const {db,follow,rows,queueFor}=database();
  follow(user,'MRVL');
  await enableEmailUpdates(db,user,email,true);
  await queueFor('mrvl-memo','MRVL');
  await db.batch(deleteEmailUpdateStatements(db,email));
  assert.deepEqual(rows('SELECT * FROM subscribers'),[]);
  assert.deepEqual(rows('SELECT * FROM stock_subscriptions'),[]);
  assert.deepEqual(rows('SELECT * FROM email_deliveries'),[]);
  assert.deepEqual(await queueFor('mrvl-memo-2','MRVL'),[]);
});
