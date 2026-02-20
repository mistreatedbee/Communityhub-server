import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

type JwtUser = {
  sub: string;
  email: string;
  globalRole: 'SUPER_ADMIN' | 'USER';
};

export function signJwt(payload: JwtUser) {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn']
  });
}

export function verifyJwt(token: string) {
  return jwt.verify(token, env.jwtSecret) as JwtUser;
}
