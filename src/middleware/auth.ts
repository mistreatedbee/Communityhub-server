import type { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/response.js';
import { verifyJwt } from '../utils/jwt.js';
import { UserModel } from '../models/User.js';

export async function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  try {
    req.user = verifyJwt(token);
    const user = await UserModel.findById(req.user.sub).select({ status: 1 }).lean();
    if (!user) {
      return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
    }
    if (user.status === 'SUSPENDED') {
      return fail(res, 'Account suspended', 403, 'ACCOUNT_SUSPENDED');
    }
    if (user.status === 'BANNED') {
      return fail(res, 'Account banned', 403, 'ACCOUNT_BANNED');
    }
    return next();
  } catch {
    return fail(res, 'Invalid or expired token', 401, 'INVALID_TOKEN');
  }
}

