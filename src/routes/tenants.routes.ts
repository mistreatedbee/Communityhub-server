import { Router } from 'express';
import {
  getTenantContext,
  getTenantById,
  getTenantJoinInfo,
  getTenantMembers,
  getTenantPublic,
  inviteMember,
  joinTenantBySlug,
  joinTenant,
  listPublicTenants
} from '../controllers/tenants.controller.js';
import { auth } from '../middleware/auth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { requireTenantRole } from '../middleware/requireTenantRole.js';
import { validate } from '../middleware/validate.js';
import { inviteMemberSchema } from '../validators/tenant.validators.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import tenantFeaturesRoutes from './tenantFeatures.routes.js';

const router = Router();

router.get('/public', asyncHandler(listPublicTenants));
router.get('/id/:tenantId', auth, asyncHandler(getTenantById));
router.get('/:slug/join-info', optionalAuth, asyncHandler(getTenantJoinInfo));
router.post('/:slug/join', auth, asyncHandler(joinTenantBySlug));
router.get('/:slug/context', optionalAuth, asyncHandler(getTenantContext));
router.get('/:slug', asyncHandler(getTenantPublic));
router.post('/:tenantId/join', auth, asyncHandler(joinTenant));
router.get('/:tenantId/members', auth, requireTenantRole(['OWNER', 'ADMIN']), asyncHandler(getTenantMembers));
router.post(
  '/:tenantId/members/invite',
  auth,
  requireTenantRole(['OWNER', 'ADMIN']),
  validate(inviteMemberSchema),
  asyncHandler(inviteMember)
);
router.use('/:tenantId/features', tenantFeaturesRoutes);

export default router;
