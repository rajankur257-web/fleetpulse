import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Fleet Pulse API (e2e)', () => {
  let app: INestApplication;
  let createdDriverId: string;
  let createdRequestId: string;

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
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // --------------------------------------------------------------------------
  // 1. Health Endpoints
  // --------------------------------------------------------------------------
  describe('Health Module', () => {
    it('GET /api/v1/health/live returns 200 ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptimeSeconds).toBe('number');
    });

    it('GET /api/v1/health/ready returns 200 with database and redis connected', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
      expect(res.body.redis).toBe('connected');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Drivers Endpoints
  // --------------------------------------------------------------------------
  describe('Drivers Module', () => {
    it('POST /api/v1/drivers (valid) creates a new driver', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/drivers')
        .send({
          name: 'Supertest Driver',
          phone: '+919988776655',
          lat: 12.9716,
          lng: 77.5946,
          status: 'available',
          rating: 4.9,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Supertest Driver');
      expect(res.body.status).toBe('available');
      createdDriverId = res.body.id;
    });

    it('POST /api/v1/drivers (invalid latitude > 90) returns 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/drivers')
        .send({
          name: 'Invalid Driver',
          phone: '+919988776655',
          lat: 95.0, // invalid
          lng: 77.5946,
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toBeDefined();
    });

    it('POST /api/v1/drivers (missing required fields) returns 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/drivers')
        .send({
          name: 'Missing Coords',
        })
        .expect(400);
    });

    it('GET /api/v1/drivers lists drivers with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/drivers?page=1&limit=5')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/drivers?status=available filters available drivers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/drivers?status=available&limit=10')
        .expect(200);

      res.body.data.forEach((d: { status: string }) => {
        expect(d.status).toBe('available');
      });
    });

    it('GET /api/v1/drivers/:id returns driver by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/drivers/${createdDriverId}`)
        .expect(200);

      expect(res.body.id).toBe(createdDriverId);
      expect(res.body.name).toBe('Supertest Driver');
    });

    it('GET /api/v1/drivers/:id (non-existent UUID) returns 404', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/drivers/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('PATCH /api/v1/drivers/:id/status updates status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/drivers/${createdDriverId}/status`)
        .send({ status: 'busy' })
        .expect(200);

      expect(res.body.status).toBe('busy');
    });

    it('PATCH /api/v1/drivers/:id/status (invalid enum) returns 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/drivers/${createdDriverId}/status`)
        .send({ status: 'sleeping' })
        .expect(400);
    });

    it('POST /api/v1/drivers/:id/location updates location in hot path', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/drivers/${createdDriverId}/location`)
        .send({
          lat: 12.9352,
          lng: 77.6245,
          heading: 90,
          speed: 40,
        })
        .expect(200);

      expect(res.body.status).toBe('acknowledged');
      expect(res.body.id).toBe(createdDriverId);
    });

    it('POST /api/v1/drivers/:id/location (out of bounds longitude) returns 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/drivers/${createdDriverId}/location`)
        .send({
          lat: 12.9352,
          lng: 190.0, // invalid
        })
        .expect(400);
    });

    it('GET /api/v1/drivers/nearby returns nearby drivers with distance', async () => {
      // First ensure the driver is available
      await request(app.getHttpServer())
        .patch(`/api/v1/drivers/${createdDriverId}/status`)
        .send({ status: 'available' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/drivers/nearby?lat=12.9352&lng=77.6245&radiusKm=5')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0].distanceKm).toBeDefined();
        expect(res.body[0].source).toMatch(/redis|postgis/);
      }
    });

    it('GET /api/v1/drivers/nearby (invalid latitude) returns 400', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/drivers/nearby?lat=95&lng=77.6245')
        .expect(400);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Requests Endpoints
  // --------------------------------------------------------------------------
  describe('Requests Module', () => {
    it('POST /api/v1/requests creates a new delivery request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .send({
          pickupLat: 12.9352,
          pickupLng: 77.6245,
          dropLat: 12.9784,
          dropLng: 77.6408,
          priority: 2,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('pending');
      expect(res.body.priority).toBe(2);
      createdRequestId = res.body.id;
    });

    it('POST /api/v1/requests (invalid pickup coordinates) returns 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/requests')
        .send({
          pickupLat: -95, // invalid
          pickupLng: 77.6245,
          dropLat: 12.9784,
          dropLng: 77.6408,
        })
        .expect(400);
    });

    it('GET /api/v1/requests lists requests with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/requests?page=1&limit=5')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/requests/:id returns request details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/requests/${createdRequestId}`)
        .expect(200);

      expect(res.body.id).toBe(createdRequestId);
      expect(res.body.status).toBe('pending');
    });

    it('POST /api/v1/requests/:id/cancel cancels an active request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/requests/${createdRequestId}/cancel`)
        .expect(200);

      expect(res.body.status).toBe('cancelled');
    });

    it('POST /api/v1/requests/:id/cancel (already cancelled) returns 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/requests/${createdRequestId}/cancel`)
        .expect(400);
    });
  });
});
