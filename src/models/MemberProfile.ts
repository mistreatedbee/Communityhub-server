import { Schema, Types, model } from 'mongoose';

const memberProfileSchema = new Schema(
  {
    tenantId: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    fullName: { type: String, default: '' },
    phone: { type: String, default: '' },
    customFields: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

memberProfileSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

export const MemberProfileModel = model('MemberProfile', memberProfileSchema);
