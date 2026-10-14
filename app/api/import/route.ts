import {env} from 'cloudflare:workers';
import {importSchema} from '@/lib/contract';
import {siteUrl} from '@/lib/content';
import {importArticle,ImportConflict} from '@/lib/import-service';
async function authorized(request:Request) {if(!env.PUBLISH_TOKEN||env.PUBLISH_TOKEN.length<32)return false;const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [a,b]=await Promise.all([digest(token),digest(env.PUBLISH_TOKEN)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}
export async function POST(request:Request) {
  if(!await authorized(request))return Response.json({detail:'Veröffentlichung nicht autorisiert.'},{status:401});
  if(!env.DB)return Response.json({detail:'Inhaltsdatenbank fehlt.'},{status:503});
  const reader=request.body?.getReader();let size=0;const chunks:Uint8Array[]=[];if(!reader)return Response.json({detail:'Inhalt fehlt.'},{status:400});
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>400000){await reader.cancel();return Response.json({detail:'Veröffentlichung ist zu groß.'},{status:413});}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  let raw;try{raw=JSON.parse(new TextDecoder().decode(bytes));}catch{return Response.json({detail:'Ungültiges JSON.'},{status:400});}
  const parsed=importSchema.safeParse(raw);if(!parsed.success)return Response.json({detail:parsed.error.flatten()},{status:422});
  try{const result=await importArticle(env.DB,parsed.data,siteUrl());return Response.json(result,{status:result.idempotent?200:201});}
  catch(error){if(error instanceof ImportConflict)return Response.json({detail:error.message},{status:409});throw error;}
}
export async function GET(request:Request) {if(!await authorized(request))return Response.json({detail:'Nicht autorisiert.'},{status:401});const slug=new URL(request.url).searchParams.get('slug');const row=slug?await env.DB?.prepare('SELECT revision FROM articles WHERE slug=?').bind(slug).first<{revision:number}>():null;return Response.json({revision:row?.revision||0});}
