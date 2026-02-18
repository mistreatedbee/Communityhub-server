import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireTenantRole } from '../middleware/requireTenantRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  assignProgram,
  createAnnouncement,
  createEvent,
  createInvitation,
  createPost,
  createProgram,
  createProgramModule,
  createRegistrationField,
  createResource,
  createGroup,
  deleteAnnouncement,
  deleteEvent,
  deletePost,
  deleteResource,
  enrollProgram,
  getTenantSettings,
  getMyMemberProfile,
  joinGroup,
  listAnnouncements,
  listEvents,
  listInvitations,
  listMembers,
  listNotifications,
  listPosts,
  listPrograms,
  listRegistrationFields,
  listResources,
  listGroups,
  markNotificationRead,
  resendInvitation,
  revokeInvitation,
  rsvpEvent,
  tenantDashboard,
  updateMemberRole,
  updateRegistrationField,
  updateTenantSettings,
  updateMyMemberProfile,
  leaveGroup
} from '../controllers/tenantFeatures.controller.js';

const router = Router({ mergeParams: true });

router.use(auth);

router.get('/dashboard', asyncHandler(tenantDashboard));

router.get('/announcements', asyncHandler(listAnnouncements));
router.post('/announcements', requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']), asyncHandler(createAnnouncement));
router.delete(
  '/announcements/:id',
  requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']),
  asyncHandler(deleteAnnouncement)
);

router.get('/posts', asyncHandler(listPosts));
router.post('/posts', requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']), asyncHandler(createPost));
router.delete('/posts/:id', requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']), asyncHandler(deletePost));

router.get('/resources', asyncHandler(listResources));
router.post('/resources', requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']), asyncHandler(createResource));
router.delete('/resources/:id', requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']), asyncHandler(deleteResource));

router.get('/groups', asyncHandler(listGroups));
router.post('/groups', requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']), asyncHandler(createGroup));
router.post('/groups/:groupId/join', asyncHandler(joinGroup));
router.delete('/groups/:groupId/leave', asyncHandler(leaveGroup));

router.get('/events', asyncHandler(listEvents));
router.post('/events', requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']), asyncHandler(createEvent));
router.delete('/events/:id', requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']), asyncHandler(deleteEvent));
router.post('/events/:eventId/rsvp', asyncHandler(rsvpEvent));

router.get('/programs', asyncHandler(listPrograms));
router.post('/programs', requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']), asyncHandler(createProgram));
router.post('/programs/modules', requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']), asyncHandler(createProgramModule));
router.post('/programs/assign', requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']), asyncHandler(assignProgram));
router.post('/programs/:programId/enroll', asyncHandler(enrollProgram));

router.get('/members', requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(listMembers));
router.put('/members/:userId', requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(updateMemberRole));

router.get('/invitations', requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(listInvitations));
router.post('/invitations', requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(createInvitation));
router.put('/invitations/:id/resend', requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(resendInvitation));
router.put('/invitations/:id/revoke', requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(revokeInvitation));

router.get('/notifications', asyncHandler(listNotifications));
router.put('/notifications/:id/read', asyncHandler(markNotificationRead));
router.get('/member-profile', asyncHandler(getMyMemberProfile));
router.put('/member-profile', asyncHandler(updateMyMemberProfile));

router.get('/registration-fields', requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(listRegistrationFields));
router.post('/registration-fields', requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(createRegistrationField));
router.put('/registration-fields/:id', requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(updateRegistrationField));

router.get('/settings', requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(getTenantSettings));
router.put('/settings', requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(updateTenantSettings));

export default router;
