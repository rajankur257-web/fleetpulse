import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SeededPRNG } from '../src/modules/simulator/prng';

describe('Fleet Simulator E2E & Seeded PRNG', () => {
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
    // Ensure simulator is stopped
    await request(app.getHttpServer()).post('/api/v1/sim/stop');
    await app.close();
  });

  describe('Seeded PRNG Reproducibility', () => {
    it('produces identical pseudo-random sequences for the same seed', () => {
      const prng1 = new SeededPRNG(12345);
      const prng2 = new SeededPRNG(12345);

      const seq1 = Array.from({ length: 50 }, () => prng1.next());
      const seq2 = Array.from({ length: 50 }, () => prng2.next());

      expect(seq1).toEqual(seq2);
    });

    it('produces different sequences for different seeds', () => {
      const prng1 = new SeededPRNG(12345);
      const prng2 = new SeededPRNG(54321);

      const seq1 = Array.from({ length: 10 }, () => prng1.next());
      const seq2 = Array.from({ length: 10 }, () => prng2.next());

      expect(seq1).not.toEqual(seq2);
    });

    it('generates values within specified ranges correctly', () => {
      const prng = new SeededPRNG(999);
      for (let i = 0; i < 100; i++) {
        const val = prng.range(10, 50);
        expect(val).toBeGreaterThanOrEqual(10);
        expect(val).toBeLessThan(50);

        const intVal = prng.intRange(1, 5);
        expect(intVal).toBeGreaterThanOrEqual(1);
        expect(intVal).toBeLessThanOrEqual(5);
        expect(Number.isInteger(intVal)).toBe(true);
      }
    });
  });

  describe('Simulator REST Controller (/api/v1/sim)', () => {
    it('GET /api/v1/sim/status returns idle status when stopped', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/sim/status')
        .expect(200);

      expect(res.body).toHaveProperty('running');
      expect(res.body).toHaveProperty('driverCount');
      expect(res.body).toHaveProperty('doubleAssignmentsDetected', 0);
    });

    it('POST /api/v1/sim/start starts the simulation with custom config', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sim/start')
        .send({
          driverCount: 5,
          speedMultiplier: 5,
          requestRatePerMinute: 0, // no auto-requests during unit test
          acceptProbability: 0.9,
          seed: 42,
        })
        .expect(200);

      expect(res.body.message).toBe('Fleet simulation started');
      expect(res.body.stats.running).toBe(true);
      expect(res.body.stats.driverCount).toBe(5);
      expect(res.body.stats.doubleAssignmentsDetected).toBe(0);
    });

    it('GET /api/v1/sim/status returns active stats and zero double assignments', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/sim/status')
        .expect(200);

      expect(res.body.running).toBe(true);
      expect(res.body.driverCount).toBe(5);
      expect(res.body.doubleAssignmentsDetected).toBe(0);
    });

    it('POST /api/v1/sim/stop stops simulation and reports final metrics', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sim/stop')
        .expect(200);

      expect(res.body.message).toBe('Fleet simulation stopped');
      expect(res.body.stats.running).toBe(false);
      expect(res.body.stats.doubleAssignmentsDetected).toBe(0);
    });
  });
});
