import type { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & {
        sub: string;
        email: string;
        globalRole: 'SUPER_ADMIN' | 'USER';
      };
    }
  }
}

export {};
