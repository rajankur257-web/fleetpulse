import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class StartSimulatorDto {
  @ApiPropertyOptional({
    description: 'Number of simulated driver agents (default: 100)',
    default: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  driverCount?: number = 100;

  @ApiPropertyOptional({
    description: 'Simulation speed multiplier between 1x and 20x (default: 1)',
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  speedMultiplier?: number = 1;

  @ApiPropertyOptional({
    description: 'Delivery request generation rate per minute (default: 10, 0 to disable)',
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  requestRatePerMinute?: number = 10;

  @ApiPropertyOptional({
    description: 'Driver acceptance probability between 0.0 and 1.0 (default: 0.8)',
    default: 0.8,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  acceptProbability?: number = 0.8;

  @ApiPropertyOptional({
    description: 'Optional PRNG seed for deterministic and reproducible simulation',
    default: 42,
  })
  @IsOptional()
  @IsInt()
  seed?: number = 42;

  @ApiPropertyOptional({
    description: 'Optional duration in seconds to automatically stop the simulation',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  durationSeconds?: number;
}
