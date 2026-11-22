import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsGateway } from './events.gateway';
import { OfferCascadeService } from './cascade/offer-cascade.service';
import { OfferWorker } from './cascade/offer.worker';
import { OffersController } from './cascade/offers.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    forwardRef(() => DispatchModule),
  ],
  controllers: [OffersController],
  providers: [
    EventsGateway,
    OfferCascadeService,
    OfferWorker,
  ],
  exports: [EventsGateway, OfferCascadeService],
})
export class RealtimeModule {}
