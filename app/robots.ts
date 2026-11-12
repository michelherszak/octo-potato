import {env} from 'cloudflare:workers';
import {siteUrl} from '@/lib/content';

// Private Seiten werden nicht per robots.txt gesperrt, sondern tragen noindex. Eine Sperre
// hier würde das Auslesen verhindern: Suchmaschinen sähen das noindex nie und könnten die
// aus dem Fuß verlinkten Adressen trotzdem ohne Inhalt listen. Nur /api/ bleibt gesperrt,
// dort gibt es keine Seiten und damit auch kein noindex.
export default function robots(){
  const indexable=env.SITE_INDEXABLE==='true';
  return {
    rules:{userAgent:'*',...(indexable?{allow:'/',disallow:'/api/'}:{disallow:'/'})},
    sitemap:siteUrl()+'/sitemap.xml',
  };
}
