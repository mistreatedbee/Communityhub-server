import { Schema, Types, model } from 'mongoose';

const baseOpts = { timestamps: true };

const announcementSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    isPinned: { type: Boolean, default: false },
    visibility: { type: String, enum: ['PUBLIC', 'MEMBERS', 'LEADERS'], default: 'MEMBERS' },
    authorUserId: { type: Types.ObjectId, ref: 'User', required: true }
  },
  baseOpts
);

const postSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    visibility: { type: String, enum: ['PUBLIC', 'MEMBERS', 'LEADERS'], default: 'MEMBERS' },
    isPublished: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now },
    authorUserId: { type: Types.ObjectId, ref: 'User', required: true }
  },
  baseOpts
);

const resourceSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    url: { type: String, default: '' },
    type: { type: String, default: 'link' },
    folder: { type: String, default: '' },
    groupId: { type: Types.ObjectId, ref: 'Group', default: null },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true }
  },
  baseOpts
);

const groupSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    isPrivate: { type: Boolean, default: false },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true }
  },
  baseOpts
);

const groupMembershipSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    groupId: { type: Types.ObjectId, ref: 'Group', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['LEADER', 'MEMBER'], default: 'MEMBER' }
  },
  baseOpts
);
groupMembershipSchema.index({ groupId: 1, userId: 1 }, { unique: true });

const eventSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, default: null },
    location: { type: String, default: '' },
    isOnline: { type: Boolean, default: false },
    meetingLink: { type: String, default: '' },
    hostUserId: { type: Types.ObjectId, ref: 'User', required: true }
  },
  baseOpts
);

const eventRsvpSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    eventId: { type: Types.ObjectId, ref: 'Event', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['GOING', 'INTERESTED', 'NOT_GOING'], default: 'GOING' }
  },
  baseOpts
);
eventRsvpSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const programSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true }
  },
  baseOpts
);

const programModuleSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    programId: { type: Types.ObjectId, ref: 'Program', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 }
  },
  baseOpts
);

const programAssignmentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    programId: { type: Types.ObjectId, ref: 'Program', required: true, index: true },
    groupId: { type: Types.ObjectId, ref: 'Group', required: true, index: true }
  },
  baseOpts
);

const programEnrollmentSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    programId: { type: Types.ObjectId, ref: 'Program', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    progressPct: { type: Number, default: 0 }
  },
  baseOpts
);
programEnrollmentSchema.index({ programId: 1, userId: 1 }, { unique: true });

const invitationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, default: '' },
    role: { type: String, enum: ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'], default: 'MEMBER' },
    status: { type: String, enum: ['PENDING', 'SENT', 'ACCEPTED', 'EXPIRED', 'REVOKED'], default: 'SENT' },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: Types.ObjectId, ref: 'User', required: true },
    acceptedByUserId: { type: Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
    revokedByUserId: { type: Types.ObjectId, ref: 'User', default: null },
    revokedAt: { type: Date, default: null }
  },
  baseOpts
);

const notificationSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, default: 'INFO' },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null }
  },
  baseOpts
);

const registrationFieldSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    fieldType: { type: String, enum: ['TEXT', 'TEXTAREA', 'SELECT', 'CHECKBOX'], default: 'TEXT' },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    fieldOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  baseOpts
);
registrationFieldSchema.index({ tenantId: 1, key: 1 }, { unique: true });

const tenantSettingsSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },
    publicSignup: { type: Boolean, default: true },
    approvalRequired: { type: Boolean, default: false },
    registrationFieldsEnabled: { type: Boolean, default: true }
  },
  baseOpts
);

export const AnnouncementModel = model('Announcement', announcementSchema);
export const TenantPostModel = model('TenantPost', postSchema);
export const TenantResourceModel = model('TenantResource', resourceSchema);
export const GroupModel = model('Group', groupSchema);
export const GroupMembershipModel = model('GroupMembership', groupMembershipSchema);
export const EventModel = model('Event', eventSchema);
export const EventRsvpModel = model('EventRsvp', eventRsvpSchema);
export const ProgramModel = model('Program', programSchema);
export const ProgramModuleModel = model('ProgramModule', programModuleSchema);
export const ProgramAssignmentModel = model('ProgramAssignment', programAssignmentSchema);
export const ProgramEnrollmentModel = model('ProgramEnrollment', programEnrollmentSchema);
export const InvitationModel = model('Invitation', invitationSchema);
export const NotificationModel = model('Notification', notificationSchema);
export const RegistrationFieldModel = model('RegistrationField', registrationFieldSchema);
export const TenantSettingsModel = model('TenantSettings', tenantSettingsSchema);
