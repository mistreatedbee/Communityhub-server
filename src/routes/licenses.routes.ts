import { Router } from 'express';
import {
  generateLicense,
  listLicenses,
  suspendLicense,
  verifyLicense
} from '../controllers/licenses.controller.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { generateLicenseSchema, verifyLicenseSchema } from '../validators/license.validators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/verify', validate(verifyLicenseSchema), asyncHandler(verifyLicense));

router.use(auth, requireRole('SUPER_ADMIN'));
router.post('/generate', validate(generateLicenseSchema), asyncHandler(generateLicense));
router.get('/', asyncHandler(listLicenses));
router.put('/:id/suspend', asyncHandler(suspendLicense));

export default router;

