import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UserRole } from '@fleet-pulse/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Security, Auth & Anti-Spoofing E2E (M10)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let dispatcherToken: string;
  let driverAToken: string;
  let driverBToken: string;

  let driverAId: string;
  let driverBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Seed test drivers
    const dA = await prisma.driver.create({
      data: {
        name: 'Test Driver Alpha',
        phone: '+919100000001',
        status: 'available',
        lat: 12.9352,
        lng: 77.6245,
      },
    });
    driverAId = dA.id;

    const dB = await prisma.driver.create({
      data: {
        name: 'Test Driver Beta',
        phone: '+919100000002',
        status: 'available',
        lat: 12.9716,
        lng: 77.5946,
      },
    });
    driverBId = dB.id;

    // Register / Login Admin
    const adminEmail = `admin-${Date.now()}@fleetpulse.com`;
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: adminEmail,
        password: 'Password123!',
        name: 'Super Admin',
        role: UserRole.ADMIN,
      })
      .expect(201);
    adminToken = adminRes.body.accessToken;

    // Register / Login Dispatcher
    const dispEmail = `dispatcher-${Date.now()}@fleetpulse.com`;
    const dispRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: dispEmail,
        password: 'Password123!',
        name: 'Fleet Dispatcher',
        role: UserRole.DISPATCHER,
      })
      .expect(201);
    dispatcherToken = dispRes.body.accessToken;

    // Register / Login Driver A
    const driverAEmail = `driverA-${Date.now()}@fleetpulse.com`;
    const drvARes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: driverAEmail,
        password: 'Password123!',
        name: 'Driver Alpha',
        role: UserRole.DRIVER,
        driverId: driverAId,
      })
      .expect(201);
    driverAToken = drvARes.body.accessToken;

    // Register / Login Driver B
    const driverBEmail = `driverB-${Date.now()}@fleetpulse.com`;
    const drvBRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: driverBEmail,
        password: 'Password123!',
        name: 'Driver Beta',
        role: UserRole.DRIVER,
        driverId: driverBId,
      })
      .expect(201);
    driverBToken = drvBRes.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup created records
    try {
      if (driverAId) await prisma.driver.delete({ where: { id: driverAId } }).catch(() => {});
      if (driverBId) await prisma.driver.delete({ where: { id: driverBId } }).catch(() => {});
    } catch {
      // ignore
    }
    await app.close();
  });

  // --------------------------------------------------------------------------
  // 1. Authentication & Argon2 Password Hashing
  // --------------------------------------------------------------------------
  describe('Authentication Lifecycle', () => {
    it('rejects login with invalid password (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@fleetpulse.com',
          password: 'WrongPassword!',
        })
        .expect(401);
    });

    it('successfully logs in with Argon2-verified password and issues JWT pair', async () => {
      const email = `login-test-${Date.now()}@fleetpulse.com`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Argon2Password123!',
          name: 'Argon User',
          role: UserRole.DISPATCHER,
        })
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'Argon2Password123!',
        })
        .expect(200);

      expect(loginRes.body).toHaveProperty('accessToken');
      expect(loginRes.body).toHaveProperty('refreshToken');
      expect(loginRes.body.user.email).toBe(email.toLowerCase());
    });

    it('exchanges valid refresh token for a new access token', async () => {
      const email = `refresh-test-${Date.now()}@fleetpulse.com`;
      const reg = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password123!',
          name: 'Refresh User',
          role: UserRole.DISPATCHER,
        })
        .expect(201);

      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: reg.body.refreshToken })
        .expect(200);

      expect(refreshRes.body).toHaveProperty('accessToken');
      expect(refreshRes.body).toHaveProperty('refreshToken');
    });

    it('rejects invalid refresh token (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-garbage-token' })
        .expect(401);
    });

    it('GET /api/v1/auth/me returns current user with valid Bearer token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.role).toBe(UserRole.ADMIN);
      expect(res.body).toHaveProperty('id');
    });

    it('GET /api/v1/auth/me rejects unauthenticated request (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Role-Based Access Control (RBAC) Isolation
  // --------------------------------------------------------------------------
  describe('RBAC Route Isolation', () => {
    describe('Admin Only Endpoint (/auth/admin-only)', () => {
      it('allows Admin user to access', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/auth/admin-only')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(res.body.message).toBe('Welcome Admin');
      });

      it('forbids Dispatcher from accessing admin-only endpoint (403)', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/auth/admin-only')
          .set('Authorization', `Bearer ${dispatcherToken}`)
          .expect(403);
      });

      it('forbids Driver from accessing admin-only endpoint (403)', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/auth/admin-only')
          .set('Authorization', `Bearer ${driverAToken}`)
          .expect(403);
      });
    });

    describe('Dispatcher Endpoint (/auth/dispatcher-only)', () => {
      it('allows Admin user to access dispatcher endpoint', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/auth/dispatcher-only')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('allows Dispatcher user to access dispatcher endpoint', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/auth/dispatcher-only')
          .set('Authorization', `Bearer ${dispatcherToken}`)
          .expect(200);
      });

      it('forbids Driver from accessing dispatcher endpoint (403)', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/auth/dispatcher-only')
          .set('Authorization', `Bearer ${driverAToken}`)
          .expect(403);
      });
    });

    describe('Driver Endpoint (/auth/driver-only)', () => {
      it('allows Driver to access driver-only endpoint', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/auth/driver-only')
          .set('Authorization', `Bearer ${driverAToken}`)
          .expect(200);
      });

      it('forbids Dispatcher from driver-only endpoint (403)', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/auth/driver-only')
          .set('Authorization', `Bearer ${dispatcherToken}`)
          .expect(403);
      });
    });
  });

  // --------------------------------------------------------------------------
  // 3. Driver Ownership & Anti-Spoofing Enforcement
  // --------------------------------------------------------------------------
  describe('Driver Ownership & Anti-Spoofing', () => {
    it('allows Driver A to update their OWN status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/drivers/${driverAId}/status`)
        .set('Authorization', `Bearer ${driverAToken}`)
        .send({ status: 'busy' })
        .expect(200);

      expect(res.body.status).toBe('busy');
    });

    it('allows Driver B to update their OWN status using Driver B credentials', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/drivers/${driverBId}/status`)
        .set('Authorization', `Bearer ${driverBToken}`)
        .send({ status: 'busy' })
        .expect(200);

      expect(res.body.status).toBe('busy');
    });

    it('PREVENTS Driver A from updating Driver B status (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/drivers/${driverBId}/status`)
        .set('Authorization', `Bearer ${driverAToken}`)
        .send({ status: 'offline' })
        .expect(403);

      expect(res.body.message).toContain('Forbidden: You can only modify your own driver records');
    });

    it('allows Driver A to update their OWN location', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/drivers/${driverAId}/location`)
        .set('Authorization', `Bearer ${driverAToken}`)
        .send({
          lat: 12.936,
          lng: 77.625,
          speed: 30,
        })
        .expect(200);

      expect(res.body.status).toBe('acknowledged');
    });

    it('PREVENTS Driver A from spoofing Driver B location (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/drivers/${driverBId}/location`)
        .set('Authorization', `Bearer ${driverAToken}`)
        .send({
          lat: 12.972,
          lng: 77.595,
          speed: 30,
        })
        .expect(403);

      expect(res.body.message).toContain('Forbidden: You can only modify your own driver records');
    });

    it('allows Admin to update any driver location (Admin bypass)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/drivers/${driverBId}/location`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lat: 12.972,
          lng: 77.595,
          speed: 25,
        })
        .expect(200);

      expect(res.body.status).toBe('acknowledged');
    });

    it('allows Dispatcher to update any driver status (Dispatcher bypass)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/drivers/${driverBId}/status`)
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .send({ status: 'busy' })
        .expect(200);

      expect(res.body.status).toBe('busy');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Anti-Spoofing Velocity & Jump Validation
  // --------------------------------------------------------------------------
  describe('Anti-Spoofing Velocity & Geofence Checks', () => {
    it('rejects impossible velocity / teleportation jump with 400 Bad Request', async () => {
      // Driver A at (12.936, 77.625) Koramangala
      // Immediate ping 25km away at Hebbal (13.035, 77.597) in 0 seconds
      const res = await request(app.getHttpServer())
        .post(`/api/v1/drivers/${driverAId}/location`)
        .set('Authorization', `Bearer ${driverAToken}`)
        .send({
          lat: 13.035,
          lng: 77.597,
          speed: 40,
        })
        .expect(400);

      expect(res.body.message).toContain('Teleportation / unrealistic velocity jump detected');
    });

    it('rejects out-of-bounds latitude > 90 (400 Bad Request)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/drivers/${driverAId}/location`)
        .set('Authorization', `Bearer ${driverAToken}`)
        .send({
          lat: 95.0,
          lng: 77.625,
        })
        .expect(400);
    });

    it('rejects out-of-bounds longitude > 180 (400 Bad Request)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/drivers/${driverAId}/location`)
        .set('Authorization', `Bearer ${driverAToken}`)
        .send({
          lat: 12.936,
          lng: 195.0,
        })
        .expect(400);
    });
  });
});
