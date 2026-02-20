import { Types } from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.js';
import { LicenseModel } from '../models/License.js';
import { TenantModel } from '../models/Tenant.js';
import { UserModel } from '../models/User.js';
import { MembershipModel } from '../models/Membership.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';

export async function overview(_req: any, res: any) {
  const [users, tenants, activeLicenses, recentAuditLogs] = await Promise.all([
    UserModel.countDocuments(),
    TenantModel.countDocuments(),
    LicenseModel.countDocuments({ status: 'ACTIVE' }),
    AuditLogModel.find().sort({ createdAt: -1 }).limit(12).lean()
  ]);

  return ok(res, {
    users,
    tenants,
    activeLicenses,
    recentAuditLogs: recentAuditLogs.map((l) => ({
      id: String(l._id),
      actorUserId: l.actorUserId ? String(l.actorUserId) : null,
      tenantId: l.tenantId ? String(l.tenantId) : null,
      action: l.action,
      metadata: l.metadata,
      createdAt: l.createdAt
    }))
  });
}

export async function listUsers(_req: any, res: any) {
  const users = await UserModel.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).lean();
  return ok(
    res,
    users.map((u) => ({
      id: String(u._id),
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      avatarUrl: u.avatarUrl,
      globalRole: u.globalRole,
      status: u.status || 'ACTIVE',
      createdAt: u.createdAt
    }))
  );
}

export async function updateUserRoleStatus(req: any, res: any) {
  const userId = String(req.params.userId || '');
  const updates: Record<string, unknown> = {};
  const globalRole = req.body?.globalRole;
  const status = req.body?.status;

  if (globalRole !== undefined) {
    if (!['SUPER_ADMIN', 'USER'].includes(globalRole)) {
      return res.status(422).json({
        success: false,
        error: { message: 'globalRole must be SUPER_ADMIN or USER', code: 'VALIDATION_ERROR' }
      });
    }
    updates.globalRole = globalRole;
  }

  if (status !== undefined) {
    if (!['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) {
      return res.status(422).json({
        success: false,
        error: { message: 'status must be ACTIVE, SUSPENDED, or BANNED', code: 'VALIDATION_ERROR' }
      });
    }
    updates.status = status;
  }

  if (!Object.keys(updates).length) {
    return res.status(422).json({
      success: false,
      error: { message: 'No valid fields to update', code: 'VALIDATION_ERROR' }
    });
  }

  const updated = await UserModel.findByIdAndUpdate(userId, updates, {
    new: true,
    projection: { passwordHash: 0 }
  }).lean();

  if (!updated) {
    return res.status(404).json({
      success: false,
      error: { message: 'User not found', code: 'NOT_FOUND' }
    });
  }

  await writeAuditLog({
    actorUserId: req.user.sub,
    action: 'SUPER_ADMIN_USER_ROLE_STATUS_UPDATED',
    metadata: {
      targetUserId: String(updated._id),
      globalRole: updated.globalRole,
      status: updated.status || 'ACTIVE'
    }
  });

  return ok(res, {
    id: String(updated._id),
    email: updated.email,
    fullName: updated.fullName,
    phone: updated.phone,
    avatarUrl: updated.avatarUrl,
    globalRole: updated.globalRole,
    status: updated.status || 'ACTIVE',
    createdAt: updated.createdAt
  });
}

function normalizeSlug(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function promoteUserToTenant(req: any, res: any) {
  const userId = String(req.params.userId || '');
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid userId', 422, 'VALIDATION_ERROR');
  }

  const user = await UserModel.findById(userId).lean();
  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  const existingTenantId = String(req.body?.existingTenantId || '').trim();
  const membershipRole = req.body?.membershipRole === 'ADMIN' ? 'ADMIN' : 'OWNER';
  let tenant: any = null;
  let createdTenant = false;

  if (existingTenantId) {
    if (!Types.ObjectId.isValid(existingTenantId)) {
      throw new AppError('Invalid existingTenantId', 422, 'VALIDATION_ERROR');
    }
    tenant = await TenantModel.findById(existingTenantId).lean();
    if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');
  } else {
    const tenantName = String(req.body?.tenantName || '').trim();
    const tenantSlug = normalizeSlug(String(req.body?.tenantSlug || ''));
    const logoUrl = String(req.body?.logoUrl || '').trim();

    if (!tenantName || !tenantSlug) {
      throw new AppError('tenantName and tenantSlug are required', 422, 'VALIDATION_ERROR');
    }

    const slugExists = await TenantModel.findOne({ slug: tenantSlug }).lean();
    if (slugExists) {
      throw new AppError('Slug already in use', 409, 'SLUG_EXISTS');
    }

    tenant = await TenantModel.create({
      name: tenantName,
      slug: tenantSlug,
      description: '',
      logoUrl,
      category: '',
      location: '',
      status: 'ACTIVE',
      createdBy: new Types.ObjectId(userId)
    });
    createdTenant = true;
  }

  const membership = await MembershipModel.findOneAndUpdate(
    { tenantId: tenant._id, userId: new Types.ObjectId(userId) },
    {
      tenantId: tenant._id,
      userId: new Types.ObjectId(userId),
      role: membershipRole,
      status: 'ACTIVE'
    },
    { upsert: true, new: true }
  ).lean();

  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId: String(tenant._id),
    action: 'SUPER_ADMIN_PROMOTE_USER_TO_TENANT',
    metadata: {
      targetUserId: userId,
      tenantId: String(tenant._id),
      tenantSlug: tenant.slug,
      membershipRole,
      createdTenant
    }
  });

  return ok(res, {
    user: {
      id: String(user._id),
      email: user.email,
      fullName: user.fullName || ''
    },
    tenant: {
      id: String(tenant._id),
      name: tenant.name,
      slug: tenant.slug
    },
    membership: {
      id: String(membership?._id || ''),
      role: membership?.role || membershipRole,
      status: membership?.status || 'ACTIVE'
    },
    adminRoute: `/c/${tenant.slug}/admin`,
    createdTenant
  });
}

