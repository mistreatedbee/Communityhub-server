import { Router } from 'express';
import { claimLicense } from '../controllers/onboarding.controller.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { claimLicenseSchema } from '../validators/license.validators.js';

const router = Router();

router.post('/claim', auth, validate(claimLicenseSchema), asyncHandler(claimLicense));

export default router;

