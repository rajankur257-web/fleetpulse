import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';
import { StrategyRegistry } from './strategies/strategy.registry';
import { NearestDriverStrategy } from './strategies/nearest-driver.strategy';
import { ScoredStrategy } from './strategies/scored.strategy';
import { BatchStrategy } from './strategies/batch.strategy';

@Module({
  imports: [ConfigModule],
  controllers: [DispatchController],
  providers: [
    NearestDriverStrategy,
    ScoredStrategy,
    BatchStrategy,
    StrategyRegistry,
    DispatchService,
  ],
  exports: [
    DispatchService,
    StrategyRegistry,
    NearestDriverStrategy,
    ScoredStrategy,
    BatchStrategy,
  ],
})
export class DispatchModule {}
