import { Schema, model } from 'mongoose';

export type GlobalRole = 'SUPER_ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, default: '' },
    phone: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    globalRole: { type: String, enum: ['SUPER_ADMIN', 'USER'], default: 'USER' },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'BANNED'], default: 'ACTIVE', index: true }
  },
  { timestamps: true }
);

export const UserModel = model('User', userSchema);

