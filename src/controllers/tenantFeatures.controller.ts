import crypto from 'crypto';
import { Types } from 'mongoose';
import {
  AnnouncementModel,
  EventModel,
  EventRsvpModel,
  GroupMembershipModel,
  GroupModel,
  InvitationModel,
  NotificationModel,
  ProgramAssignmentModel,
  ProgramEnrollmentModel,
  ProgramModel,
  ProgramModuleModel,
  RegistrationFieldModel,
  TenantPostModel,
  TenantResourceModel,
  TenantSettingsModel
} from '../models/TenantFeatureModels.js';
import { MembershipModel } from '../models/Membership.js';
import { MemberProfileModel } from '../models/MemberProfile.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../utils/audit.js';
import { AppError } from '../utils/errors.js';

function tenantObjectId(tenantId: string) {
  if (!Types.ObjectId.isValid(tenantId)) {
    throw new AppError('Invalid tenantId', 400, 'VALIDATION_ERROR');
  }
  return new Types.ObjectId(tenantId);
}

function normalizeInvitationStatus(status: string, expiresAt: Date) {
  if (status === 'REVOKED') return 'REVOKED';
  if (status === 'ACCEPTED') return 'ACCEPTED';
  if (new Date(expiresAt).getTime() < Date.now()) return 'EXPIRED';
  return 'SENT';
}

async function ensureMembership(tenantId: string, userId: string) {
  const row = await MembershipModel.findOne({
    tenantId: tenantObjectId(tenantId),
    userId: tenantObjectId(userId),
    status: 'ACTIVE'
  }).lean();
  if (!row) throw new AppError('Not a tenant member', 403, 'FORBIDDEN');
}

export async function tenantDashboard(req: any, res: any) {
  const tenantId = req.params.tenantId;
  await ensureMembership(tenantId, req.user.sub);

  const [members, pendingRegistrations, announcements, posts, groups, events, programs, resources, latestPosts, upcomingEvents, recentSignups] = await Promise.all([
    MembershipModel.countDocuments({ tenantId, status: 'ACTIVE' }),
    MembershipModel.countDocuments({ tenantId, status: 'PENDING' }),
    AnnouncementModel.countDocuments({ tenantId }),
    TenantPostModel.countDocuments({ tenantId }),
    GroupModel.countDocuments({ tenantId }),
    EventModel.countDocuments({ tenantId }),
    ProgramModel.countDocuments({ tenantId }),
    TenantResourceModel.countDocuments({ tenantId }),
    TenantPostModel.find({ tenantId, isPublished: true }).sort({ publishedAt: -1 }).limit(5).lean(),
    EventModel.find({ tenantId, startsAt: { $gte: new Date() } }).sort({ startsAt: 1 }).limit(5).lean(),
    MembershipModel.find({ tenantId }).sort({ createdAt: -1 }).limit(5).populate('userId', 'email fullName').lean()
  ]);

  return ok(res, {
    members,
    pendingRegistrations,
    announcements,
    posts,
    groups,
    events,
    programs,
    resources,
    latestPosts,
    upcomingEvents,
    recentSignups: recentSignups.map((m: any) => ({
      id: String(m._id),
      status: m.status,
      role: m.role,
      joinedAt: m.createdAt,
      user: m.userId
        ? {
            id: String(m.userId._id),
            email: m.userId.email || '',
            fullName: m.userId.fullName || ''
          }
        : null
    }))
  });
}

export async function listAnnouncements(req: any, res: any) {
  const tenantId = req.params.tenantId;
  await ensureMembership(tenantId, req.user.sub);
  const rows = await AnnouncementModel.find({ tenantId }).sort({ createdAt: -1 }).lean();
  return ok(res, rows);
}

export async function createAnnouncement(req: any, res: any) {
  const tenantId = req.params.tenantId;
  const created = await AnnouncementModel.create({
    tenantId,
    title: req.body.title,
    content: req.body.content,
    isPinned: !!req.body.isPinned,
    visibility: req.body.visibility || 'MEMBERS',
    authorUserId: tenantObjectId(req.user.sub)
  });
  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId,
    action: 'ANNOUNCEMENT_CREATE',
    metadata: { announcementId: String(created._id) }
  });
  return ok(res, created, 201);
}

export async function deleteAnnouncement(req: any, res: any) {
  await AnnouncementModel.deleteOne({ _id: req.params.id, tenantId: req.params.tenantId });
  return res.status(204).send();
}

export async function listPosts(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const rows = await TenantPostModel.find({ tenantId: req.params.tenantId, isPublished: true })
    .sort({ publishedAt: -1 })
    .lean();
  return ok(res, rows);
}

