import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  DispatchEventType,
  DriverStatus,
  RequestStatus,
  haversineKm,
} from '@fleet-pulse/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { EventsGateway } from '../events.gateway';

export interface ActiveOfferPayload {
  requestId: string;
  driverId: string;
  attempt: number;
  timeoutSeconds: number;
  expiresAt: string;
}

@Injectable()
export class OfferCascadeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfferCascadeService.name);
  private offerQueue!: Queue;
  private offerTimeoutSeconds = 20;
  private maxAttempts = 3;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {}

  async onModuleInit() {
    this.offerTimeoutSeconds =
      this.configService.get<number>('OFFER_TIMEOUT_SECONDS') || 20;
    this.maxAttempts =
      this.configService.get<number>('MAX_OFFER_ATTEMPTS') || 3;

    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    const parsed = new URL(redisUrl);
    const connection = {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password || undefined,
      username: parsed.username && parsed.username !== 'default' ? parsed.username : undefined,
      maxRetriesPerRequest: null,
    };

    this.offerQueue = new Queue('offers', { connection });
    this.offerQueue.on('error', (err) => {
      this.logger.debug(`Offer queue redis connection event: ${err.message}`);
    });
    this.logger.log(
      `OfferCascadeService initialized (timeout=${this.offerTimeoutSeconds}s, maxAttempts=${this.maxAttempts})`,
    );
  }

  async onModuleDestroy() {
    if (this.offerQueue) {
      await this.offerQueue.close();
    }
  }

  getQueue(): Queue {
    return this.offerQueue;
  }

  /**
   * Starts or cascades an offer for a delivery request
   */
  async startCascade(requestId: string, attempt = 1): Promise<boolean> {
    const request = await this.prisma.deliveryRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Delivery request ${requestId} not found`);
    }

    if (
      request.status !== RequestStatus.PENDING &&
      request.status !== RequestStatus.OFFERED
    ) {
      this.logger.warn(
        `Request ${requestId} status is '${request.status}', aborting cascade`,
      );
      return false;
    }

    const redisClient = this.redis.getClient();

    // 1. Check max attempts exceeded
    if (attempt > this.maxAttempts) {
      this.logger.warn(
        `Request ${requestId} exceeded max offer attempts (${this.maxAttempts}). Expiring request.`,
      );
      await this.expireRequest(requestId, 'Max offer attempts exceeded');
      return false;
    }

    // 2. Fetch rejected driver IDs for this request
    const rejectedKey = `offer:rejected:${requestId}`;
    const rejectedDrivers = await redisClient.smembers(rejectedKey);

    // 3. Find candidate drivers
    const availableDrivers = await this.prisma.driver.findMany({
      where: {
        status: DriverStatus.AVAILABLE,
        id: { notIn: rejectedDrivers },
      },
    });

    if (availableDrivers.length === 0) {
      this.logger.warn(`No available candidate drivers for request ${requestId}. Expiring.`);
      await this.expireRequest(requestId, 'No available drivers found');
      return false;
    }

    // Sort available drivers by distance to pickup
    const reqCoord = { lat: request.pickupLat, lng: request.pickupLng };
    availableDrivers.sort((a, b) => {
      const distA = haversineKm(reqCoord, { lat: a.lat, lng: a.lng });
      const distB = haversineKm(reqCoord, { lat: b.lat, lng: b.lng });
      return distA - distB;
    });

    const bestDriver = availableDrivers[0];
    if (!bestDriver) {
      await this.expireRequest(requestId, 'No suitable driver');
      return false;
    }

    // 4. Update request status to OFFERED
    await this.prisma.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.OFFERED,
        offeredAt: new Date(),
      },
    });

    const expiresAt = new Date(
      Date.now() + this.offerTimeoutSeconds * 1000,
    ).toISOString();

    const offerPayload: ActiveOfferPayload = {
      requestId,
      driverId: bestDriver.id,
      attempt,
      timeoutSeconds: this.offerTimeoutSeconds,
      expiresAt,
    };

    // 5. Store active offer state in Redis
    const activeKey = `offer:active:${requestId}`;
    const driverActiveKey = `driver:active_offer:${bestDriver.id}`;
    const ttlSeconds = this.offerTimeoutSeconds + 60;

    await redisClient.set(activeKey, JSON.stringify(offerPayload), 'EX', ttlSeconds);
    await redisClient.set(driverActiveKey, requestId, 'EX', ttlSeconds);

    // 6. Schedule BullMQ delayed timeout job
    const jobId = `offer:${requestId}:${attempt}`;
    await this.offerQueue.add(
      'offer-timeout',
      { requestId, driverId: bestDriver.id, attempt },
      {
        delay: this.offerTimeoutSeconds * 1000,
        jobId,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    // 7. Record DispatchEvent
    await this.prisma.dispatchEvent.create({
      data: {
        requestId,
        driverId: bestDriver.id,
        type: DispatchEventType.REQUEST_OFFERED,
        payload: {
          attempt,
          timeoutSeconds: this.offerTimeoutSeconds,
          expiresAt,
        },
      },
    });

    // 8. Emit Socket.IO events to driver and dispatchers
    this.eventsGateway.emitRequestOffered(bestDriver.id, {
      requestId,
      driverId: bestDriver.id,
      attempt,
      timeoutSeconds: this.offerTimeoutSeconds,
      expiresAt,
    });

    this.logger.log(
      `Offered request ${requestId} to driver ${bestDriver.id} (Attempt ${attempt}/${this.maxAttempts})`,
    );

    return true;
  }

  /**
   * Driver accepts the active offer
   */
  async acceptOffer(requestId: string, driverId: string): Promise<boolean> {
    const redisClient = this.redis.getClient();
    const activeKey = `offer:active:${requestId}`;
    const activeOfferRaw = await redisClient.get(activeKey);

    if (!activeOfferRaw) {
      throw new BadRequestException('No active offer found for this request or offer has expired');
    }

    const offerData = JSON.parse(activeOfferRaw) as ActiveOfferPayload;
    if (offerData.driverId !== driverId) {
      throw new BadRequestException('Offer was not extended to this driver');
    }

    // 1. Cancel the BullMQ delayed timeout job
    const jobId = `offer:${requestId}:${offerData.attempt}`;
    try {
      const job = await this.offerQueue.getJob(jobId);
      if (job) {
        await job.remove();
      }
    } catch (err) {
      this.logger.warn(`Failed to remove BullMQ job ${jobId}: ${err}`);
    }

    // 2. Atomically assign driver in PostgreSQL
    const driverUpdate = await this.prisma.driver.updateMany({
      where: {
        id: driverId,
        status: DriverStatus.AVAILABLE,
      },
      data: {
        status: DriverStatus.BUSY,
        activeRequestId: requestId,
      },
    });

    if (driverUpdate.count === 0) {
      throw new BadRequestException('Driver is no longer available to accept');
    }

    // 3. Update DeliveryRequest to ASSIGNED
    const assignedAt = new Date();
    await this.prisma.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.ASSIGNED,
        assignedDriverId: driverId,
        assignedAt,
      },
    });

    // 4. Record DispatchEvent
    await this.prisma.dispatchEvent.create({
      data: {
        requestId,
        driverId,
        type: DispatchEventType.REQUEST_ASSIGNED,
        payload: {
          acceptedByDriver: driverId,
          attempt: offerData.attempt,
          assignedAt: assignedAt.toISOString(),
        },
      },
    });

    // 5. Clean up Redis keys
    await redisClient.del(activeKey);
    await redisClient.del(`driver:active_offer:${driverId}`);
    await redisClient.del(`offer:rejected:${requestId}`);

    // 6. Broadcast event
    this.eventsGateway.broadcastRequestAssigned({
      requestId,
      driverId,
      assignedAt,
    });

    this.logger.log(`Request ${requestId} accepted by driver ${driverId}`);
    return true;
  }

  /**
   * Driver rejects the active offer or disconnects
   */
  async rejectOffer(requestId: string, driverId: string, reason?: string): Promise<boolean> {
    const redisClient = this.redis.getClient();
    const activeKey = `offer:active:${requestId}`;
    const activeOfferRaw = await redisClient.get(activeKey);

    let attempt = 1;
    if (activeOfferRaw) {
      const offerData = JSON.parse(activeOfferRaw) as ActiveOfferPayload;
      attempt = offerData.attempt;

      // Cancel the BullMQ delayed timeout job
      const jobId = `offer:${requestId}:${attempt}`;
      try {
        const job = await this.offerQueue.getJob(jobId);
        if (job) {
          await job.remove();
        }
      } catch (err) {
        this.logger.warn(`Failed to remove BullMQ job ${jobId}: ${err}`);
      }
    }

    // Clean up active keys for this driver
    await redisClient.del(activeKey);
    await redisClient.del(`driver:active_offer:${driverId}`);

    // Record rejection
    const rejectedKey = `offer:rejected:${requestId}`;
    await redisClient.sadd(rejectedKey, driverId);

    this.logger.log(
      `Request ${requestId} rejected by driver ${driverId} (reason: ${reason || 'rejected'}). Triggering cascade...`,
    );

    // Cascade to next best driver
    return this.startCascade(requestId, attempt + 1);
  }

  /**
   * BullMQ worker timeout handler
   */
  async handleTimeout(requestId: string, driverId: string, attempt: number): Promise<void> {
    const redisClient = this.redis.getClient();
    const activeKey = `offer:active:${requestId}`;
    const activeOfferRaw = await redisClient.get(activeKey);

    if (!activeOfferRaw) {
      return; // Already accepted or rejected
    }

    const offerData = JSON.parse(activeOfferRaw) as ActiveOfferPayload;
    if (offerData.driverId === driverId && offerData.attempt === attempt) {
      this.logger.warn(
        `Offer for request ${requestId} timed out after ${this.offerTimeoutSeconds}s for driver ${driverId}`,
      );
      await this.rejectOffer(requestId, driverId, 'Timeout');
    }
  }

  /**
   * Handles unexpected driver disconnect
   */
  async handleDriverDisconnect(driverId: string): Promise<void> {
    const redisClient = this.redis.getClient();
    const driverActiveKey = `driver:active_offer:${driverId}`;
    const activeRequestId = await redisClient.get(driverActiveKey);

    if (activeRequestId) {
      this.logger.warn(
        `Driver ${driverId} disconnected with pending offer for request ${activeRequestId}. Treating as rejection.`,
      );
      await this.rejectOffer(activeRequestId, driverId, 'Driver disconnected');
    }
  }

  /**
   * Expires the delivery request and cleans up
   */
  private async expireRequest(requestId: string, reason: string): Promise<void> {
    await this.prisma.deliveryRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.EXPIRED,
      },
    });

    await this.prisma.dispatchEvent.create({
      data: {
        requestId,
        type: DispatchEventType.REQUEST_EXPIRED,
        payload: { reason },
      },
    });

    const redisClient = this.redis.getClient();
    await redisClient.del(`offer:active:${requestId}`);
    await redisClient.del(`offer:rejected:${requestId}`);

    this.eventsGateway.broadcastRequestExpired({
      requestId,
      reason,
    });

    this.logger.log(`Request ${requestId} expired: ${reason}`);
  }
}
