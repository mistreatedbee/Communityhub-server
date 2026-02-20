import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().default(''),
  maxMembers: z.number().int().positive(),
  maxAdmins: z.number().int().positive(),
  featureFlags: z.record(z.any()).optional().default({})
});

export const updatePlanSchema = createPlanSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  'At least one field is required'
);

