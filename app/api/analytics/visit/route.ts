import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isAdminEmail,parsePageView,recordPageView} from '@/lib/analytics';

const EXCLUDED={status:204,headers:{'cache-control':'no-store','x-techthese-analytics':'excluded'}};

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({detail:'Fremde Herkunft abgewiesen.'},{status:403});
  if(Number(request.headers.get('content-length')||0)>4096)return Response.json({detail:'Anfrage zu groß.'},{status:413});
  if(!env.DB)return Response.json({detail:'Statistikdatenbank fehlt.'},{status:503});
  let body:unknown;
  try{body=await request.json();}catch{return Response.json({detail:'Ungültiges JSON.'},{status:400});}
  const parsed=parsePageView(body);
  if(!parsed.success)return Response.json({detail:'Ungültige Statistikdaten.'},{status:400});
  if(parsed.data.path.split('?')[0].startsWith('/konto'))return new Response(null,EXCLUDED);
  // Eigene Admin-Besuche gehören nicht in die Statistik.
  const user=await getChatGPTUser();
  const host=(await headers()).get('host')||'';
  const allowLocalPreview=host.startsWith('localhost:')||host.startsWith('127.0.0.1:');
  if(user&&isAdminEmail(user.email,env.ADMIN_EMAILS,allowLocalPreview))return new Response(null,EXCLUDED);
  await recordPageView(env.DB,parsed.data);
  return new Response(null,{status:204,headers:{'cache-control':'no-store'}});
}
