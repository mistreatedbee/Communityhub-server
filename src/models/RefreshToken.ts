import { Schema, Types, model } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    createdByIp: { type: String, default: '' },
    userAgent: { type: String, default: '' }
  },
  { timestamps: true }
);

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);

