import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profile.controller.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema } from '../validators/profile.validators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(auth);
router.get('/', asyncHandler(getProfile));
router.put('/', validate(updateProfileSchema), asyncHandler(updateProfile));

export default router;

