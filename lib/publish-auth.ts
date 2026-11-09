import {env} from 'cloudflare:workers';

// Gemeinsame Prüfung für alles, was der private Publisher an die Website überträgt.
// Der Vergleich läuft über Hashwerte gleicher Länge und damit in konstanter Zeit.
export async function publisherAuthorized(request:Request){
  if(!env.PUBLISH_TOKEN||env.PUBLISH_TOKEN.length<32)return false;
  const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
  const digest=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const [a,b]=await Promise.all([digest(token),digest(env.PUBLISH_TOKEN)]);
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
}

// Liest den Rumpf mit Obergrenze, damit ein Paket den Worker nicht überlastet.
export async function readLimitedJson(request:Request,limit:number):Promise<{ok:true;value:unknown}|{ok:false;status:number;detail:string}>{
  const reader=request.body?.getReader();
  if(!reader)return {ok:false,status:400,detail:'Inhalt fehlt.'};
  let size=0;const chunks:Uint8Array[]=[];
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>limit){await reader.cancel();return {ok:false,status:413,detail:'Veröffentlichung ist zu groß.'};}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return {ok:true,value:JSON.parse(new TextDecoder().decode(bytes))};}
  catch{return {ok:false,status:400,detail:'Ungültiges JSON.'};}
}
