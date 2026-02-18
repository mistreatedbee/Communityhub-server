import { Types } from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.js';
import { LicenseModel } from '../models/License.js';
import { TenantModel } from '../models/Tenant.js';
import { UserModel } from '../models/User.js';
import { MembershipModel } from '../models/Membership.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../utils/audit.js';

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
      createdAt: u.createdAt
    }))
  );
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
