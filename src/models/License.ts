import { Schema, model, Types } from 'mongoose';

const licenseSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    planId: { type: Types.ObjectId, ref: 'Plan', required: true, index: true },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'CLAIMED'], default: 'ACTIVE' },
    singleUse: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    claimedAt: { type: Date, default: null },
    claimedByUserId: { type: Types.ObjectId, ref: 'User', default: null },
    claimedTenantId: { type: Types.ObjectId, ref: 'Tenant', default: null },
    limitsSnapshot: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const LicenseModel = model('License', licenseSchema);

