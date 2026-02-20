import { z } from 'zod';

export const generateLicenseSchema = z.object({
  planId: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
  singleUse: z.boolean().optional().default(true)
});

export const verifyLicenseSchema = z.object({
  licenseKey: z.string().min(4)
});

const sectionKeys = ['announcements', 'resources', 'groups', 'events', 'programs'] as const;

export const claimLicenseSchema = z.object({
  licenseKey: z.string().min(4),
  tenant: z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    description: z.string().optional().default(''),
    logoUrl: z.string().optional().default(''),
    logoFileId: z.string().optional().default(''),
    category: z.string().optional().default(''),
    location: z.string().optional().default(''),
    primaryColor: z.string().optional().default(''),
    secondaryColor: z.string().optional().default(''),
    enabledSections: z
      .array(z.enum(sectionKeys))
      .optional()
      .default([...sectionKeys])
  })
});
