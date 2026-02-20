import { Schema, model, Types } from 'mongoose';

export type TenantRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

const membershipSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'], default: 'MEMBER' },
    status: { type: String, enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED'], default: 'ACTIVE' }
  },
  { timestamps: true }
);

membershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

export const MembershipModel = model('Membership', membershipSchema);

