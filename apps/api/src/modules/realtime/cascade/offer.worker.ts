import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { OfferCascadeService } from './offer-cascade.service';

export interface OfferJobData {
  requestId: string;
  driverId: string;
  attempt: number;
}

@Injectable()
export class OfferWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfferWorker.name);
  private worker!: Worker<OfferJobData>;

  constructor(
    private readonly configService: ConfigService,
    private readonly offerCascadeService: OfferCascadeService,
  ) {}

  async onModuleInit() {
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

    this.worker = new Worker<OfferJobData>(
      'offers',
      async (job: Job<OfferJobData>) => {
        if (job.name === 'offer-timeout') {
          this.logger.log(
            `Processing offer timeout job ${job.id} for request ${job.data.requestId}, driver ${job.data.driverId}`,
          );
          await this.offerCascadeService.handleTimeout(
            job.data.requestId,
            job.data.driverId,
            job.data.attempt,
          );
        }
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Offer job ${job?.id} failed: ${err.message}`);
    });

    this.worker.on('error', (err) => {
      this.logger.debug(`Offer worker redis connection event: ${err.message}`);
    });

    this.logger.log('OfferWorker initialized and listening on queue "offers"');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
