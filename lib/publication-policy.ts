import {z} from 'zod';

// These confirmations belong to the exact article revision being imported.
export const reviewSchema=z.object({
  reviewer:z.string().trim().min(2).max(120),
  reviewed_at:z.string().datetime({offset:true}),
  edited:z.literal(true), facts_checked:z.literal(true),
  commercial_rights_confirmed:z.literal(true),
  rights_basis:z.string().trim().min(30).max(3000),
  conflicts:z.string().trim().min(20).max(3000),
  advertising:z.enum(['none','paid','affiliate']),
  advertising_details:z.string().trim().min(20).max(2000),
}).strict();
