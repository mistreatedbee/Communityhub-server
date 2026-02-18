import { Schema, model, Types } from 'mongoose';

const tenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    description: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    category: { type: String, default: '' },
    location: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const TenantModel = model('Tenant', tenantSchema);
