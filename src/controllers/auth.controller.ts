import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User.js';
import { MembershipModel } from '../models/Membership.js';
import { AppError } from '../utils/errors.js';
import { ok } from '../utils/response.js';
import { signJwt } from '../utils/jwt.js';
import { writeAuditLog } from '../utils/audit.js';
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from '../utils/refreshToken.js';

function authUserPayload(user: {
  _id: unknown;
  email: string;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  globalRole: 'SUPER_ADMIN' | 'USER';
}) {
  return {
    id: String(user._id),
    email: user.email,
    fullName: user.fullName || '',
    phone: user.phone || '',
    avatarUrl: user.avatarUrl || '',
    globalRole: user.globalRole
  };
}

export async function register(req: any, res: any) {
  const email = String(req.body.email || '').toLowerCase().trim();
  const existing = await UserModel.findOne({ email }).lean();
  if (existing) throw new AppError('Email already in use', 409, 'EMAIL_EXISTS');

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const created = await UserModel.create({
    email,
    passwordHash,
    fullName: req.body.fullName || '',
    phone: req.body.phone || '',
    globalRole: 'USER'
  });

  await writeAuditLog({
    actorUserId: String(created._id),
    action: 'AUTH_REGISTER',
    metadata: { email: created.email }
  });

  const token = signJwt({
    sub: String(created._id),
    email: created.email,
    globalRole: created.globalRole
  });
  const refresh = await issueRefreshToken({
    userId: String(created._id),
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  });

  return ok(res, { token, refreshToken: refresh.raw, user: authUserPayload(created) }, 201);
}

export async function login(req: any, res: any) {
  const email = String(req.body.email || '').toLowerCase().trim();
  const user = await UserModel.findOne({ email });
  if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!valid) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const token = signJwt({
    sub: String(user._id),
    email: user.email,
    globalRole: user.globalRole
  });
  const refresh = await issueRefreshToken({
    userId: String(user._id),
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  });

  const memberships = await MembershipModel.find({
    userId: user._id
  })
    .sort({ createdAt: -1 })
    .lean();

  await writeAuditLog({
    actorUserId: String(user._id),
    action: 'AUTH_LOGIN',
    metadata: { email: user.email }
  });

  return ok(res, {
    token,
    refreshToken: refresh.raw,
    user: authUserPayload(user),
    memberships: memberships.map((m) => ({
      id: String(m._id),
      tenantId: String(m.tenantId),
      role: m.role,
      status: m.status
    }))
  });
}

export async function me(req: any, res: any) {
  const user = await UserModel.findById(req.user.sub).lean();
  if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

  const memberships = await MembershipModel.find({
    userId: user._id
  }).lean();

  return ok(res, {
    user: authUserPayload(user),
    memberships: memberships.map((m) => ({
      id: String(m._id),
      tenantId: String(m.tenantId),
      role: m.role,
      status: m.status
    }))
  });
}

export async function logout(_req: any, res: any) {
  const refreshToken = _req.body?.refreshToken;
  if (_req.user?.sub && refreshToken) {
    await revokeRefreshToken(refreshToken, _req.user.sub);
  }
  return res.status(204).send();
}

export async function refresh(req: any, res: any) {
  const accessToken = req.body?.accessToken;
  const rawRefreshToken = req.body?.refreshToken;
  if (!accessToken || !rawRefreshToken) {
    throw new AppError('accessToken and refreshToken are required', 400, 'VALIDATION_ERROR');
  }

  const decodedPayload = jwt.decode(accessToken) as {
    sub?: string;
    email?: string;
    globalRole?: 'SUPER_ADMIN' | 'USER';
  } | null;

  if (!decodedPayload?.sub || !decodedPayload.email || !decodedPayload.globalRole) {
    throw new AppError('Invalid accessToken payload', 401, 'INVALID_TOKEN');
  }

  const rotated = await rotateRefreshToken({
    rawToken: rawRefreshToken,
    userId: decodedPayload.sub,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || ''
  });
  if (!rotated) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  const token = signJwt({
    sub: decodedPayload.sub,
    email: decodedPayload.email,
    globalRole: decodedPayload.globalRole
  });

  return ok(res, { token, refreshToken: rotated.raw });
}
