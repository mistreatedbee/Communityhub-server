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
  TenantHomepageSettingsModel,
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

export function defaultHomepageSections() {
  return {
    sectionOrder: ['hero', 'vision', 'announcements', 'events', 'programs', 'groups', 'gallery'] as string[],
    hero: {
      enabled: true,
      headline: 'Welcome to our community',
      subheadline: 'Connect, learn, and grow together.',
      ctaLabel: 'Explore events',
      ctaLink: 'events',
      heroImageUrl: '',
      heroLogoUrl: '',
      overlayColor: 'rgba(15,23,42,0.45)'
    },
    vision: {
      enabled: true,
      title: 'Vision, Strategy, and Objectives',
      content: '- Build meaningful connections\n- Share knowledge\n- Grow community impact'
    },
    gallery: {
      enabled: false,
      images: [] as Array<{ url: string; caption?: string; order: number }>
    },
    events: {
      enabled: true,
      title: 'Upcoming Events',
      showCount: 3
    },
    programs: {
      enabled: true,
      title: 'Featured Programs',
      showCount: 3
    },
    groups: {
      enabled: true,
      title: 'Groups',
      showCount: 3,
      featuredGroupIds: [] as string[]
    },
    calendar: {
      enabled: false,
      title: 'Calendar'
    },
    announcements: {
      enabled: true,
      title: 'Pinned Updates'
    }
  };
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
  const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];
  const created = await AnnouncementModel.create({
    tenantId,
    title: req.body.title,
    content: req.body.content,
    isPinned: !!req.body.isPinned,
    visibility: req.body.visibility || 'MEMBERS',
    authorUserId: tenantObjectId(req.user.sub),
    attachments: attachments.map((a: any) => ({
      fileId: a.fileId,
      fileName: a.fileName || '',
      mimeType: a.mimeType || '',
      size: a.size || 0
    }))
  });
  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId,
    action: 'ANNOUNCEMENT_CREATE',
    metadata: { announcementId: String(created._id) }
  });
  return ok(res, created, 201);
}

