import crypto from 'crypto';
import { RefreshTokenModel } from '../models/RefreshToken.js';

function hash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateRawRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

export async function issueRefreshToken(input: {
  userId: string;
  ip?: string;
  userAgent?: string;
  ttlMs?: number;
}) {
  const raw = generateRawRefreshToken();
  const tokenHash = hash(raw);
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? 30 * 24 * 60 * 60 * 1000));
  await RefreshTokenModel.create({
    userId: input.userId,
    tokenHash,
    expiresAt,
    createdByIp: input.ip || '',
    userAgent: input.userAgent || ''
  });
  return { raw, tokenHash, expiresAt };
}

export async function rotateRefreshToken(input: {
  rawToken: string;
  userId: string;
  ip?: string;
  userAgent?: string;
}) {
  const oldHash = hash(input.rawToken);
  const oldToken = await RefreshTokenModel.findOne({
    tokenHash: oldHash,
    userId: input.userId,
    revokedAt: null
  });
  if (!oldToken || oldToken.expiresAt.getTime() < Date.now()) {
    return null;
  }

  const issued = await issueRefreshToken({
    userId: input.userId,
    ip: input.ip,
    userAgent: input.userAgent
  });
  oldToken.revokedAt = new Date();
  oldToken.replacedByTokenHash = issued.tokenHash;
  await oldToken.save();
  return issued;
}

export async function revokeRefreshToken(rawToken: string, userId: string) {
  const tokenHash = hash(rawToken);
  await RefreshTokenModel.updateOne(
    { tokenHash, userId, revokedAt: null },
    { revokedAt: new Date() }
  );
}