export async function listTenants(_req: any, res: any) {
  const tenants = await TenantModel.find().sort({ createdAt: -1 }).lean();
  return ok(
    res,
    tenants.map((t) => ({
      id: String(t._id),
      name: t.name,
      slug: t.slug,
      status: t.status,
      category: t.category,
      location: t.location,
      logoUrl: t.logoUrl,
      createdBy: String(t.createdBy),
      createdAt: t.createdAt
    }))
  );
}

export async function createTenant(req: any, res: any) {
  const created = await TenantModel.create({
    name: req.body.name,
    slug: String(req.body.slug).toLowerCase(),
    description: req.body.description || '',
    logoUrl: req.body.logoUrl || '',
    category: req.body.category || '',
    location: req.body.location || '',
    status: req.body.status || 'ACTIVE',
    createdBy: new Types.ObjectId(req.user.sub)
  });

  await MembershipModel.create({
    tenantId: created._id,
    userId: req.user.sub,
    role: 'OWNER',
    status: 'ACTIVE'
  });

  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId: String(created._id),
    action: 'ADMIN_CREATE_TENANT',
    metadata: { name: created.name, slug: created.slug }
  });

  return ok(
    res,
    {
      id: String(created._id),
      name: created.name,
      slug: created.slug,
      description: created.description,
      status: created.status
    },
    201
  );
}

export async function updateTenantStatus(req: any, res: any) {
  const status = req.body.status;
  if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
    return res.status(422).json({
      success: false,
      error: { message: 'status must be ACTIVE or SUSPENDED', code: 'VALIDATION_ERROR' }
    });
  }

  const tenant = await TenantModel.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
  if (!tenant) {
    return res.status(404).json({
      success: false,
      error: { message: 'Tenant not found', code: 'NOT_FOUND' }
    });
  }

  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId: String(tenant._id),
    action: 'ADMIN_UPDATE_TENANT_STATUS',
    metadata: { status }
  });

  return ok(res, tenant);
}

export async function deleteTenant(req: any, res: any) {
  const tenant = await TenantModel.findByIdAndDelete(req.params.id).lean();
  if (!tenant) {
    return res.status(404).json({
      success: false,
      error: { message: 'Tenant not found', code: 'NOT_FOUND' }
    });
  }

  await MembershipModel.deleteMany({ tenantId: req.params.id });

  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId: String(req.params.id),
    action: 'ADMIN_DELETE_TENANT',
    metadata: {}
  });

  return res.status(204).send();
}
