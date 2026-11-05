import {siteUrl} from './content.ts';

export const SITE_NAME='TechThese';

export function canonicalUrl(path:string){return new URL(path,siteUrl()).href;}

// Suchparameter wie ?q= erzeugen sonst beliebig viele Adressen mit gleichem Inhalt.
export function pageMetadata({path,title,description,noindex=false}:{path:string;title:string;description?:string;noindex?:boolean}){
  const url=canonicalUrl(path);
  return {
    title,
    ...(description?{description}:{}),
    alternates:{canonical:url},
    openGraph:{type:'website' as const,locale:'de_DE',siteName:SITE_NAME,title,url,...(description?{description}:{})},
    ...(noindex?{robots:{index:false,follow:false}}:{}),
  };
}

export function organizationLd(){
  return {'@context':'https://schema.org','@type':'Organization',name:SITE_NAME,url:siteUrl(),
    description:'Verständliche Technologieanalysen und Aktienmemos mit Kennzahlen, Quellen und nachvollziehbaren Thesen.'};
}

export function websiteLd(){
  return {'@context':'https://schema.org','@type':'WebSite',name:SITE_NAME,url:siteUrl(),inLanguage:'de-DE',
    potentialAction:{'@type':'SearchAction',target:{'@type':'EntryPoint',urlTemplate:siteUrl()+'/?q={search_term_string}'},'query-input':'required name=search_term_string'}};
}

export function breadcrumbLd(trail:Array<{name:string;path:string}>){
  return {'@context':'https://schema.org','@type':'BreadcrumbList',
    itemListElement:trail.map((entry,index)=>({'@type':'ListItem',position:index+1,name:entry.name,item:canonicalUrl(entry.path)}))};
}

export function jsonLd(data:unknown){return {__html:JSON.stringify(data).replace(/</g,'\\u003c')};}
