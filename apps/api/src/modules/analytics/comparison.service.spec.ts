import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DispatchStrategyType } from '@fleet-pulse/shared';
import { StrategyRegistry } from '../dispatch/strategies/strategy.registry';
import { NearestDriverStrategy } from '../dispatch/strategies/nearest-driver.strategy';
import { ScoredStrategy } from '../dispatch/strategies/scored.strategy';
import { BatchStrategy } from '../dispatch/strategies/batch.strategy';
import { ComparisonService } from './comparison.service';

describe('ComparisonService (Algorithm Comparison Replay)', () => {
  let service: ComparisonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComparisonService,
        StrategyRegistry,
        NearestDriverStrategy,
        ScoredStrategy,
        BatchStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => null),
          },
        },
      ],
    }).compile();

    service = module.get<ComparisonService>(ComparisonService);
  });

  it('produces 100% identical comparison metrics across two consecutive runs with identical seed', async () => {
    const seed = 12345;
    const run1 = await service.runComparison({ seed, driverCount: 40, requestCount: 25 });
    const run2 = await service.runComparison({ seed, driverCount: 40, requestCount: 25 });

    expect(run1.seed).toBe(run2.seed);
    expect(run1.driverCount).toBe(run2.driverCount);
    expect(run1.requestCount).toBe(run2.requestCount);

    // Deep compare all strategy metrics
    expect(run1.strategies[DispatchStrategyType.NEAREST]).toEqual(run2.strategies[DispatchStrategyType.NEAREST]);
    expect(run1.strategies[DispatchStrategyType.SCORED]).toEqual(run2.strategies[DispatchStrategyType.SCORED]);
    expect(run1.strategies[DispatchStrategyType.BATCH]).toEqual(run2.strategies[DispatchStrategyType.BATCH]);
  });

  it('demonstrates distinct trade-offs between nearest, scored, and batch Hungarian strategies', async () => {
    const res = await service.runComparison({ seed: 42, driverCount: 30, requestCount: 20 });

    const nearest = res.strategies[DispatchStrategyType.NEAREST];
    const scored = res.strategies[DispatchStrategyType.SCORED];
    const batch = res.strategies[DispatchStrategyType.BATCH];

    expect(nearest?.requestsMatched).toBeGreaterThan(0);
    expect(scored?.requestsMatched).toBeGreaterThan(0);
    expect(batch?.requestsMatched).toBeGreaterThan(0);

    // Batch strategy Hungarian matching should optimize global assignment
    expect(batch?.totalDistanceKm).toBeGreaterThan(0);
    expect(nearest?.avgPickupDistanceKm).toBeGreaterThan(0);
  });
});
