import type { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/response.js';
import { verifyJwt } from '../utils/jwt.js';

export function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  try {
    req.user = verifyJwt(token);
    return next();
  } catch {
    return fail(res, 'Invalid or expired token', 401, 'INVALID_TOKEN');
  }
}

