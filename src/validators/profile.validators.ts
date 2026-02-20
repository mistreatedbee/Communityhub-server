import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).optional(),
  avatarUrl: z.string().url().optional()
});

