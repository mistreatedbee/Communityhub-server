import { PlanModel } from '../models/Plan.js';
import { AppError } from '../utils/errors.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../utils/audit.js';

export async function createPlan(req: any, res: any) {
  const created = await PlanModel.create(req.body);

  await writeAuditLog({
    actorUserId: req.user.sub,
    action: 'PLAN_CREATE',
    metadata: { planId: String(created._id), name: created.name }
  });

  return ok(res, created, 201);
}

export async function listPlans(_req: any, res: any) {
  const plans = await PlanModel.find().sort({ createdAt: -1 }).lean();
  return ok(res, plans);
}

export async function updatePlan(req: any, res: any) {
  const updated = await PlanModel.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).lean();

  if (!updated) throw new AppError('Plan not found', 404, 'NOT_FOUND');

  await writeAuditLog({
    actorUserId: req.user.sub,
    action: 'PLAN_UPDATE',
    metadata: { planId: String(updated._id) }
  });

  return ok(res, updated);
}

export async function deletePlan(req: any, res: any) {
  const deleted = await PlanModel.findByIdAndDelete(req.params.id).lean();
  if (!deleted) throw new AppError('Plan not found', 404, 'NOT_FOUND');

  await writeAuditLog({
    actorUserId: req.user.sub,
    action: 'PLAN_DELETE',
    metadata: { planId: req.params.id }
  });

  return res.status(204).send();
}

