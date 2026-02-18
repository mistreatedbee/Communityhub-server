import { Schema, model } from 'mongoose';

const planSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    maxMembers: { type: Number, required: true, default: 100 },
    maxAdmins: { type: Number, required: true, default: 3 },
    featureFlags: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export const PlanModel = model('Plan', planSchema);

