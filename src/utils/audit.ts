import { AuditLogModel } from '../models/AuditLog.js';

export async function writeAuditLog(input: {
  actorUserId?: string | null;
  tenantId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await AuditLogModel.create({
    actorUserId: input.actorUserId || null,
    tenantId: input.tenantId || null,
    action: input.action,
    metadata: input.metadata || {}
  });
}

