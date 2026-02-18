# CommunityHub Backend (Render)

## Stack
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT auth + bcrypt
- Refresh token rotation
- Express rate limiting
- zod validation

## Env Vars (Render)
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN=7d`
- `CLIENT_ORIGIN=https://<your-frontend-domain>`
- `NODE_ENV=production`
- `PORT` (provided by Render)

## Render Service Setup
1. Create a new **Web Service** from this repo.
2. Set Root Directory to `server`.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Health check path: `/health`
6. Add env vars listed above.

## Local Run
```bash
cd server
npm install
npm run dev
```

## Super Admin Seeding
Create or update super admin:
```bash
cd server
MONGODB_URI=... SUPER_ADMIN_EMAIL=admin@example.com SUPER_ADMIN_PASSWORD='StrongPass123!' npm run seed:super-admin
```

Promote existing user:
```bash
cd server
MONGODB_URI=... npm run promote:super-admin -- user@example.com
```

## Health
- `GET /health` returns `200` with uptime and timestamp.

## Tenant Feature Endpoints
- Base: `/api/tenants/:tenantId/features`
- `GET /dashboard`
- Announcements: `GET /announcements`, `POST /announcements`, `DELETE /announcements/:id`
- Posts: `GET /posts`, `POST /posts`, `DELETE /posts/:id`
- Resources: `GET /resources`, `POST /resources`, `DELETE /resources/:id`
- Groups: `GET /groups`, `POST /groups`, `POST /groups/:groupId/join`, `DELETE /groups/:groupId/leave`
- Events: `GET /events`, `POST /events`, `POST /events/:eventId/rsvp`
- Programs: `GET /programs`, `POST /programs`, `POST /programs/modules`, `POST /programs/assign`, `POST /programs/:programId/enroll`
- Members: `GET /members`, `PUT /members/:userId`
- Invitations: `GET /invitations`, `POST /invitations`
- Notifications: `GET /notifications`, `PUT /notifications/:id/read`
- Registration fields: `GET /registration-fields`, `POST /registration-fields`, `PUT /registration-fields/:id`
- Tenant settings: `GET /settings`, `PUT /settings`

## Auth Hardening
- `POST /api/auth/login` now returns `token` and `refreshToken`.
- `POST /api/auth/refresh` rotates refresh tokens and issues new access token.
- Global and auth-specific rate limits are enabled.

## Tests
- Command: `npm test`
- Includes integration coverage for register/login/me, RBAC, license verify, onboarding claim, tenant isolation.
