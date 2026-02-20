import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { MembershipModel, type TenantRole } from '../models/Membership.js';
import { fail } from '../utils/response.js';

export function requireTenantRole(roles: TenantRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
    if (req.user.globalRole === 'SUPER_ADMIN') return next();

    // Prefer route param for tenant-scoped paths to prevent parameter substitution
    const tenantIdRaw =
      req.params.tenantId ?? req.params.id ?? req.body?.tenantId ?? req.query?.tenantId ?? '';
    const tenantIdStr = String(tenantIdRaw).trim();
    if (!tenantIdStr || !Types.ObjectId.isValid(tenantIdStr)) {
      return fail(res, 'Valid tenantId is required', 400, 'VALIDATION_ERROR');
    }

    const membership = await MembershipModel.findOne({
      tenantId: tenantIdStr,
      userId: req.user.sub,
      status: 'ACTIVE'
    }).lean();

    if (!membership || !roles.includes(membership.role)) {
      return fail(res, 'Forbidden', 403, 'FORBIDDEN');
    }

    return next();
  };
}

