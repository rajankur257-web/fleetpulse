import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ComparisonService } from './comparison.service';
import { OsrmService } from './osrm.service';
import { PulseScoreService } from './pulse-score.service';
import { RepositioningService } from './repositioning.service';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [ConfigModule, DispatchModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    ComparisonService,
    OsrmService,
    PulseScoreService,
    RepositioningService,
  ],
  exports: [
    AnalyticsService,
    ComparisonService,
    OsrmService,
    PulseScoreService,
    RepositioningService,
  ],
})
export class AnalyticsModule {}