export async function createPost(req: any, res: any) {
  const created = await TenantPostModel.create({
    tenantId: req.params.tenantId,
    title: req.body.title,
    content: req.body.content,
    visibility: req.body.visibility || 'MEMBERS',
    isPublished: req.body.isPublished ?? true,
    publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : new Date(),
    authorUserId: tenantObjectId(req.user.sub)
  });
  return ok(res, created, 201);
}

export async function deletePost(req: any, res: any) {
  await TenantPostModel.deleteOne({ _id: req.params.id, tenantId: req.params.tenantId });
  return res.status(204).send();
}

export async function listResources(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const rows = await TenantResourceModel.find({ tenantId: req.params.tenantId }).sort({ createdAt: -1 }).lean();
  return ok(res, rows);
}

export async function createResource(req: any, res: any) {
  const created = await TenantResourceModel.create({
    tenantId: req.params.tenantId,
    title: req.body.title,
    description: req.body.description || '',
    url: req.body.url || '',
    type: req.body.type || 'link',
    folder: req.body.folder || '',
    groupId: req.body.groupId || null,
    createdBy: tenantObjectId(req.user.sub)
  });
  return ok(res, created, 201);
}

export async function deleteResource(req: any, res: any) {
  await TenantResourceModel.deleteOne({ _id: req.params.id, tenantId: req.params.tenantId });
  return res.status(204).send();
}

export async function listGroups(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const rows = await GroupModel.find({ tenantId: req.params.tenantId }).sort({ createdAt: -1 }).lean();
  return ok(res, rows);
}

export async function createGroup(req: any, res: any) {
  const created = await GroupModel.create({
    tenantId: req.params.tenantId,
    name: req.body.name,
    description: req.body.description || '',
    isPrivate: !!req.body.isPrivate,
    createdBy: tenantObjectId(req.user.sub)
  });
  return ok(res, created, 201);
}

export async function joinGroup(req: any, res: any) {
  const created = await GroupMembershipModel.findOneAndUpdate(
    { groupId: req.params.groupId, userId: tenantObjectId(req.user.sub) },
    {
      tenantId: req.params.tenantId,
      groupId: req.params.groupId,
      userId: tenantObjectId(req.user.sub),
      role: 'MEMBER'
    },
    { upsert: true, new: true }
  ).lean();
  return ok(res, created);
}

export async function leaveGroup(req: any, res: any) {
  await GroupMembershipModel.deleteOne({ groupId: req.params.groupId, userId: tenantObjectId(req.user.sub) });
  return res.status(204).send();
}

export async function listEvents(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const rows = await EventModel.find({ tenantId: req.params.tenantId }).sort({ startsAt: 1 }).lean();
  return ok(res, rows);
}

export async function createEvent(req: any, res: any) {
  const created = await EventModel.create({
    tenantId: req.params.tenantId,
    title: req.body.title,
    description: req.body.description || '',
    startsAt: new Date(req.body.startsAt),
    endsAt: req.body.endsAt ? new Date(req.body.endsAt) : null,
    location: req.body.location || '',
    isOnline: !!req.body.isOnline,
    meetingLink: req.body.meetingLink || '',
    hostUserId: tenantObjectId(req.user.sub)
  });
  return ok(res, created, 201);
}

export async function deleteEvent(req: any, res: any) {
  await EventModel.deleteOne({ _id: req.params.id, tenantId: req.params.tenantId });
  return res.status(204).send();
}

export async function rsvpEvent(req: any, res: any) {
  const row = await EventRsvpModel.findOneAndUpdate(
    { eventId: req.params.eventId, userId: tenantObjectId(req.user.sub) },
    {
      tenantId: req.params.tenantId,
      eventId: req.params.eventId,
      userId: tenantObjectId(req.user.sub),
      status: req.body.status || 'GOING'
    },
    { upsert: true, new: true }
  ).lean();
  return ok(res, row);
}

export async function listPrograms(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const [programs, modules, assignments] = await Promise.all([
    ProgramModel.find({ tenantId: req.params.tenantId }).sort({ createdAt: -1 }).lean(),
    ProgramModuleModel.find({ tenantId: req.params.tenantId }).sort({ order: 1 }).lean(),
    ProgramAssignmentModel.find({ tenantId: req.params.tenantId }).lean()
  ]);
  return ok(res, { programs, modules, assignments });
}

export async function createProgram(req: any, res: any) {
  const created = await ProgramModel.create({
    tenantId: req.params.tenantId,
    title: req.body.title,
    description: req.body.description || '',
    createdBy: tenantObjectId(req.user.sub)
  });
  return ok(res, created, 201);
}

