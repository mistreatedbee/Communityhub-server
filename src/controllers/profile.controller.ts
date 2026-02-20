import { UserModel } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../utils/audit.js';

export async function getProfile(req: any, res: any) {
  const user = await UserModel.findById(req.user.sub, { passwordHash: 0 }).lean();
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
  return ok(res, user);
}

export async function updateProfile(req: any, res: any) {
  const updated = await UserModel.findByIdAndUpdate(req.user.sub, req.body, {
    new: true,
    runValidators: true,
    projection: { passwordHash: 0 }
  }).lean();

  if (!updated) throw new AppError('User not found', 404, 'NOT_FOUND');

  await writeAuditLog({
    actorUserId: req.user.sub,
    action: 'PROFILE_UPDATE',
    metadata: { updatedFields: Object.keys(req.body) }
  });

  return ok(res, updated);
}

