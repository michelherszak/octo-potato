import {allArticles,siteUrl} from '@/lib/content';
import {topics,companies} from '@/lib/catalog';
export const dynamic='force-dynamic';
export default async function sitemap(){const base=siteUrl();const articles=(await allArticles()).filter(a=>!a.example);return [...['/','/themen','/unternehmen','/methodik','/autor'].map(p=>({url:base+p})),...topics.map(t=>({url:base+'/themen/'+t.id})),...companies.map(c=>({url:base+'/unternehmen/'+c.ticker})),...articles.map(a=>({url:base+'/analysen/'+a.slug,lastModified:a.updated_at||a.data_as_of}))];}
