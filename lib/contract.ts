import {z} from 'zod';
import {topics} from './catalog.ts';
import {reviewSchema} from './publication-policy.ts';
import {memoOverviewSchema} from './memo-overview.ts';
const safeUrl=z.string().url().max(2000).refine(s=>/^https?:\/\//.test(s),'Nur HTTP(S)-Quellen');
const date=z.string().datetime({offset:true});
export const articleSchema=z.object({
  editorial_review:reviewSchema.optional(),
  memo_overview:memoOverviewSchema.optional(),
  schema_version:z.literal(1),slug:z.string().min(3).max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title:z.string().trim().min(5).max(180),description:z.string().trim().min(20).max(320),author:z.string().trim().min(2).max(120),
  topics:z.array(z.string().refine(s=>topics.some(t=>t.id===s))).min(1).max(8).refine(a=>new Set(a).size===a.length),
  ticker:z.string().max(30).default(''),company:z.string().max(150).default(''),kind:z.enum(['Analyse & Memo','Grundlagen']).default('Analyse & Memo'),
  thesis:z.string().trim().min(20).max(30000),memo:z.string().trim().min(20).max(60000),summary:z.array(z.string().max(700)).max(5).default([]),
  metrics:z.array(z.object({key:z.string().max(80),label:z.string().max(150),value:z.string().max(100),explanation:z.string().max(1200),period:z.string().max(150),source:z.string().max(500),source_url:safeUrl.optional()})).max(30).default([]),
  sources:z.array(z.object({title:z.string().min(1).max(300),url:safeUrl})).min(1).max(100),data_as_of:date,original_analysis_at:date.optional(),
  source_run_id:z.string().max(200).default(''),model_verdict:z.string().max(100).default(''),model_score:z.number().finite().min(0).max(100).nullable().default(null),
  top_risk:z.string().max(3000).default(''),methodology:z.string().max(2000).default(''),ai_assisted:z.boolean().default(true),
}).strict();
export const importSchema=z.object({publication_id:z.string().uuid(),expected_revision:z.number().int().nonnegative(),notify_subscribers:z.boolean().optional(),article:articleSchema.extend({editorial_review:reviewSchema.refine(r=>r.advertising==='none','Bezahlte und Affiliate-Beiträge sind bis zur gesonderten Prüfung gesperrt.')})}).strict();
export type Article=z.infer<typeof articleSchema> & {published_at?:string;updated_at?:string;revision?:number;example?:boolean};
export const storedArticleSchema=articleSchema.extend({published_at:date.optional(),updated_at:date.optional(),revision:z.number().int().positive().optional(),example:z.boolean().optional(),notification_requested:z.boolean().optional()});
export function metadataFor(a:Article,base:string) {const url=new URL('/analysen/'+a.slug,base).href;return {title:a.title+' | TechThese',description:a.description,alternates:{canonical:url},openGraph:{type:'article' as const,title:a.title,description:a.description,url,locale:'de_DE',siteName:'TechThese',publishedTime:a.published_at,modifiedTime:a.updated_at},robots:{index:!a.example,follow:true}};}
