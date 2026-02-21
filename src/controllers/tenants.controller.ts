import crypto from 'crypto';
import { Types } from 'mongoose';
import { MembershipModel } from '../models/Membership.js';
import { TenantModel } from '../models/Tenant.js';
import { UserModel } from '../models/User.js';
import { LicenseModel } from '../models/License.js';
import { MemberProfileModel } from '../models/MemberProfile.js';
import {
  AnnouncementModel,
  EventModel,
  InvitationModel,
  RegistrationFieldModel,
  TenantSettingsModel,
  TenantHomepageSettingsModel
} from '../models/TenantFeatureModels.js';
import { AppError } from '../utils/errors.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../utils/audit.js';

function normalizeInvitationStatus(status: string, expiresAt: Date) {
  if (status === 'REVOKED') return 'REVOKED';
  if (status === 'ACCEPTED') return 'ACCEPTED';
  if (new Date(expiresAt).getTime() < Date.now()) return 'EXPIRED';
  return 'SENT';
}

function mapMembership(membership: any) {
  return {
    id: String(membership._id),
    tenantId: String(membership.tenantId),
    role: membership.role,
    status: membership.status,
    joinedAt: membership.createdAt,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt
  };
}

function getMembershipRoute(slug: string, membership: { role: string; status: string }) {
  if (membership.status === 'PENDING') return `/c/${slug}/pending`;
  if (membership.role === 'OWNER' || membership.role === 'ADMIN' || membership.role === 'MODERATOR') {
    return `/c/${slug}/admin`;
  }
  return `/c/${slug}`;
}

export async function listPublicTenants(req: any, res: any) {
  const query = String(req.query.query || '').trim();
  const filter = query
    ? {
        status: 'ACTIVE',
        $or: [{ name: { $regex: query, $options: 'i' } }, { slug: { $regex: query, $options: 'i' } }]
      }
    : { status: 'ACTIVE' };

  const tenants = await TenantModel.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  return ok(
    res,
    tenants.map((t) => ({
      id: String(t._id),
      name: t.name,
      slug: t.slug,
      description: t.description,
      logoUrl: t.logoUrl,
      category: t.category,
      location: t.location,
      status: t.status
    }))
  );
}

export async function getTenantPublic(req: any, res: any) {
  const tenant = await TenantModel.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
  if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');
  const [settings, homepageSettings] = await Promise.all([
    TenantSettingsModel.findOne({ tenantId: tenant._id }).lean(),
    TenantHomepageSettingsModel.findOne({ tenantId: tenant._id }).lean()
  ]);
  const theme = homepageSettings?.theme;
  return ok(res, {
    ...tenant,
    id: String(tenant._id),
    enabledSections:
      Array.isArray(settings?.enabledSections) && settings.enabledSections.length > 0
        ? settings.enabledSections
        : DEFAULT_ENABLED_SECTIONS,
    theme: {
      primaryColor: theme?.primaryColor ?? '',
      secondaryColor: theme?.secondaryColor ?? '',
      logoUrl: theme?.logoUrl ?? ''
    }
  });
}