export async function createProgramModule(req: any, res: any) {
  const created = await ProgramModuleModel.create({
    tenantId: req.params.tenantId,
    programId: req.body.programId,
    title: req.body.title,
    description: req.body.description || '',
    order: req.body.order || 0
  });
  return ok(res, created, 201);
}

export async function assignProgram(req: any, res: any) {
  const created = await ProgramAssignmentModel.create({
    tenantId: req.params.tenantId,
    programId: req.body.programId,
    groupId: req.body.groupId
  });
  return ok(res, created, 201);
}

export async function enrollProgram(req: any, res: any) {
  const row = await ProgramEnrollmentModel.findOneAndUpdate(
    { tenantId: req.params.tenantId, programId: req.params.programId, userId: tenantObjectId(req.user.sub) },
    { progressPct: req.body.progressPct || 0 },
    { upsert: true, new: true }
  ).lean();
  return ok(res, row);
}

export async function listMembers(req: any, res: any) {
  const rows = await MembershipModel.find({ tenantId: req.params.tenantId })
    .populate('userId', 'email fullName phone')
    .sort({ createdAt: -1 })
    .lean();
  const profiles = await MemberProfileModel.find({ tenantId: req.params.tenantId }).lean();
  const profileByUserId = new Map(profiles.map((p) => [String(p.userId), p]));

  return ok(
    res,
    rows.map((row: any) => {
      const profile = profileByUserId.get(String(row.userId?._id || ''));
      return {
        _id: String(row._id),
        tenantId: String(row.tenantId),
        role: row.role,
        status: row.status,
        joinedAt: row.createdAt,
        userId: row.userId
          ? {
              _id: String(row.userId._id),
              email: row.userId.email || '',
              fullName: row.userId.fullName || '',
              phone: row.userId.phone || ''
            }
          : null,
        profile: profile
          ? {
              fullName: profile.fullName || '',
              phone: profile.phone || '',
              customFields: profile.customFields || {},
              updatedAt: profile.updatedAt
            }
          : null
      };
    })
  );
}

export async function updateMemberRole(req: any, res: any) {
  const row = await MembershipModel.findOneAndUpdate(
    { tenantId: req.params.tenantId, userId: req.params.userId },
    { role: req.body.role, status: req.body.status || 'ACTIVE' },
    { new: true }
  ).lean();
  if (!row) throw new AppError('Membership not found', 404, 'NOT_FOUND');
  return ok(res, row);
}

export async function listInvitations(req: any, res: any) {
  const rows = await InvitationModel.find({ tenantId: req.params.tenantId }).sort({ createdAt: -1 }).lean();
  return ok(
    res,
    rows.map((row) => ({
      ...row,
      status: normalizeInvitationStatus(row.status, row.expiresAt)
    }))
  );
}

export async function createInvitation(req: any, res: any) {
  const token = crypto.randomUUID();
  const email = String(req.body.email).toLowerCase().trim();
  const existing = await InvitationModel.findOne({
    tenantId: req.params.tenantId,
    email,
    status: { $in: ['SENT', 'PENDING'] },
    expiresAt: { $gte: new Date() }
  }).lean();
  if (existing) throw new AppError('An active invitation already exists for this email', 409, 'INVITATION_EXISTS');

  const ttlDays = Number(req.body.expiresInDays || 7);
  const expiresAt = new Date(Date.now() + Math.max(1, Math.min(30, ttlDays)) * 24 * 60 * 60 * 1000);
  const row = await InvitationModel.create({
    tenantId: req.params.tenantId,
    email,
    phone: String(req.body.phone || '').trim(),
    role: req.body.role || 'MEMBER',
    status: 'SENT',
    token,
    invitedBy: tenantObjectId(req.user.sub),
    expiresAt
  });

  return ok(
    res,
    {
      ...row.toObject(),
      status: normalizeInvitationStatus(row.status, row.expiresAt)
    },
    201
  );
}

export async function resendInvitation(req: any, res: any) {
  const existing = await InvitationModel.findOne({
    _id: req.params.id,
    tenantId: req.params.tenantId
  });
  if (!existing) throw new AppError('Invitation not found', 404, 'NOT_FOUND');
  if (existing.status === 'ACCEPTED') throw new AppError('Cannot resend an accepted invitation', 400, 'INVALID_STATE');

  existing.token = crypto.randomUUID();
  existing.status = 'SENT';
  existing.revokedAt = null;
  existing.revokedByUserId = null;
  existing.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await existing.save();

  return ok(res, {
    ...existing.toObject(),
    status: normalizeInvitationStatus(existing.status, existing.expiresAt)
  });
}

