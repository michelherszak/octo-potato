import {env} from 'cloudflare:workers';
import {parsePageView,recordPageView} from '@/lib/analytics';

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({detail:'Fremde Herkunft abgewiesen.'},{status:403});
  if(Number(request.headers.get('content-length')||0)>4096)return Response.json({detail:'Anfrage zu groß.'},{status:413});
  if(!env.DB)return Response.json({detail:'Statistikdatenbank fehlt.'},{status:503});
  let body:unknown;
  try{body=await request.json();}catch{return Response.json({detail:'Ungültiges JSON.'},{status:400});}
  const parsed=parsePageView(body);
  if(!parsed.success)return Response.json({detail:'Ungültige Statistikdaten.'},{status:400});
  await recordPageView(env.DB,parsed.data);
  return new Response(null,{status:204,headers:{'cache-control':'no-store'}});
}
