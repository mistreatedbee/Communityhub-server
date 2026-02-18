import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { MembershipModel, type TenantRole } from '../models/Membership.js';
import { fail } from '../utils/response.js';

export function requireTenantRole(roles: TenantRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
    if (req.user.globalRole === 'SUPER_ADMIN') return next();

    const tenantIdRaw =
      req.params.tenantId || req.body?.tenantId || req.query.tenantId || req.params.id || '';
    if (!tenantIdRaw || !Types.ObjectId.isValid(String(tenantIdRaw))) {
      return fail(res, 'Valid tenantId is required', 400, 'VALIDATION_ERROR');
    }

    const membership = await MembershipModel.findOne({
      tenantId: tenantIdRaw,
      userId: req.user.sub,
      status: 'ACTIVE'
    }).lean();

    if (!membership || !roles.includes(membership.role)) {
      return fail(res, 'Forbidden', 403, 'FORBIDDEN');
    }

    return next();
  };
}