export async function getTenantPublicPreview(req: any, res: any) {
  const slug = String(req.params.slug).toLowerCase();
  const tenant = await TenantModel.findOne({ slug, status: 'ACTIVE' }).lean();
  if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');

  const now = new Date();
  const [settings, homepageSettings, upcomingEvents, recentAnnouncements] = await Promise.all([
    TenantSettingsModel.findOne({ tenantId: tenant._id }).lean(),
    TenantHomepageSettingsModel.findOne({ tenantId: tenant._id }).lean(),
    EventModel.find({ tenantId: tenant._id, startsAt: { $gte: now } })
      .sort({ startsAt: 1 })
      .limit(10)
      .lean(),
    AnnouncementModel.find({ tenantId: tenant._id, visibility: 'PUBLIC' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
  ]);

  const theme = homepageSettings?.theme;
  const resolvedLogoUrl = theme?.logoUrl || (tenant as any).logoUrl || '';

  return ok(res, {
    tenant: {
      id: String(tenant._id),
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description ?? '',
      category: tenant.category ?? '',
      location: tenant.location ?? '',
      logoUrl: resolvedLogoUrl
    },
    theme: {
      primaryColor: theme?.primaryColor ?? '',
      secondaryColor: theme?.secondaryColor ?? '',
      logoUrl: resolvedLogoUrl
    },
    enabledSections:
      Array.isArray(settings?.enabledSections) && settings.enabledSections.length > 0
        ? settings.enabledSections
        : DEFAULT_ENABLED_SECTIONS,
    upcomingEvents: upcomingEvents.map((e: any) => ({
      _id: String(e._id),
      title: e.title,
      startsAt: e.startsAt,
      location: e.location ?? undefined,
      isOnline: e.isOnline ?? undefined,
      meetingLink: e.meetingLink ?? undefined
    })),
    recentAnnouncements: recentAnnouncements.map((a: any) => ({
      _id: String(a._id),
      title: a.title,
      content: a.content ?? '',
      isPinned: a.isPinned ?? false
    }))
  });
}

export async function getTenantById(req: any, res: any) {
  const tenantId = String(req.params.tenantId || '');
  if (!Types.ObjectId.isValid(tenantId)) throw new AppError('Invalid tenantId', 400, 'VALIDATION_ERROR');

  const tenant = await TenantModel.findById(tenantId).lean();
  if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');

  if (req.user?.globalRole !== 'SUPER_ADMIN') {
    const member = await MembershipModel.findOne({
      tenantId,
      userId: new Types.ObjectId(req.user.sub),
      status: 'ACTIVE'
    }).lean();
    if (!member) throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }

  return ok(res, {
    id: String(tenant._id),
    name: tenant.name,
    slug: tenant.slug,
    description: tenant.description,
    status: tenant.status,
    category: tenant.category,
    location: tenant.location,
    logoUrl: tenant.logoUrl,
    logoFileId: (tenant as any).logoFileId ?? ''
  });
}

export async function updateTenant(req: any, res: any) {
  const tenantId = String(req.params.tenantId || '');
  if (!Types.ObjectId.isValid(tenantId)) throw new AppError('Invalid tenantId', 400, 'VALIDATION_ERROR');

  const tenant = await TenantModel.findById(tenantId);
  if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');

  const member = await MembershipModel.findOne({
    tenantId,
    userId: new Types.ObjectId(req.user.sub),
    status: 'ACTIVE'
  }).lean();
  if (!member) throw new AppError('Forbidden', 403, 'FORBIDDEN');
  if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
    throw new AppError('Only owners and admins can update the community profile', 403, 'FORBIDDEN');
  }

  if (req.body.name !== undefined) tenant.name = String(req.body.name).trim();
  if (req.body.description !== undefined) tenant.description = String(req.body.description || '').trim();
  if (req.body.logoFileId !== undefined) {
    tenant.logoFileId = String(req.body.logoFileId || '').trim();
    tenant.logoUrl = ''; // Device upload only; no external URL
  }
  if (req.body.logoUrl !== undefined) tenant.logoUrl = String(req.body.logoUrl || '').trim();
  if (req.body.category !== undefined) tenant.category = String(req.body.category || '').trim();
  if (req.body.location !== undefined) tenant.location = String(req.body.location || '').trim();
  await tenant.save();

  return ok(res, {
    id: String(tenant._id),
    name: tenant.name,
    slug: tenant.slug,
    description: tenant.description,
    status: tenant.status,
    category: tenant.category,
    location: tenant.location,
    logoUrl: tenant.logoUrl
  });
}

const DEFAULT_ENABLED_SECTIONS = ['announcements', 'resources', 'groups', 'events', 'programs'];

export async function getTenantContext(req: any, res: any) {
  const tenant = await TenantModel.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
  if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');

  const [license, settings, homepageSettings, membership] = await Promise.all([
    LicenseModel.findOne({ claimedTenantId: tenant._id }).populate('planId').lean(),
    TenantSettingsModel.findOne({ tenantId: tenant._id }).lean(),
    TenantHomepageSettingsModel.findOne({ tenantId: tenant._id }).lean(),
    req.user?.sub
      ? MembershipModel.findOne({
          tenantId: tenant._id,
          userId: new Types.ObjectId(req.user.sub)
        }).lean()
      : Promise.resolve(null)
  ]);

  const theme = homepageSettings?.theme;
  return ok(res, {
    tenant: {
      id: String(tenant._id),
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description ?? '',
      logoUrl: tenant.logoUrl ?? '',
      logoFileId: (tenant as any).logoFileId ?? '',
      category: tenant.category ?? '',
      location: tenant.location ?? '',
      status: tenant.status
    },
    license: license
      ? {
          id: String(license._id),
          status: license.status,
          expiresAt: license.expiresAt,
          singleUse: license.singleUse,
          limitsSnapshot: license.limitsSnapshot,
          plan: license.planId
        }
      : null,
    settings: {
      publicSignup: settings?.publicSignup ?? true,
      approvalRequired: settings?.approvalRequired ?? false,
      registrationFieldsEnabled: settings?.registrationFieldsEnabled ?? true,
      enabledSections: Array.isArray(settings?.enabledSections) && settings.enabledSections.length > 0
        ? settings.enabledSections
        : DEFAULT_ENABLED_SECTIONS
    },
    theme: {
      primaryColor: theme?.primaryColor ?? '',
      secondaryColor: theme?.secondaryColor ?? '',
      logoUrl: theme?.logoUrl ?? (tenant as any).logoUrl ?? ''
    },
    membership: membership ? mapMembership(membership) : null
  });
}

export async function getTenantMembers(req: any, res: any) {
  const rows = await MembershipModel.find({ tenantId: req.params.tenantId })
    .populate('userId', 'email fullName phone avatarUrl globalRole')
    .sort({ createdAt: -1 })
    .lean();

  return ok(
    res,
    rows.map((m: any) => ({
      id: String(m._id),
      tenantId: String(m.tenantId),
      role: m.role,
      status: m.status,
      user: m.userId
        ? {
            id: String(m.userId._id),
            email: m.userId.email,
            fullName: m.userId.fullName,
            phone: m.userId.phone,
            avatarUrl: m.userId.avatarUrl,
            globalRole: m.userId.globalRole
          }
        : null
    }))
  );
}

export async function inviteMember(req: any, res: any) {
  const tenant = await TenantModel.findById(req.params.tenantId).lean();
  if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');

  const email = String(req.body.email).toLowerCase().trim();
  const role = req.body.role || 'MEMBER';
  const phone = String(req.body.phone || '').trim();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const created = await InvitationModel.create({
    tenantId: tenant._id,
    email,
    phone,
    role: req.body.role || 'MEMBER',
    status: 'SENT',
    token,
    expiresAt,
    invitedBy: new Types.ObjectId(req.user.sub)
  });

  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId: String(tenant._id),
    action: 'TENANT_INVITE_MEMBER',
    metadata: { invitationId: String(created._id), email, role }
  });

  return ok(
    res,
    {
      id: String(created._id),
      email: created.email,
      role: created.role,
      status: normalizeInvitationStatus(created.status, created.expiresAt),
      token: created.token,
      inviteUrl: `/c/${tenant.slug}/join?invite=${created.token}`,
      expiresAt: created.expiresAt
    },
    201
  );
}

