import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { DriverStatus, RequestStatus } from '@fleet-pulse/shared';
import { OfferCascadeService } from '../src/modules/realtime/cascade/offer-cascade.service';
import { OfferWorker } from '../src/modules/realtime/cascade/offer.worker';

describe('Realtime Gateway & Offer Cascade Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let port: number;
  let baseUrl: string;

  let testDriver1: { id: string; name: string };
  let testDriver2: { id: string; name: string };

  let dispatcherToken: string;
  let driver1Token: string;
  let driver2Token: string;

  let dispatcherSocket: Socket;
  let driver1Socket: Socket;
  let driver2Socket: Socket;

  const jwtSecret = 'fleetpulse-dev-jwt-access-secret-minimum-32-chars-long';

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

    prisma = app.get<PrismaService>(PrismaService);
    redis = app.get<RedisService>(RedisService);

    // Listen on ephemeral port for live Socket.IO client connections
    const server = await app.listen(0);
    port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Create 2 test drivers in Bengaluru
    testDriver1 = await prisma.driver.create({
      data: {
        name: 'Socket Driver Alpha',
        phone: '+919988112233',
        status: DriverStatus.AVAILABLE,
        rating: 4.9,
        lat: 12.9716,
        lng: 77.5946,
      },
    });

    testDriver2 = await prisma.driver.create({
      data: {
        name: 'Socket Driver Beta',
        phone: '+919988112244',
        status: DriverStatus.AVAILABLE,
        rating: 4.8,
        lat: 12.9725,
        lng: 77.5955,
      },
    });

    // Generate JWT tokens
    dispatcherToken = jwt.sign(
      { sub: 'dispatcher-admin', role: 'dispatcher' },
      jwtSecret,
    );
    driver1Token = jwt.sign(
      { sub: 'driver-user-1', role: 'driver', driverId: testDriver1.id },
      jwtSecret,
    );
    driver2Token = jwt.sign(
      { sub: 'driver-user-2', role: 'driver', driverId: testDriver2.id },
      jwtSecret,
    );
  }, 40000);

  afterAll(async () => {
    if (dispatcherSocket?.connected) dispatcherSocket.disconnect();
    if (driver1Socket?.connected) driver1Socket.disconnect();
    if (driver2Socket?.connected) driver2Socket.disconnect();

    if (testDriver1?.id) {
      await prisma.driver.deleteMany({
        where: { id: { in: [testDriver1.id, testDriver2.id] } },
      });
    }

    if (app) {
      try {
        const cascade = app.get(OfferCascadeService, { strict: false });
        if (cascade) await cascade.onModuleDestroy();
        const worker = app.get(OfferWorker, { strict: false });
        if (worker) await worker.onModuleDestroy();
      } catch {
        // Ignore teardown errors
      }
      await app.close();
    }
  });

  // --------------------------------------------------------------------------
  // 1. WebSocket Authentication & Connection
  // --------------------------------------------------------------------------
  describe('Socket.IO JWT Authentication', () => {
    it('rejects connection without token', (done) => {
      const socket = io(baseUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      socket.on('disconnect', () => {
        socket.close();
        done();
      });

      socket.on('connect_error', () => {
        socket.close();
        done();
      });
    });

    it('connects dispatcher client and joins dispatchers room', (done) => {
      dispatcherSocket = io(baseUrl, {
        transports: ['websocket'],
        auth: { token: dispatcherToken },
      });

      dispatcherSocket.on('connect', () => {
        expect(dispatcherSocket.connected).toBe(true);
        done();
      });
    });

    it('connects driver clients and joins private driver rooms', (done) => {
      let connectedCount = 0;

      driver1Socket = io(baseUrl, {
        transports: ['websocket'],
        auth: { token: driver1Token },
      });

      driver2Socket = io(baseUrl, {
        transports: ['websocket'],
        auth: { token: driver2Token },
      });

      const checkBoth = () => {
        connectedCount++;
        if (connectedCount === 2) {
          expect(driver1Socket.connected).toBe(true);
          expect(driver2Socket.connected).toBe(true);
          done();
        }
      };

      driver1Socket.on('connect', checkBoth);
      driver2Socket.on('connect', checkBoth);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Offer Accept Path
  // --------------------------------------------------------------------------
  describe('Offer Accept Path', () => {
    let acceptRequestId: string;

    it('offers to Driver 1, Driver 1 accepts, emits request:assigned and cleans up Redis', async () => {
      // 1. Create a delivery request near Driver 1
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .send({
          pickupLat: 12.9716,
          pickupLng: 77.5946,
          dropLat: 12.9352,
          dropLng: 77.6245,
          priority: 1,
        })
        .expect(201);

      acceptRequestId = createRes.body.id;

      // 2. Setup socket listener on Driver 1 socket
      const offerPromise = new Promise<any>((resolve) => {
        driver1Socket.once('request:offered', (data) => {
          resolve(data);
        });
      });

      // 3. Start offer cascade
      await request(app.getHttpServer())
        .post(`/api/v1/offers/${acceptRequestId}/start`)
        .expect(200);

      // 4. Verify Driver 1 received the offer via socket
      const offerData = await offerPromise;
      expect(offerData.requestId).toBe(acceptRequestId);
      expect(offerData.driverId).toBe(testDriver1.id);
      expect(offerData.attempt).toBe(1);

      // 5. Setup listener for assignment event
      const assignPromise = new Promise<any>((resolve) => {
        dispatcherSocket.once('request:assigned', (data) => {
          resolve(data);
        });
      });

      // 6. Driver 1 accepts the offer
      const acceptRes = await request(app.getHttpServer())
        .post(`/api/v1/offers/${acceptRequestId}/accept`)
        .send({ driverId: testDriver1.id })
        .expect(200);

      expect(acceptRes.body.success).toBe(true);

      // 7. Verify assignment event received by dispatcher
      const assignData = await assignPromise;
      expect(assignData.requestId).toBe(acceptRequestId);
      expect(assignData.driverId).toBe(testDriver1.id);

      // 8. Verify Redis keys cleaned up
      const redisClient = redis.getClient();
      const activeOffer = await redisClient.get(`offer:active:${acceptRequestId}`);
      const driverActive = await redisClient.get(`driver:active_offer:${testDriver1.id}`);
      expect(activeOffer).toBeNull();
      expect(driverActive).toBeNull();

      // Reset driver 1 status back to available for subsequent tests
      await prisma.driver.update({
        where: { id: testDriver1.id },
        data: { status: DriverStatus.AVAILABLE, activeRequestId: null },
      });
    }, 30000);
  });

  // --------------------------------------------------------------------------
  // 3. Offer Reject & Cascade Path
  // --------------------------------------------------------------------------
  describe('Offer Reject & Cascade Path', () => {
    let rejectRequestId: string;

    it('Driver 1 rejects -> cascades to Driver 2 -> Driver 2 accepts', async () => {
      // 1. Create request
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .send({
          pickupLat: 12.9716,
          pickupLng: 77.5946,
          dropLat: 12.9279,
          dropLng: 77.6271,
          priority: 2,
        })
        .expect(201);

      rejectRequestId = createRes.body.id;

      // 2. Setup offer listener for Driver 1
      const offer1Promise = new Promise<any>((resolve) => {
        driver1Socket.once('request:offered', (data) => {
          resolve(data);
        });
      });

      // 3. Setup offer listener for Driver 2 (cascade target)
      const offer2Promise = new Promise<any>((resolve) => {
        driver2Socket.once('request:offered', (data) => {
          resolve(data);
        });
      });

      // 4. Start cascade
      await request(app.getHttpServer())
        .post(`/api/v1/offers/${rejectRequestId}/start`)
        .expect(200);

      await offer1Promise;

      // 5. Driver 1 rejects
      await request(app.getHttpServer())
        .post(`/api/v1/offers/${rejectRequestId}/reject`)
        .send({ driverId: testDriver1.id, reason: 'Too busy' })
        .expect(200);

      // 6. Driver 2 receives cascaded offer
      const offer2Data = await offer2Promise;
      expect(offer2Data.requestId).toBe(rejectRequestId);
      expect(offer2Data.driverId).toBe(testDriver2.id);
      expect(offer2Data.attempt).toBe(2);

      // 7. Driver 2 accepts
      await request(app.getHttpServer())
        .post(`/api/v1/offers/${rejectRequestId}/accept`)
        .send({ driverId: testDriver2.id })
        .expect(200);

      // 8. Verify Redis keys cleaned up
      const redisClient = redis.getClient();
      const activeOffer = await redisClient.get(`offer:active:${rejectRequestId}`);
      expect(activeOffer).toBeNull();

      // Reset driver 2 status
      await prisma.driver.update({
        where: { id: testDriver2.id },
        data: { status: DriverStatus.AVAILABLE, activeRequestId: null },
      });
    }, 30000);
  });

  // --------------------------------------------------------------------------
  // 4. Driver Disconnect Path
  // --------------------------------------------------------------------------
  describe('Driver Disconnect Path', () => {
    let disconnectRequestId: string;

    it('Driver 1 disconnects with pending offer -> treated as rejection and cascades to Driver 2', async () => {
      // 1. Create request
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/requests')
        .send({
          pickupLat: 12.9716,
          pickupLng: 77.5946,
          dropLat: 12.9279,
          dropLng: 77.6271,
          priority: 2,
        })
        .expect(201);

      disconnectRequestId = createRes.body.id;

      // Setup offer listener on Driver 2
      const cascadeToDriver2Promise = new Promise<any>((resolve) => {
        driver2Socket.once('request:offered', (data) => {
          resolve(data);
        });
      });

      // Start cascade
      await request(app.getHttpServer())
        .post(`/api/v1/offers/${disconnectRequestId}/start`)
        .expect(200);

      // Wait 500ms for offer state to settle
      await new Promise((r) => setTimeout(r, 500));

      // Disconnect Driver 1 socket unexpectedly!
      driver1Socket.disconnect();

      // Driver 2 should receive the cascaded offer!
      const cascadeData = await cascadeToDriver2Promise;
      expect(cascadeData.requestId).toBe(disconnectRequestId);
      expect(cascadeData.driverId).toBe(testDriver2.id);

      // Clean up request
      await prisma.deliveryRequest.update({
        where: { id: disconnectRequestId },
        data: { status: RequestStatus.CANCELLED },
      });

      const redisClient = redis.getClient();
      await redisClient.del(`offer:active:${disconnectRequestId}`);
      await redisClient.del(`offer:rejected:${disconnectRequestId}`);
    }, 30000);
  });
});
