import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.validation';
import { DriversModule } from './modules/drivers/drivers.module';
import { HealthModule } from './modules/health/health.module';
import { RequestsModule } from './modules/requests/requests.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SimulatorModule } from './modules/simulator/simulator.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                },
              }
            : undefined,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
      },
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    HealthModule,
    DriversModule,
    RequestsModule,
    DispatchModule,
    RealtimeModule,
    SimulatorModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
