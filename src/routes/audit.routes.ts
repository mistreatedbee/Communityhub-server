import { Router } from 'express';
import { listAuditLogs } from '../controllers/audit.controller.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(auth, requireRole('SUPER_ADMIN'));
router.get('/', asyncHandler(listAuditLogs));

export default router;