export async function updateAnnouncement(req: any, res: any) {
  const tenantId = req.params.tenantId;
  const update: any = {};
  if (req.body.title !== undefined) update.title = req.body.title;
  if (req.body.content !== undefined) update.content = req.body.content;
  if (req.body.visibility !== undefined) update.visibility = req.body.visibility;
  if (req.body.isPinned !== undefined) update.isPinned = !!req.body.isPinned;
  if (Array.isArray(req.body.attachments)) {
    update.attachments = req.body.attachments.map((a: any) => ({
      fileId: a.fileId,
      fileName: a.fileName || '',
      mimeType: a.mimeType || '',
      size: a.size || 0
    }));
  }
  const updated = await AnnouncementModel.findOneAndUpdate(
    { _id: req.params.id, tenantId },
    update,
    { new: true }
  ).lean();
  if (!updated) throw new AppError('Announcement not found', 404, 'NOT_FOUND');
  return ok(res, updated);
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

export async function getResource(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const resource = await TenantResourceModel.findOne({
    _id: req.params.resourceId,
    tenantId: req.params.tenantId
  }).lean();
  if (!resource) throw new AppError('Resource not found', 404, 'NOT_FOUND');
  return ok(res, resource);
}

export async function createResource(req: any, res: any) {
  const type = req.body.fileId ? 'file' : (req.body.type || 'link');
  const created = await TenantResourceModel.create({
    tenantId: req.params.tenantId,
    title: req.body.title,
    description: req.body.description || '',
    url: req.body.url || '',
    thumbnailUrl: req.body.thumbnailUrl || '',
    thumbnailFileId: req.body.thumbnailFileId || null,
    type,
    fileId: req.body.fileId || null,
    fileName: req.body.fileName || '',
    mimeType: req.body.mimeType || '',
    size: req.body.size ?? 0,
    folder: req.body.folder || '',
    groupId: req.body.groupId || null,
    moduleId: req.body.moduleId || null,
    programId: req.body.programId || null,
    createdBy: tenantObjectId(req.user.sub)
  });
  return ok(res, created, 201);
}

export async function updateResource(req: any, res: any) {
  const update: any = {};
  if (req.body.title !== undefined) update.title = req.body.title;
  if (req.body.description !== undefined) update.description = req.body.description;
  if (req.body.url !== undefined) update.url = req.body.url;
  if (req.body.thumbnailUrl !== undefined) update.thumbnailUrl = req.body.thumbnailUrl;
  if (req.body.thumbnailFileId !== undefined) update.thumbnailFileId = req.body.thumbnailFileId || null;
  if (req.body.type !== undefined) update.type = req.body.type;
  if (req.body.fileId !== undefined) update.fileId = req.body.fileId || null;
  if (req.body.fileName !== undefined) update.fileName = req.body.fileName;
  if (req.body.mimeType !== undefined) update.mimeType = req.body.mimeType;
  if (req.body.size !== undefined) update.size = req.body.size;
  if (req.body.moduleId !== undefined) update.moduleId = req.body.moduleId || null;
  if (req.body.programId !== undefined) update.programId = req.body.programId || null;
  const updated = await TenantResourceModel.findOneAndUpdate(
    { _id: req.params.resourceId, tenantId: req.params.tenantId },
    update,
    { new: true }
  ).lean();
  if (!updated) throw new AppError('Resource not found', 404, 'NOT_FOUND');
  return ok(res, updated);
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

export async function getGroup(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const group = await GroupModel.findOne({
    _id: req.params.groupId,
    tenantId: req.params.tenantId
  }).lean();
  if (!group) throw new AppError('Group not found', 404, 'NOT_FOUND');
  const assignments = await ProgramAssignmentModel.find({
    tenantId: req.params.tenantId,
    groupId: req.params.groupId
  }).lean();
  const programIds = assignments.map((a: any) => a.programId);
  const programs =
    programIds.length > 0
      ? await ProgramModel.find({
          tenantId: req.params.tenantId,
          _id: { $in: programIds }
        }).lean()
      : [];
  return ok(res, { group, assignments, programs });
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

export async function updateGroup(req: any, res: any) {
  const updated = await GroupModel.findOneAndUpdate(
    { _id: req.params.groupId, tenantId: req.params.tenantId },
    {
      ...(req.body.name !== undefined && { name: req.body.name }),
      ...(req.body.description !== undefined && { description: req.body.description }),
      ...(req.body.isPrivate !== undefined && { isPrivate: !!req.body.isPrivate })
    },
    { new: true }
  ).lean();
  if (!updated) throw new AppError('Group not found', 404, 'NOT_FOUND');
  return ok(res, updated);
}

export async function listGroupPrograms(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const assignments = await ProgramAssignmentModel.find({
    tenantId: req.params.tenantId,
    groupId: req.params.groupId
  }).lean();
  const programIds = assignments.map((a: any) => a.programId);
  const programs =
    programIds.length > 0
      ? await ProgramModel.find({
          tenantId: req.params.tenantId,
          _id: { $in: programIds }
        }).lean()
      : [];
  return ok(res, programs);
}

export async function listGroupMembers(req: any, res: any) {
  const group = await GroupModel.findOne({
    _id: req.params.groupId,
    tenantId: req.params.tenantId
  }).lean();
  if (!group) throw new AppError('Group not found', 404, 'NOT_FOUND');
  const rows = await GroupMembershipModel.find({
    groupId: req.params.groupId,
    tenantId: req.params.tenantId
  })
    .populate('userId', 'email fullName')
    .sort({ createdAt: 1 })
    .lean();
  return ok(res, rows);
}

export async function removeGroupMember(req: any, res: any) {
  const group = await GroupModel.findOne({
    _id: req.params.groupId,
    tenantId: req.params.tenantId
  }).lean();
  if (!group) throw new AppError('Group not found', 404, 'NOT_FOUND');
  const result = await GroupMembershipModel.deleteOne({
    groupId: req.params.groupId,
    userId: tenantObjectId(req.params.userId),
    tenantId: req.params.tenantId
  });
  if (result.deletedCount === 0) throw new AppError('Group membership not found', 404, 'NOT_FOUND');
  return res.status(204).send();
}

export async function listGroupResources(req: any, res: any) {
  const group = await GroupModel.findOne({
    _id: req.params.groupId,
    tenantId: req.params.tenantId
  }).lean();
  if (!group) throw new AppError('Group not found', 404, 'NOT_FOUND');
  const rows = await TenantResourceModel.find({
    tenantId: req.params.tenantId,
    groupId: req.params.groupId
  })
    .sort({ createdAt: -1 })
    .lean();
  return ok(res, rows);
}

export async function joinGroup(req: any, res: any) {
  const group = await GroupModel.findOne({
    _id: req.params.groupId,
    tenantId: req.params.tenantId
  }).lean();
  if (!group) throw new AppError('Group not found', 404, 'NOT_FOUND');
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
  const group = await GroupModel.findOne({
    _id: req.params.groupId,
    tenantId: req.params.tenantId
  }).lean();
  if (!group) throw new AppError('Group not found', 404, 'NOT_FOUND');
  await GroupMembershipModel.deleteOne({
    groupId: req.params.groupId,
    userId: tenantObjectId(req.user.sub),
    tenantId: req.params.tenantId
  });
  return res.status(204).send();
}

export async function listEvents(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const rows = await EventModel.find({ tenantId: req.params.tenantId }).sort({ startsAt: 1 }).lean();
  return ok(res, rows);
}

export async function getEvent(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const event = await EventModel.findOne({
    _id: req.params.eventId,
    tenantId: req.params.tenantId
  }).lean();
  if (!event) throw new AppError('Event not found', 404, 'NOT_FOUND');
  return ok(res, event);
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
    thumbnailUrl: req.body.thumbnailUrl || '',
    thumbnailFileId: req.body.thumbnailFileId || null,
    thumbnailFileName: req.body.thumbnailFileName || '',
    hostUserId: tenantObjectId(req.user.sub)
  });
  return ok(res, created, 201);
}

export async function updateEvent(req: any, res: any) {
  const update: any = {};
  if (req.body.title !== undefined) update.title = req.body.title;
  if (req.body.description !== undefined) update.description = req.body.description;
  if (req.body.startsAt !== undefined) update.startsAt = new Date(req.body.startsAt);
  if (req.body.endsAt !== undefined) update.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
  if (req.body.location !== undefined) update.location = req.body.location;
  if (req.body.isOnline !== undefined) update.isOnline = !!req.body.isOnline;
  if (req.body.meetingLink !== undefined) update.meetingLink = req.body.meetingLink;
  if (req.body.thumbnailUrl !== undefined) update.thumbnailUrl = req.body.thumbnailUrl;
  if (req.body.thumbnailFileId !== undefined) update.thumbnailFileId = req.body.thumbnailFileId || null;
  if (req.body.thumbnailFileName !== undefined) update.thumbnailFileName = req.body.thumbnailFileName;
  const updated = await EventModel.findOneAndUpdate(
    { _id: req.params.eventId, tenantId: req.params.tenantId },
    update,
    { new: true }
  ).lean();
  if (!updated) throw new AppError('Event not found', 404, 'NOT_FOUND');
  return ok(res, updated);
}

export async function deleteEvent(req: any, res: any) {
  await EventModel.deleteOne({ _id: req.params.id, tenantId: req.params.tenantId });
  return res.status(204).send();
}

export async function rsvpEvent(req: any, res: any) {
  const row = await EventRsvpModel.findOneAndUpdate(
    {
      tenantId: req.params.tenantId,
      eventId: req.params.eventId,
      userId: tenantObjectId(req.user.sub)
    },
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

export async function getProgram(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const program = await ProgramModel.findOne({
    _id: req.params.programId,
    tenantId: req.params.tenantId
  }).lean();
  if (!program) throw new AppError('Program not found', 404, 'NOT_FOUND');
  const [modules, assignments] = await Promise.all([
    ProgramModuleModel.find({ tenantId: req.params.tenantId, programId: req.params.programId }).sort({ order: 1 }).lean(),
    ProgramAssignmentModel.find({ tenantId: req.params.tenantId, programId: req.params.programId }).lean()
  ]);
  return ok(res, { program, modules, assignments });
}

export async function createProgram(req: any, res: any) {
  const created = await ProgramModel.create({
    tenantId: req.params.tenantId,
    title: req.body.title,
    description: req.body.description || '',
    status: req.body.status || 'ACTIVE',
    createdBy: tenantObjectId(req.user.sub)
  });
  return ok(res, created, 201);
}

export async function updateProgram(req: any, res: any) {
  const updated = await ProgramModel.findOneAndUpdate(
    { _id: req.params.programId, tenantId: req.params.tenantId },
    {
      ...(req.body.title !== undefined && { title: req.body.title }),
      ...(req.body.description !== undefined && { description: req.body.description }),
      ...(req.body.status !== undefined && { status: req.body.status })
    },
    { new: true }
  ).lean();
  if (!updated) throw new AppError('Program not found', 404, 'NOT_FOUND');
  return ok(res, updated);
}

export async function getModule(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const module_ = await ProgramModuleModel.findOne({
    _id: req.params.moduleId,
    programId: req.params.programId,
    tenantId: req.params.tenantId
  }).lean();
  if (!module_) throw new AppError('Module not found', 404, 'NOT_FOUND');
  const resources = await TenantResourceModel.find({
    tenantId: req.params.tenantId,
    moduleId: req.params.moduleId
  }).lean();
  return ok(res, { module: module_, resources });
}

export async function createProgramModule(req: any, res: any) {
  const programId = req.body.programId;
  if (!programId) throw new AppError('programId is required', 400, 'VALIDATION_ERROR');
  const program = await ProgramModel.findOne({
    _id: programId,
    tenantId: req.params.tenantId
  }).lean();
  if (!program) throw new AppError('Program not found', 404, 'NOT_FOUND');

  const created = await ProgramModuleModel.create({
    tenantId: req.params.tenantId,
    programId,
    title: req.body.title,
    description: req.body.description || '',
    order: req.body.order || 0
  });
  return ok(res, created, 201);
}

export async function updateModule(req: any, res: any) {
  const updated = await ProgramModuleModel.findOneAndUpdate(
    {
      _id: req.params.moduleId,
      programId: req.params.programId,
      tenantId: req.params.tenantId
    },
    {
      ...(req.body.title !== undefined && { title: req.body.title }),
      ...(req.body.description !== undefined && { description: req.body.description }),
      ...(req.body.order !== undefined && { order: req.body.order })
    },
    { new: true }
  ).lean();
  if (!updated) throw new AppError('Module not found', 404, 'NOT_FOUND');
  return ok(res, updated);
}

export async function deleteModule(req: any, res: any) {
  const result = await ProgramModuleModel.deleteOne({
    _id: req.params.moduleId,
    programId: req.params.programId,
    tenantId: req.params.tenantId
  });
  if (result.deletedCount === 0) throw new AppError('Module not found', 404, 'NOT_FOUND');
  await TenantResourceModel.updateMany(
    { tenantId: req.params.tenantId, moduleId: req.params.moduleId },
    { $unset: { moduleId: 1, programId: 1 } }
  );
  return res.status(204).send();
}

export async function addResourceToModule(req: any, res: any) {
  const resourceId = req.body.resourceId;
  if (!resourceId) throw new AppError('resourceId is required', 400, 'VALIDATION_ERROR');
  const resource = await TenantResourceModel.findOne({
    _id: resourceId,
    tenantId: req.params.tenantId
  });
  if (!resource) throw new AppError('Resource not found', 404, 'NOT_FOUND');
  const module_ = await ProgramModuleModel.findOne({
    _id: req.params.moduleId,
    programId: req.params.programId,
    tenantId: req.params.tenantId
  });
  if (!module_) throw new AppError('Module not found', 404, 'NOT_FOUND');
  resource.moduleId = module_._id as any;
  resource.programId = req.params.programId;
  await resource.save();
  return ok(res, resource.toObject ? resource.toObject() : resource, 200);
}

export async function removeResourceFromModule(req: any, res: any) {
  const updated = await TenantResourceModel.findOneAndUpdate(
    {
      _id: req.params.resourceId,
      tenantId: req.params.tenantId,
      moduleId: req.params.moduleId
    },
    { $unset: { moduleId: 1, programId: 1 } },
    { new: true }
  ).lean();
  if (!updated) throw new AppError('Resource not found or not in this module', 404, 'NOT_FOUND');
  return ok(res, updated, 200);
}

export async function assignProgram(req: any, res: any) {
  const programId = req.body.programId;
  const groupId = req.body.groupId;
  if (!programId || !groupId) {
    throw new AppError('programId and groupId are required', 400, 'VALIDATION_ERROR');
  }
  const tenantId = req.params.tenantId;
  const [program, group] = await Promise.all([
    ProgramModel.findOne({ _id: programId, tenantId }).lean(),
    GroupModel.findOne({ _id: groupId, tenantId }).lean()
  ]);
  if (!program) throw new AppError('Program not found', 404, 'NOT_FOUND');
  if (!group) throw new AppError('Group not found', 404, 'NOT_FOUND');

  const row = await ProgramAssignmentModel.findOneAndUpdate(
    { tenantId, programId, groupId },
    { tenantId, programId, groupId },
    { upsert: true, new: true }
  ).lean();
  return ok(res, row, 201);
}

export async function unassignProgram(req: any, res: any) {
  const programId = req.body?.programId || req.query?.programId;
  const groupId = req.body?.groupId || req.query?.groupId;
  if (!programId || !groupId) throw new AppError('programId and groupId are required', 400, 'VALIDATION_ERROR');
  const result = await ProgramAssignmentModel.deleteOne({
    tenantId: req.params.tenantId,
    programId,
    groupId
  });
  if (result.deletedCount === 0) throw new AppError('Assignment not found', 404, 'NOT_FOUND');
  return res.status(204).send();
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
  if (!['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'].includes(req.body.role)) {
    throw new AppError('Invalid role', 422, 'VALIDATION_ERROR');
  }
  if (!['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED'].includes(req.body.status || 'ACTIVE')) {
    throw new AppError('Invalid status', 422, 'VALIDATION_ERROR');
  }

  const row = await MembershipModel.findOneAndUpdate(
    { tenantId: req.params.tenantId, userId: req.params.userId },
    { role: req.body.role, status: req.body.status || 'ACTIVE' },
    { new: true }
  ).lean();
  if (!row) throw new AppError('Membership not found', 404, 'NOT_FOUND');

  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId: req.params.tenantId,
    action: 'TENANT_MEMBER_ROLE_STATUS_UPDATED',
    metadata: {
      userId: req.params.userId,
      role: row.role,
      status: row.status
    }
  });

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
    {
      _id: req.params.id,
      tenantId: req.params.tenantId,
      userId: tenantObjectId(req.user.sub)
    },
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
  const update: Record<string, unknown> = {};
  if (req.body.key !== undefined) update.key = req.body.key;
  if (req.body.label !== undefined) update.label = req.body.label;
  if (req.body.fieldType !== undefined) update.fieldType = req.body.fieldType;
  if (req.body.required !== undefined) update.required = !!req.body.required;
  if (req.body.options !== undefined)
    update.options = Array.isArray(req.body.options) ? req.body.options : [];
  if (req.body.fieldOrder !== undefined) update.fieldOrder = Number(req.body.fieldOrder) ?? 0;
  if (req.body.isActive !== undefined) update.isActive = !!req.body.isActive;

  const row = await RegistrationFieldModel.findOneAndUpdate(
    { tenantId: req.params.tenantId, _id: req.params.id },
    update,
    { new: true }
  ).lean();
  if (!row) throw new AppError('Field not found', 404, 'NOT_FOUND');
  return ok(res, row);
}

const DEFAULT_ENABLED_SECTIONS = ['announcements', 'resources', 'groups', 'events', 'programs'];

export async function getTenantSettings(req: any, res: any) {
  const row =
    (await TenantSettingsModel.findOne({ tenantId: req.params.tenantId }).lean()) ||
    (await TenantSettingsModel.create({ tenantId: req.params.tenantId }));
  const settings = row as any;
  return ok(res, {
    ...settings,
    enabledSections:
      Array.isArray(settings?.enabledSections) && settings.enabledSections.length > 0
        ? settings.enabledSections
        : DEFAULT_ENABLED_SECTIONS
  });
}

export async function updateTenantSettings(req: any, res: any) {
  const update: Record<string, unknown> = {
    publicSignup: req.body.publicSignup,
    approvalRequired: req.body.approvalRequired,
    registrationFieldsEnabled: req.body.registrationFieldsEnabled
  };
  if (Array.isArray(req.body.enabledSections)) {
    update.enabledSections = req.body.enabledSections;
  }
  const row = await TenantSettingsModel.findOneAndUpdate(
    { tenantId: req.params.tenantId },
    update,
    { new: true, upsert: true }
  ).lean();
  return ok(res, row);
}

export async function getTenantHomepageSettings(req: any, res: any) {
  await ensureMembership(req.params.tenantId, req.user.sub);
  const row =
    (await TenantHomepageSettingsModel.findOne({ tenantId: req.params.tenantId }).lean()) ||
    (await TenantHomepageSettingsModel.create({
      tenantId: req.params.tenantId,
      theme: { primaryColor: '', secondaryColor: '', logoUrl: '' },
      sections: defaultHomepageSections(),
      publishedAt: new Date()
    }));

  return ok(res, {
    ...row,
    sections: row.sections || defaultHomepageSections()
  });
}

export async function updateTenantHomepageSettings(req: any, res: any) {
  const sections = req.body?.sections && typeof req.body.sections === 'object' ? req.body.sections : defaultHomepageSections();
  const theme = req.body?.theme && typeof req.body.theme === 'object' ? req.body.theme : {};

  const row = await TenantHomepageSettingsModel.findOneAndUpdate(
    { tenantId: req.params.tenantId },
    {
      theme: {
        primaryColor: String(theme.primaryColor || ''),
        secondaryColor: String(theme.secondaryColor || ''),
        logoUrl: String(theme.logoUrl || '')
      },
      sections,
      publishedAt: new Date()
    },
    { new: true, upsert: true }
  ).lean();

  await writeAuditLog({
    actorUserId: req.user.sub,
    tenantId: req.params.tenantId,
    action: 'TENANT_HOMEPAGE_SETTINGS_UPDATED',
    metadata: {}
  });

  return ok(res, row);
}
