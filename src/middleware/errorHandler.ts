import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { fail } from '../utils/response.js';

export function notFound(req: Request, res: Response) {
  // #region agent log
  fetch('http://127.0.0.1:7630/ingest/cc90b081-2609-4b39-8823-a7eedb649dc4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '157c0c' },
    body: JSON.stringify({
      sessionId: '157c0c',
      location: 'errorHandler.ts:notFound',
      message: '404 notFound hit',
      data: { method: req.method, url: req.originalUrl, path: req.path },
      timestamp: Date.now(),
      hypothesisId: 'H1'
    })
  }).catch(() => {});
  // #endregion
  return fail(res, 'Route not found', 404, 'NOT_FOUND');
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return fail(res, err.message, err.statusCode, err.code, err.details);
  }

  if (err instanceof ZodError) {
    return fail(res, 'Validation failed', 422, 'VALIDATION_ERROR', err.flatten());
  }

  // #region agent log
  fetch('http://127.0.0.1:7630/ingest/cc90b081-2609-4b39-8823-a7eedb649dc4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '157c0c' },
    body: JSON.stringify({
      sessionId: '157c0c',
      location: 'errorHandler.ts:errorHandler',
      message: '500 unhandled error',
      data: { errMessage: (err as Error)?.message, errName: (err as Error)?.name },
      timestamp: Date.now(),
      hypothesisId: 'H5'
    })
  }).catch(() => {});
  // #endregion
  console.error(err);
  return fail(res, 'Internal server error', 500, 'INTERNAL_SERVER_ERROR');
}

