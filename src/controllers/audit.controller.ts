import { Types } from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.js';
import { ok } from '../utils/response.js';

export async function listAuditLogs(req: any, res: any) {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
  const action = String(req.query.action || '').trim();
  const tenantId = String(req.query.tenantId || '').trim();
  const actorUserId = String(req.query.actorUserId || '').trim();

  const filter: Record<string, unknown> = {};
  if (action) filter.action = action;
  if (tenantId && Types.ObjectId.isValid(tenantId)) filter.tenantId = tenantId;
  if (actorUserId && Types.ObjectId.isValid(actorUserId)) filter.actorUserId = actorUserId;

  const [items, total] = await Promise.all([
    AuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    AuditLogModel.countDocuments(filter)
  ]);

  return ok(res, {
    items: items.map((a) => ({
      id: String(a._id),
      actorUserId: a.actorUserId ? String(a.actorUserId) : null,
      tenantId: a.tenantId ? String(a.tenantId) : null,
      action: a.action,
      metadata: a.metadata,
      createdAt: a.createdAt
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
}

