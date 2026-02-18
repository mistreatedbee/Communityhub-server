import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional().default(''),
  phone: z.string().optional().default('')
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const refreshSchema = z.object({
  accessToken: z.string().min(20),
  refreshToken: z.string().min(20)
});
