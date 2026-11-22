import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DispatchStrategy, DispatchStrategyType } from '@fleet-pulse/shared';
import { NearestDriverStrategy } from './nearest-driver.strategy';
import { ScoredStrategy } from './scored.strategy';
import { BatchStrategy } from './batch.strategy';

@Injectable()
export class StrategyRegistry {
  private readonly logger = new Logger(StrategyRegistry.name);
  private readonly strategies = new Map<DispatchStrategyType, DispatchStrategy>();
  private activeStrategyType: DispatchStrategyType = DispatchStrategyType.NEAREST;

  constructor(
    nearestStrategy: NearestDriverStrategy,
    scoredStrategy: ScoredStrategy,
    batchStrategy: BatchStrategy,
    private readonly configService?: ConfigService,
  ) {
    this.register(nearestStrategy);
    this.register(scoredStrategy);
    this.register(batchStrategy);

    const configured = this.configService?.get<string>('DISPATCH_STRATEGY');
    if (configured && Object.values(DispatchStrategyType).includes(configured as DispatchStrategyType)) {
      this.activeStrategyType = configured as DispatchStrategyType;
    }
    this.logger.log(`Active dispatch strategy initialized to: ${this.activeStrategyType}`);
  }

  register(strategy: DispatchStrategy) {
    this.strategies.set(strategy.name, strategy);
  }

  get(name: DispatchStrategyType): DispatchStrategy {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Dispatch strategy '${name}' not found`);
    }
    return strategy;
  }

  getActiveStrategy(): DispatchStrategy {
    return this.get(this.activeStrategyType);
  }

  getActiveStrategyType(): DispatchStrategyType {
    return this.activeStrategyType;
  }

  setActiveStrategyType(type: DispatchStrategyType): void {
    if (!this.strategies.has(type)) {
      throw new Error(`Cannot set unknown dispatch strategy '${type}'`);
    }
    this.activeStrategyType = type;
    this.logger.log(`Active dispatch strategy switched to: ${type}`);
  }

  getAllStrategyTypes(): DispatchStrategyType[] {
    return Array.from(this.strategies.keys());
  }
}
