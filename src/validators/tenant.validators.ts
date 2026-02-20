import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional().default(''),
  logoUrl: z.string().optional().default(''),
  category: z.string().optional().default(''),
  location: z.string().optional().default(''),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional().default('ACTIVE')
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional().default(''),
  expiresInDays: z.number().int().min(1).max(30).optional().default(7),
  role: z.enum(['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER']).optional().default('MEMBER')
});
