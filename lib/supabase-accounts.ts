import type {User} from '@supabase/supabase-js';
import {isAdminEmail} from './analytics.ts';

export const TERMS_VERSION='2026-11-04';
export const PRIVACY_VERSION='2026-11-04';
export const PRIMARY_SUPER_ADMIN_EMAIL='michel.herszak@gmail.com';
export type AccountRole='user'|'buyer'|'super_admin';
export type AccountStatus='active'|'suspended'|'deleted';

export type AccountProfile={
  userId:string;email:string;displayName:string;avatarPath:string|null;role:AccountRole;status:AccountStatus;
  emailVerifiedAt:number;termsAcceptedAt:number|null;termsVersion:string|null;
  privacyAcceptedAt:number|null;privacyVersion:string|null;createdAt:number;updatedAt:number;
  lastLoginAt:number;deletedAt:number|null;
};

type ProfileRow={
  user_id:string;email:string;display_name:string;avatar_path:string|null;role:AccountRole;status:AccountStatus;
  email_verified_at:number;terms_accepted_at:number|null;terms_version:string|null;
  privacy_accepted_at:number|null;privacy_version:string|null;created_at:number;updated_at:number;
  last_login_at:number;deleted_at:number|null;
};

function timestamp(value:unknown){
  if(typeof value!=='string')return null;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?parsed:null;
}

function metadataText(value:unknown,max:number){return typeof value==='string'?value.trim().slice(0,max):'';}
function accountRole(value:unknown):AccountRole{
  if(value==='buyer'||value==='super_admin')return value;
  if(value==='admin')return 'super_admin';
  return 'user';
}
function mapProfile(row:ProfileRow):AccountProfile{return {
  userId:row.user_id,email:row.email,displayName:row.display_name,avatarPath:row.avatar_path,role:accountRole(row.role),status:row.status,
  emailVerifiedAt:Number(row.email_verified_at),termsAcceptedAt:row.terms_accepted_at===null?null:Number(row.terms_accepted_at),
  termsVersion:row.terms_version,privacyAcceptedAt:row.privacy_accepted_at===null?null:Number(row.privacy_accepted_at),
  privacyVersion:row.privacy_version,createdAt:Number(row.created_at),updatedAt:Number(row.updated_at),
  lastLoginAt:Number(row.last_login_at),deletedAt:row.deleted_at===null?null:Number(row.deleted_at),
};}

export async function syncAccountProfile(db:D1Database,user:User,adminEmails:string|undefined,now=Date.now()){
  const email=user.email!.trim().toLowerCase();
  const existing=await db.prepare('SELECT * FROM user_profiles WHERE user_id=?').bind(user.id).first<ProfileRow>();
  const metadata=user.user_metadata||{};
  const displayName=metadataText(metadata.display_name,80)||existing?.display_name||email.split('@')[0];
  const requestedAvatarPath=metadataText(metadata.avatar_path,180);
  const avatarPath=requestedAvatarPath===`${user.id}/avatar`?requestedAvatarPath:existing?.avatar_path||null;
  const configuredAdmin=email===PRIMARY_SUPER_ADMIN_EMAIL||isAdminEmail(email,adminEmails);
  const role:AccountRole=configuredAdmin?'super_admin':accountRole(existing?.role);
  const status:AccountStatus=existing?.status||'active';
  const verifiedAt=timestamp(user.email_confirmed_at)||now;
  const acceptedAt=timestamp(metadata.accepted_at);
  const termsAcceptedAt=existing?.terms_accepted_at??acceptedAt;
  const privacyAcceptedAt=existing?.privacy_accepted_at??acceptedAt;
  const termsVersion=existing?.terms_version||metadataText(metadata.terms_version,32)||null;
  const privacyVersion=existing?.privacy_version||metadataText(metadata.privacy_version,32)||null;
  const createdAt=existing?.created_at??timestamp(user.created_at)??now;
  await db.prepare(`INSERT INTO user_profiles (
    user_id,email,display_name,avatar_path,role,status,email_verified_at,terms_accepted_at,terms_version,
    privacy_accepted_at,privacy_version,created_at,updated_at,last_login_at,deleted_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)
  ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,
    avatar_path=excluded.avatar_path,role=excluded.role,email_verified_at=excluded.email_verified_at,updated_at=excluded.updated_at,
    last_login_at=excluded.last_login_at`).bind(
      user.id,email,displayName,avatarPath,role,status,verifiedAt,termsAcceptedAt,termsVersion,
      privacyAcceptedAt,privacyVersion,createdAt,now,now,
    ).run();
  const saved=await db.prepare('SELECT * FROM user_profiles WHERE user_id=?').bind(user.id).first<ProfileRow>();
  if(!saved)throw new Error('Benutzerprofil konnte nicht gespeichert werden.');
  return {profile:mapProfile(saved),created:!existing};
}

export async function recordAuthEvent(db:D1Database,userId:string|null,event:string,detail:Record<string,unknown>={}){
  await db.prepare('INSERT INTO auth_audit_log (user_id,event,detail,created_at) VALUES (?,?,?,?)')
    .bind(userId,event,JSON.stringify(detail).slice(0,2000),Date.now()).run();
}

export async function getAccountProfile(db:D1Database,userId:string){
  const row=await db.prepare('SELECT * FROM user_profiles WHERE user_id=?').bind(userId).first<ProfileRow>();
  return row?mapProfile(row):null;
}

export async function listAccounts(db:D1Database){
  const {results}=await db.prepare(`SELECT * FROM user_profiles WHERE status != 'deleted'
    ORDER BY last_login_at DESC LIMIT 200`).all<ProfileRow>();
  return results.map(mapProfile);
}

export async function accountAudit(db:D1Database,userId:string){
  const {results}=await db.prepare(`SELECT event,detail,created_at FROM auth_audit_log
    WHERE user_id=? ORDER BY created_at DESC LIMIT 100`).bind(userId).all<{event:string;detail:string;created_at:number}>();
  return results.map(row=>({event:row.event,detail:JSON.parse(row.detail||'{}'),createdAt:Number(row.created_at)}));
}