export async function revokeInvitation(req: any, res: any) {
  const existing = await InvitationModel.findOne({
    _id: req.params.id,
    tenantId: req.params.tenantId
  });
  if (!existing) throw new AppError('Invitation not found', 404, 'NOT_FOUND');
  if (existing.status === 'ACCEPTED') throw new AppError('Accepted invitation cannot be revoked', 400, 'INVALID_STATE');

  existing.status = 'REVOKED';
  existing.revokedByUserId = tenantObjectId(req.user.sub) as any;
  existing.revokedAt = new Date();
  await existing.save();

  return ok(res, {
    ...existing.toObject(),
    status: normalizeInvitationStatus(existing.status, existing.expiresAt)
  });
}

export async function listNotifications(req: any, res: any) {
  const rows = await NotificationModel.find({
    tenantId: req.params.tenantId,
    userId: tenantObjectId(req.user.sub)
  })
    .sort({ createdAt: -1 })
    .lean();
  return ok(res, rows);
}

export async function getMyMemberProfile(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const userId = tenantObjectId(req.user.sub);
  const [profile, membership] = await Promise.all([
    MemberProfileModel.findOne({ tenantId: req.params.tenantId, userId }).lean(),
    MembershipModel.findOne({ tenantId: req.params.tenantId, userId }).lean()
  ]);
  return ok(res, {
    membershipStatus: membership?.status || 'PENDING',
    profile: profile
      ? {
          fullName: profile.fullName || '',
          phone: profile.phone || '',
          customFields: profile.customFields || {},
          updatedAt: profile.updatedAt
        }
      : {
          fullName: '',
          phone: '',
          customFields: {}
        }
  });
}

export async function updateMyMemberProfile(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const userId = tenantObjectId(req.user.sub);
  const fullName = String(req.body.fullName || '').trim();
  const phone = String(req.body.phone || '').trim();
  const customFields =
    req.body.customFields && typeof req.body.customFields === 'object' ? req.body.customFields : {};

  const profile = await MemberProfileModel.findOneAndUpdate(
    { tenantId: req.params.tenantId, userId },
    {
      tenantId: req.params.tenantId,
      userId,
      fullName,
      phone,
      customFields
    },
    { upsert: true, new: true }
  ).lean();

  return ok(res, profile);
}

export async function markNotificationRead(req: any, res: any) {
  const row = await NotificationModel.findOneAndUpdate(
    { _id: req.params.id, userId: tenantObjectId(req.user.sub) },
    { readAt: new Date() },
    { new: true }
  ).lean();
  if (!row) throw new AppError('Notification not found', 404, 'NOT_FOUND');
  return ok(res, row);
}

export async function listRegistrationFields(req: any, res: any) {
  const rows = await RegistrationFieldModel.find({ tenantId: req.params.tenantId }).sort({ fieldOrder: 1 }).lean();
  return ok(res, rows);
}

export async function createRegistrationField(req: any, res: any) {
  const row = await RegistrationFieldModel.create({
    tenantId: req.params.tenantId,
    key: req.body.key,
    label: req.body.label,
    fieldType: req.body.fieldType || 'TEXT',
    required: !!req.body.required,
    options: req.body.options || [],
    fieldOrder: req.body.fieldOrder || 0,
    isActive: req.body.isActive ?? true
  });
  return ok(res, row, 201);
}

export async function updateRegistrationField(req: any, res: any) {
  const row = await RegistrationFieldModel.findOneAndUpdate(
    { tenantId: req.params.tenantId, _id: req.params.id },
    req.body,
    { new: true }
  ).lean();
  if (!row) throw new AppError('Field not found', 404, 'NOT_FOUND');
  return ok(res, row);
}

export async function getTenantSettings(req: any, res: any) {
  const row =
    (await TenantSettingsModel.findOne({ tenantId: req.params.tenantId }).lean()) ||
    (await TenantSettingsModel.create({ tenantId: req.params.tenantId }));
  return ok(res, row);
}

export async function updateTenantSettings(req: any, res: any) {
  const row = await TenantSettingsModel.findOneAndUpdate(
    { tenantId: req.params.tenantId },
    {
      publicSignup: req.body.publicSignup,
      approvalRequired: req.body.approvalRequired,
      registrationFieldsEnabled: req.body.registrationFieldsEnabled
    },
    { new: true, upsert: true }
  ).lean();
  return ok(res, row);
}
