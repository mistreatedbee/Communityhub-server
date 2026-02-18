import { Schema, model, Types } from 'mongoose';

const auditLogSchema = new Schema(
  {
    actorUserId: { type: Types.ObjectId, ref: 'User', default: null, index: true },
    tenantId: { type: Types.ObjectId, ref: 'Tenant', default: null, index: true },
    action: { type: String, required: true, trim: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLogModel = model('AuditLog', auditLogSchema);

