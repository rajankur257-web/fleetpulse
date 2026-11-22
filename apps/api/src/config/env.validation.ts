import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = 'http://localhost:3000,http://localhost:8081';

  @IsString()
  @IsOptional()
  DISPATCH_STRATEGY: string = 'scored';

  @IsNumber()
  @Min(5)
  @IsOptional()
  OFFER_TIMEOUT_SECONDS: number = 20;

  @IsNumber()
  @Min(1)
  @IsOptional()
  MAX_OFFER_ATTEMPTS: number = 3;

  @IsNumber()
  @Min(1)
  @IsOptional()
  BATCH_WINDOW_SECONDS: number = 5;

  @IsString()
  @IsOptional()
  OSRM_URL: string = 'http://router.project-osrm.org';
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.toString()}`);
  }
  return validatedConfig;
}
