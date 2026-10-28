import {z} from 'zod';

export const ratingBands=['Strong Buy','Buy','Hold','Sell','Strong Sell'] as const;
export const memoMetricSchema=z.object({
  key:z.string().max(80),label:z.string().max(150),value:z.string().max(100),
  explanation:z.string().max(1200),period:z.string().max(150),source:z.string().max(500),
  source_url:z.string().url().max(2000).refine(s=>/^https?:\/\//.test(s)).optional(),
}).strict();
export const memoOverviewSchema=z.object({
  questions:z.array(z.object({
    group:z.enum(['value','quality','growth','momentum']),question:z.string().max(200),
    answer:z.string().max(1000),detail:z.string().max(2500),note:z.string().max(3000),
    signal:z.enum(['green','amber','red','unknown']),
  }).strict()).max(4),
  money_story:z.string().max(5000),money_metrics:z.array(memoMetricSchema).max(8),
  costs:z.array(memoMetricSchema).max(12),
  piotroski:z.object({score:z.number().int().min(0).max(9).nullable(),period:z.string().max(150),source:z.string().max(500),source_url:z.string().url().max(2000).refine(s=>/^https?:\/\//.test(s)).optional()}).strict(),
  street:z.object({verdict:z.enum(ratingBands),analysts:z.number().int().nonnegative().nullable(),meaning:z.string().max(3000)}).strict().nullable(),
  reliability:z.array(z.string().max(3000)).max(12),dilution:z.string().max(2000),
}).strict();
export type MemoOverviewData=z.infer<typeof memoOverviewSchema>;
