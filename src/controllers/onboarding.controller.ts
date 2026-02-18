import { Types } from 'mongoose';
import { LicenseModel } from '../models/License.js';
import { MembershipModel } from '../models/Membership.js';
import { PlanModel } from '../models/Plan.js';
import { TenantModel } from '../models/Tenant.js';
import { AppError } from '../utils/errors.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../utils/audit.js';

function isExpired(expiresAt?: Date | null) {
  return !!expiresAt && expiresAt.getTime() < Date.now();
}

export async function claimLicense(req: any, res: any) {
  const key = String(req.body.licenseKey || '').trim().toUpperCase();
  const license = await LicenseModel.findOne({ key }).lean();
  if (!license) throw new AppError('License not found', 404, 'NOT_FOUND');
  if (license.status !== 'ACTIVE') throw new AppError('License is not active', 400, 'LICENSE_INVALID');
  if (isExpired(license.expiresAt)) throw new AppError('License has expired', 400, 'LICENSE_EXPIRED');
  if (license.singleUse && license.claimedAt) throw new AppError('License already claimed', 400, 'LICENSE_CLAIMED');

  const existingSlug = await TenantModel.findOne({ slug: req.body.tenant.slug.toLowerCase() }).lean();
  if (existingSlug) throw new AppError('Slug already in use', 409, 'SLUG_EXISTS');

  const plan = await PlanModel.findById(license.planId).lean();
  if (!plan) throw new AppError('Linked plan not found', 400, 'PLAN_NOT_FOUND');

  const createdTenant = await TenantModel.create({
    name: req.body.tenant.name,
    slug: req.body.tenant.slug.toLowerCase(),
    description: req.body.tenant.description || '',
    logoUrl: req.body.tenant.logoUrl || '',
    category: req.body.tenant.category || '',
    location: req.body.tenant.location || '',
    status: 'ACTIVE',
    createdBy: new Types.ObjectId(req.user.sub)
  });

  await MembershipModel.create({
    tenantId: createdTenant._id,
    userId: new Types.ObjectId(req.user.sub),
    role: 'OWNER',
    status: 'ACTIVE'
  });

  await LicenseModel.updateOne(
    { _id: license._id },
    {
      status: 'CLAIMED',
      claimedAt: new Date(),
      claimedByUserId: new Types.ObjectId(req.user.sub),
      claimedTenantId: createdTenant._id,
      limitsSnapshot: {
        maxMembers: plan.maxMembers,
        maxAdmins: plan.maxAdmins,
        featureFlags: plan.featureFlags
      }
    }
  );

  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId: String(createdTenant._id),
    action: 'ONBOARDING_CLAIM_LICENSE',
    metadata: { licenseId: String(license._id), tenantSlug: createdTenant.slug }
  });

  return ok(
    res,
    {
      tenant: {
        id: String(createdTenant._id),
        name: createdTenant.name,
        slug: createdTenant.slug,
        status: createdTenant.status
      },
      redirectSlug: createdTenant.slug
    },
    201
  );
}
