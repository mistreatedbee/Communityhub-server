import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;
let app: any;
let UserModel: any;

async function registerAndLogin(email: string, password: string, fullName: string) {
  await request(app).post('/api/auth/register').send({ email, password, fullName }).expect(201);
  const login = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
  return login.body.data as { token: string; refreshToken?: string; user: { id: string } };
}

describe('auth/rbac/onboarding integration', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      binary: { version: '6.0.14' }
    });
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.CLIENT_ORIGIN = 'http://localhost:5173';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4001';

    const importedApp = await import('../app.js');
    app = importedApp.createApp();
    const models = await import('../models/User.js');
    UserModel = models.UserModel;
    await mongoose.connect(process.env.MONGODB_URI as string);
  }, 300000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  });

  it('register/login/me works and refresh rotates token', async () => {
    const payload = await registerAndLogin('user1@example.com', 'Password123!', 'User One');
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${payload.token}`)
      .expect(200);

    expect(me.body.data.user.email).toBe('user1@example.com');

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .send({ accessToken: payload.token, refreshToken: payload.refreshToken })
      .expect(200);

    expect(refreshed.body.data.token).toBeTruthy();
    expect(refreshed.body.data.refreshToken).toBeTruthy();
    expect(refreshed.body.data.refreshToken).not.toBe(payload.refreshToken);
  });

  it('enforces RBAC for super admin routes', async () => {
    const user = await registerAndLogin('user2@example.com', 'Password123!', 'User Two');

    await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(403);

    const adminPasswordHash = await bcrypt.hash('Password123!', 10);
    const admin = await UserModel.create({
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      fullName: 'Admin',
      phone: '',
      avatarUrl: '',
      globalRole: 'SUPER_ADMIN'
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
      .expect(200);

    expect(adminLogin.body.data.user.id).toBe(String(admin._id));

    await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${adminLogin.body.data.token}`)
      .expect(200);
  });

  it('supports license verify + onboarding claim flow and tenant isolation', async () => {
    const adminPasswordHash = await bcrypt.hash('Password123!', 10);
    await UserModel.create({
      email: 'super@example.com',
      passwordHash: adminPasswordHash,
      fullName: 'Super',
      phone: '',
      avatarUrl: '',
      globalRole: 'SUPER_ADMIN'
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'super@example.com', password: 'Password123!' })
      .expect(200);
    const adminToken = adminLogin.body.data.token as string;

    const plan = await request(app)
      .post('/api/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Starter', description: 'Starter', maxMembers: 25, maxAdmins: 2, featureFlags: {} })
      .expect(201);

    const license = await request(app)
      .post('/api/licenses/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planId: plan.body.data._id, singleUse: true })
      .expect(201);

    const key = license.body.data.key as string;

    await request(app).post('/api/licenses/verify').send({ licenseKey: key }).expect(200);

    const user = await registerAndLogin('owner@example.com', 'Password123!', 'Owner One');
    const claimed = await request(app)
      .post('/api/onboarding/claim')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ licenseKey: key, tenant: { name: 'Tenant A', slug: 'tenant-a' } })
      .expect(201);

    const tenantId = claimed.body.data.tenant.id as string;

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    expect(me.body.data.memberships.length).toBe(1);
    expect(me.body.data.memberships[0].role).toBe('OWNER');

    const outsider = await registerAndLogin('outsider@example.com', 'Password123!', 'Outsider');
    await request(app)
      .get(`/api/tenants/${tenantId}/members`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(403);
  });
});
