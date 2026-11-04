import {permanentRedirect} from 'next/navigation';
// Der Unternehmenskatalog ist der Einstieg der Website und liegt jetzt auf "/".
export default async function Companies({searchParams}:{searchParams:Promise<{q?:string}>}){const {q=''}=await searchParams;permanentRedirect(q?'/?q='+encodeURIComponent(q):'/');}