export async function joinTenant(req: any, res: any) {
  const tenant = await TenantModel.findById(req.params.tenantId).lean();
  if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');

  const settings = await TenantSettingsModel.findOne({ tenantId: tenant._id }).lean();
  const role = 'MEMBER';
  const status = settings?.approvalRequired ? 'PENDING' : 'ACTIVE';
  const userId = new Types.ObjectId(req.user.sub);
  const existing = await MembershipModel.findOne({ tenantId: tenant._id, userId }).lean();
  if (existing) return ok(res, mapMembership(existing));

  const created = await MembershipModel.create({
    tenantId: tenant._id,
    userId,
    role,
    status
  });

  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId: String(tenant._id),
    action: 'TENANT_JOIN',
    metadata: { joinMethod: 'DIRECT', approvalRequired: settings?.approvalRequired ?? false }
  });

  return ok(res, mapMembership(created), 201);
}

export async function getTenantJoinInfo(req: any, res: any) {
  const slug = String(req.params.slug || '').toLowerCase();
  const inviteToken = String(req.query.invite || '').trim();
  const tenant = await TenantModel.findOne({ slug }).lean();
  if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');

  const [settings, fields, invitation] = await Promise.all([
    TenantSettingsModel.findOne({ tenantId: tenant._id }).lean(),
    RegistrationFieldModel.find({ tenantId: tenant._id, isActive: true }).sort({ fieldOrder: 1 }).lean(),
    inviteToken ? InvitationModel.findOne({ tenantId: tenant._id, token: inviteToken }).lean() : Promise.resolve(null)
  ]);

  const invitationStatus = invitation
    ? normalizeInvitationStatus(invitation.status, invitation.expiresAt)
    : null;

  const allowJoin = !!inviteToken || (settings?.publicSignup ?? true);

  return ok(res, {
    tenant: {
      id: String(tenant._id),
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description,
      logoUrl: tenant.logoUrl
    },
    settings: {
      publicSignup: settings?.publicSignup ?? true,
      approvalRequired: settings?.approvalRequired ?? false,
      registrationFieldsEnabled: settings?.registrationFieldsEnabled ?? true
    },
    allowJoin,
    registrationFields: fields.map((f) => ({
      id: String(f._id),
      key: f.key,
      label: f.label,
      fieldType: f.fieldType,
      required: f.required,
      options: f.options || []
    })),
    invitation: invitation
      ? {
          token: invitation.token,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          status: invitationStatus,
          valid: invitationStatus === 'SENT'
        }
      : null
  });
}

