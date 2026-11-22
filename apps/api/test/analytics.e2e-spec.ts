import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Analytics & Algorithm Comparison E2E (M8)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/analytics/summary returns comprehensive fleet KPIs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/summary')
      .expect(200);

    expect(res.body).toHaveProperty('averageWaitTimeSeconds');
    expect(res.body).toHaveProperty('averageAssignmentTimeSeconds');
    expect(res.body).toHaveProperty('totalDistanceKm');
    expect(res.body).toHaveProperty('driverUtilizationRate');
    expect(res.body).toHaveProperty('acceptanceRate');
    expect(res.body).toHaveProperty('requestsPerHour');
    expect(res.body).toHaveProperty('totalRequests');
  });

  it('GET /api/v1/analytics/heatmap returns demand coordinates and intensity weights', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/heatmap')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const firstPoint = res.body[0];
    expect(firstPoint).toHaveProperty('lat');
    expect(firstPoint).toHaveProperty('lng');
    expect(firstPoint).toHaveProperty('weight');
    expect(firstPoint).toHaveProperty('requestCount');
  });

  it('GET /api/v1/analytics/repositioning returns repositioning hints for low-supply zones', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/repositioning')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      const hint = res.body[0];
      expect(hint).toHaveProperty('zoneName');
      expect(hint).toHaveProperty('recommendedRepositionCount');
      expect(hint).toHaveProperty('priority');
    }
  });

  it('GET /api/v1/analytics/dead-zones returns dead zone alerts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/dead-zones?thresholdSeconds=60')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v1/analytics/compare produces deterministic results twice with identical seed', async () => {
    const seed = 99999;
    const body = { seed, driverCount: 30, requestCount: 20 };

    const res1 = await request(app.getHttpServer())
      .post('/api/v1/analytics/compare')
      .send(body)
      .expect(201);

    const res2 = await request(app.getHttpServer())
      .post('/api/v1/analytics/compare')
      .send(body)
      .expect(201);

    expect(res1.body.seed).toBe(seed);
    expect(res1.body.strategies).toEqual(res2.body.strategies);

    // Verify all 3 strategies are present
    expect(res1.body.strategies).toHaveProperty('nearest');
    expect(res1.body.strategies).toHaveProperty('scored');
    expect(res1.body.strategies).toHaveProperty('batch');
  });

  it('POST /api/v1/analytics/eta/compare compares Haversine vs road-network metrics', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/analytics/eta/compare')
      .send({
        originLat: 12.9716,
        originLng: 77.5946,
        destLat: 12.9352,
        destLng: 77.6245,
      })
      .expect(201);

    expect(res.body).toHaveProperty('haversine');
    expect(res.body).toHaveProperty('osrm');
    expect(res.body).toHaveProperty('detourFactor');
    expect(res.body.haversine.distanceKm).toBeGreaterThan(0);
    expect(res.body.osrm.distanceKm).toBeGreaterThan(0);
  });

  it('GET /api/v1/analytics/pulse-scores returns ranked driver Pulse Scores', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/pulse-scores')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const topDriver = res.body[0];
    expect(topDriver).toHaveProperty('driverId');
    expect(topDriver).toHaveProperty('pulseScore');
    expect(topDriver.pulseScore).toBeGreaterThanOrEqual(0);
    expect(topDriver.pulseScore).toBeLessThanOrEqual(100);
    expect(topDriver).toHaveProperty('components');
  });
});
