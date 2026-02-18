import { Types } from 'mongoose';
import { LicenseModel } from '../models/License.js';
import { PlanModel } from '../models/Plan.js';
import { AppError } from '../utils/errors.js';
import { ok } from '../utils/response.js';
import { generateLicenseKey } from '../utils/generateLicenseKey.js';
import { writeAuditLog } from '../utils/audit.js';

function isExpired(expiresAt?: Date | null) {
  return !!expiresAt && expiresAt.getTime() < Date.now();
}

async function resolveLicenseByKey(rawKey: string) {
  const key = String(rawKey || '').trim().toUpperCase();
  const license = await LicenseModel.findOne({ key }).populate('planId').lean();
  if (!license) throw new AppError('License not found', 404, 'NOT_FOUND');
  return license;
}

export async function generateLicense(req: any, res: any) {
  const plan = await PlanModel.findById(req.body.planId).lean();
  if (!plan) throw new AppError('Plan not found', 404, 'NOT_FOUND');

  const created = await LicenseModel.create({
    key: generateLicenseKey(),
    planId: new Types.ObjectId(req.body.planId),
    singleUse: req.body.singleUse ?? true,
    expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
    limitsSnapshot: {
      maxMembers: plan.maxMembers,
      maxAdmins: plan.maxAdmins,
      featureFlags: plan.featureFlags
    },
    createdBy: new Types.ObjectId(req.user.sub)
  });

  await writeAuditLog({
    actorUserId: req.user.sub,
    action: 'LICENSE_GENERATE',
    metadata: { licenseId: String(created._id), key: created.key, planId: req.body.planId }
  });

  return ok(res, created, 201);
}

export async function listLicenses(_req: any, res: any) {
  const licenses = await LicenseModel.find().populate('planId').sort({ createdAt: -1 }).lean();
  return ok(res, licenses);
}

export async function suspendLicense(req: any, res: any) {
  const license = await LicenseModel.findByIdAndUpdate(
    req.params.id,
    { status: 'SUSPENDED' },
    { new: true }
  ).lean();
  if (!license) throw new AppError('License not found', 404, 'NOT_FOUND');

  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId: license.claimedTenantId ? String(license.claimedTenantId) : null,
    action: 'LICENSE_SUSPEND',
    metadata: { licenseId: String(license._id) }
  });

  return ok(res, license);
}

export async function verifyLicense(req: any, res: any) {
  const license = await resolveLicenseByKey(req.body.licenseKey);
  const plan = license.planId as any;

  if (license.status !== 'ACTIVE') {
    throw new AppError('License is not active', 400, 'LICENSE_INVALID');
  }
  if (isExpired(license.expiresAt)) {
    await LicenseModel.updateOne({ _id: license._id }, { status: 'EXPIRED' });
    throw new AppError('License has expired', 400, 'LICENSE_EXPIRED');
  }

  return ok(res, {
    valid: true,
    license: {
      id: String(license._id),
      key: license.key,
      singleUse: license.singleUse,
      expiresAt: license.expiresAt,
      status: license.status
    },
    plan: plan
      ? {
          id: String(plan._id),
          name: plan.name,
          description: plan.description,
          maxMembers: plan.maxMembers,
          maxAdmins: plan.maxAdmins,
          featureFlags: plan.featureFlags
        }
      : null,
    limits: license.limitsSnapshot
  });
}

