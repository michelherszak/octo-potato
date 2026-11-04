import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import type {User} from '@supabase/supabase-js';
import {getAccountProfile,syncAccountProfile} from '../lib/supabase-accounts.ts';
import {safeNextPath} from '../lib/supabase-browser.ts';

function database(){
  const sqlite=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  function prepare(sql:string){let values:unknown[]=[];return {bind(...args:unknown[]){values=args;return this},async first<T>(){return (sqlite.prepare(sql).get(...values as never[])||null) as T|null},async run(){const result=sqlite.prepare(sql).run(...values as never[]);return {meta:{changes:Number(result.changes)}}}};}
  return {prepare} as unknown as D1Database;
}

function user(overrides:Partial<User>={}):User{return {
  id:'4f5568e5-80f8-4ed0-a552-c8d70d841df5',
  email:'Reader@Example.com',
  email_confirmed_at:'2026-11-04T10:00:00.000Z',
  created_at:'2026-11-04T09:00:00.000Z',
  app_metadata:{provider:'email'},
  user_metadata:{display_name:'Ada Beispiel',accepted_at:'2026-11-04T09:00:00.000Z',terms_version:'2026-11-04',privacy_version:'2026-11-04'},
  aud:'authenticated',
  ...overrides,
} as User;}

test('verified Supabase identities create a normalized TechThese profile',async()=>{
  const db=database();
  const result=await syncAccountProfile(db,user(),'owner@example.com',Date.parse('2026-11-04T10:05:00.000Z'));
  assert.equal(result.created,true);
  assert.equal(result.profile.email,'reader@example.com');
  assert.equal(result.profile.displayName,'Ada Beispiel');
  assert.equal(result.profile.role,'user');
  assert.equal(result.profile.status,'active');
  assert.equal(result.profile.termsVersion,'2026-11-04');
  assert.ok(result.profile.emailVerifiedAt>0);
});

test('the configured address bootstraps super-admin rights and suspended accounts stay suspended',async()=>{
  const db=database();
  const admin=user({email:'Owner@Example.com'});
  const first=await syncAccountProfile(db,admin,'owner@example.com');
  assert.equal(first.profile.role,'super_admin');
  await db.prepare("UPDATE user_profiles SET status='suspended' WHERE user_id=?").bind(admin.id).run();
  const second=await syncAccountProfile(db,admin,'owner@example.com');
  assert.equal(second.profile.status,'suspended');
  assert.equal((await getAccountProfile(db,admin.id))?.role,'super_admin');
});

test('Michel is always the primary super admin and buyer roles are preserved',async()=>{
  const db=database();
  const michel=user({email:'MICHEL.HERSZAK@GMAIL.COM'});
  assert.equal((await syncAccountProfile(db,michel,undefined)).profile.role,'super_admin');
  const buyer=user({id:'0d8623e2-4633-41ac-9162-44c49117aed8',email:'buyer@example.com'});
  await syncAccountProfile(db,buyer,undefined);
  await db.prepare("UPDATE user_profiles SET role='buyer' WHERE user_id=?").bind(buyer.id).run();
  assert.equal((await syncAccountProfile(db,buyer,undefined)).profile.role,'buyer');
});

test('only the authenticated users fixed avatar path is accepted',async()=>{
  const db=database();
  const account=user({user_metadata:{display_name:'Ada',avatar_path:'4f5568e5-80f8-4ed0-a552-c8d70d841df5/avatar'}});
  assert.equal((await syncAccountProfile(db,account,undefined)).profile.avatarPath,`${account.id}/avatar`);
  const malicious=user({id:'8c006243-53b9-4f31-a484-46071c883a87',email:'other@example.com',user_metadata:{display_name:'Other',avatar_path:'https://tracker.example/pixel.png'}});
  assert.equal((await syncAccountProfile(db,malicious,undefined)).profile.avatarPath,null);
});

test('post-login return paths cannot leave the TechThese origin',()=>{
  assert.equal(safeNextPath('/admin?tab=users'),'/admin?tab=users');
  assert.equal(safeNextPath('//evil.example'),'/konto');
  assert.equal(safeNextPath('https://evil.example'),'/konto');
  assert.equal(safeNextPath('/login'),'/konto');
});

test('a company can be followed idempotently and unfollowed again',async()=>{
  const db=database();
  const userId='4f5568e5-80f8-4ed0-a552-c8d70d841df5';
  await db.prepare('INSERT INTO company_follows (user_id,ticker,created_at) VALUES (?,?,?) ON CONFLICT(user_id,ticker) DO NOTHING').bind(userId,'NVDA',1).run();
  await db.prepare('INSERT INTO company_follows (user_id,ticker,created_at) VALUES (?,?,?) ON CONFLICT(user_id,ticker) DO NOTHING').bind(userId,'NVDA',2).run();
  const followed=await db.prepare('SELECT COUNT(*) AS total FROM company_follows WHERE user_id=? AND ticker=?').bind(userId,'NVDA').first<{total:number}>();
  assert.equal(followed?.total,1);
  await db.prepare('DELETE FROM company_follows WHERE user_id=? AND ticker=?').bind(userId,'NVDA').run();
  const remaining=await db.prepare('SELECT COUNT(*) AS total FROM company_follows').first<{total:number}>();
  assert.equal(remaining?.total,0);
});
