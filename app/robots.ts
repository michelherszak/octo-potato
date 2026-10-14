import {env} from 'cloudflare:workers';
import {siteUrl} from '@/lib/content';
export default function robots(){return {rules:{userAgent:'*',allow:env.SITE_INDEXABLE==='true'?'/':undefined,disallow:env.SITE_INDEXABLE==='true'?'/api/':'/'},sitemap:siteUrl()+'/sitemap.xml'};}
