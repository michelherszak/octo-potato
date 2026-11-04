'use client';

import {createClient, type SupabaseClient} from '@supabase/supabase-js';

let browserClient:SupabaseClient|null=null;
let browserConfig='';

export type PublicSupabaseConfig={url:string;publishableKey:string;configured:boolean};
export const AVATAR_BUCKET='avatars';

export function getSupabaseBrowserClient(config:PublicSupabaseConfig){
  if(!config.configured)throw new Error('Supabase ist noch nicht konfiguriert.');
  const nextConfig=config.url+'|'+config.publishableKey;
  if(!browserClient||browserConfig!==nextConfig){
    browserConfig=nextConfig;
    browserClient=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  }
  return browserClient;
}

export function safeNextPath(value:string|null,fallback='/konto'){
  if(!value||!value.startsWith('/')||value.startsWith('//'))return fallback;
  try{
    const url=new URL(value,'https://techthese.local');
    return url.origin==='https://techthese.local'&&url.pathname!=='/login'?url.pathname+url.search+url.hash:fallback;
  }catch{return fallback;}
}

export function publicAvatarUrl(client:SupabaseClient,userId:string,path:unknown,version?:unknown){
  if(typeof path!=='string'||path!==`${userId}/avatar`)return null;
  const {data}=client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const suffix=typeof version==='string'&&version?'?v='+encodeURIComponent(version):'';
  return data.publicUrl+suffix;
}
