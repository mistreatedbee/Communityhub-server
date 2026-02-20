import type { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/response.js';

type GlobalRole = 'SUPER_ADMIN' | 'USER';

export function requireRole(role: GlobalRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
    if (req.user.globalRole !== role) return fail(res, 'Forbidden', 403, 'FORBIDDEN');
    return next();
  };
}

