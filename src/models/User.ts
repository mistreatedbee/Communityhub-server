import { Schema, model } from 'mongoose';

export type GlobalRole = 'SUPER_ADMIN' | 'USER';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, default: '' },
    phone: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    globalRole: { type: String, enum: ['SUPER_ADMIN', 'USER'], default: 'USER' }
  },
  { timestamps: true }
);

export const UserModel = model('User', userSchema);

