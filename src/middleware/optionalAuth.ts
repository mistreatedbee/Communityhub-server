import type { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../utils/jwt.js';

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next();

  try {
    req.user = verifyJwt(token);
  } catch {
    // Ignore invalid token for optional auth routes.
  }

  return next();
}

