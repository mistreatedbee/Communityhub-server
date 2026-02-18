import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { fail } from '../utils/response.js';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'Validation failed', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    req.body = parsed.data;
    return next();
  };
}