export async function joinTenantBySlug(req: any, res: any) {
  if (!req.user?.sub) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const slug = String(req.params.slug || '').toLowerCase();
  const inviteToken = String(req.body.inviteToken || '').trim();
  const fullName = String(req.body.fullName || '').trim();
  const phone = String(req.body.phone || '').trim();
  const customFields =
    req.body.customFields && typeof req.body.customFields === 'object' ? req.body.customFields : {};

  const tenant = await TenantModel.findOne({ slug }).lean();
  if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');

  const userId = new Types.ObjectId(req.user.sub);
  const [settings, user, existingMembership] = await Promise.all([
    TenantSettingsModel.findOne({ tenantId: tenant._id }).lean(),
    UserModel.findById(userId),
    MembershipModel.findOne({ tenantId: tenant._id, userId }).lean()
  ]);
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  if (existingMembership?.status === 'BANNED') throw new AppError('You are banned from this community', 403, 'FORBIDDEN');

  let inviteRow: any = null;
  let assignedRole: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' = 'MEMBER';
  let membershipStatus: 'PENDING' | 'ACTIVE' = settings?.approvalRequired ? 'PENDING' : 'ACTIVE';
  let joinMethod: 'INVITE' | 'DIRECTORY' = 'DIRECTORY';

  if (inviteToken) {
    inviteRow = await InvitationModel.findOne({ tenantId: tenant._id, token: inviteToken });
    if (!inviteRow) throw new AppError('Invitation not found', 404, 'NOT_FOUND');

    const invitationStatus = normalizeInvitationStatus(inviteRow.status, inviteRow.expiresAt);
    if (invitationStatus !== 'SENT') {
      throw new AppError(`Invitation is ${invitationStatus.toLowerCase()}`, 400, 'INVITATION_INVALID');
    }
    if (inviteRow.email !== user.email.toLowerCase()) {
      throw new AppError('Invitation email does not match your account', 403, 'FORBIDDEN');
    }

    assignedRole = inviteRow.role;
    membershipStatus = 'ACTIVE';
    joinMethod = 'INVITE';
  } else if (!settings?.publicSignup) {
    throw new AppError('Public signup is disabled for this community. An invitation link is required to join.', 403, 'PUBLIC_JOIN_DISABLED');
  }

  // Require fullName and phone for member profile (allow empty only when joining via valid invite)
  if (!inviteRow) {
    if (!fullName.trim()) throw new AppError('Full name is required', 400, 'VALIDATION_ERROR');
    if (!phone.trim()) throw new AppError('Phone number is required', 400, 'VALIDATION_ERROR');
  }

  const membership = await MembershipModel.findOneAndUpdate(
    { tenantId: tenant._id, userId },
    {
      tenantId: tenant._id,
      userId,
      role: assignedRole,
      status: existingMembership?.status === 'ACTIVE' ? 'ACTIVE' : membershipStatus
    },
    { upsert: true, new: true }
  );

  await MemberProfileModel.findOneAndUpdate(
    { tenantId: tenant._id, userId },
    {
      tenantId: tenant._id,
      userId,
      fullName,
      phone,
      customFields
    },
    { upsert: true, new: true }
  );

  if (fullName || phone) {
    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    await user.save();
  }

  if (inviteRow) {
    inviteRow.status = 'ACCEPTED';
    inviteRow.acceptedByUserId = userId;
    inviteRow.acceptedAt = new Date();
    await inviteRow.save();
  }

  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId: String(tenant._id),
    action: 'TENANT_JOIN',
    metadata: { joinMethod, inviteUsed: !!inviteRow, approvalRequired: settings?.approvalRequired ?? false }
  });

  return ok(
    res,
    {
      membership: mapMembership(membership),
      nextRoute: getMembershipRoute(tenant.slug, membership),
      pendingApproval: membership.status === 'PENDING'
    },
    201
  );
}
