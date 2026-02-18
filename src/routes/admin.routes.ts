import { Router } from 'express';
import {
  createTenant,
  deleteTenant,
  listTenants,
  listUsers,
  overview,
  updateTenantStatus
} from '../controllers/admin.controller.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { createTenantSchema } from '../validators/tenant.validators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(auth, requireRole('SUPER_ADMIN'));

router.get('/overview', asyncHandler(overview));
router.get('/users', asyncHandler(listUsers));
router.get('/tenants', asyncHandler(listTenants));
router.post('/tenants', validate(createTenantSchema), asyncHandler(createTenant));
router.put('/tenants/:id/status', asyncHandler(updateTenantStatus));
router.delete('/tenants/:id', asyncHandler(deleteTenant));

export default router;
