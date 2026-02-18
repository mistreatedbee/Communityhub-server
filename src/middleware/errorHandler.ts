import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { fail } from '../utils/response.js';

export function notFound(_req: Request, res: Response) {
  return fail(res, 'Route not found', 404, 'NOT_FOUND');
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return fail(res, err.message, err.statusCode, err.code, err.details);
  }

  if (err instanceof ZodError) {
    return fail(res, 'Validation failed', 422, 'VALIDATION_ERROR', err.flatten());
  }

  console.error(err);
  return fail(res, 'Internal server error', 500, 'INTERNAL_SERVER_ERROR');
}

