import { Router } from 'express';
import { createPlan, deletePlan, listPlans, updatePlan } from '../controllers/plans.controller.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { createPlanSchema, updatePlanSchema } from '../validators/plan.validators.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(auth, requireRole('SUPER_ADMIN'));
router.post('/', validate(createPlanSchema), asyncHandler(createPlan));
router.get('/', asyncHandler(listPlans));
router.put('/:id', validate(updatePlanSchema), asyncHandler(updatePlan));
router.delete('/:id', asyncHandler(deletePlan));

export default router;

