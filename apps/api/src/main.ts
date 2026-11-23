import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use structured Pino logger
  app.useLogger(app.get(Logger));

  // Security headers
  app.use(helmet());

  // Request body size limits (OWASP API4 mitigation)
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ limit: '1mb', extended: true }));

  // Enable graceful shutdown hooks for SIGTERM / SIGINT
  app.enableShutdownHooks();

  // CORS configuration
  const corsOriginsEnv = process.env.CORS_ORIGINS;
  const corsOrigins = corsOriginsEnv === '*'
    ? '*'
    : corsOriginsEnv
      ? corsOriginsEnv.split(',').map((o) => o.trim())
      : ['http://localhost:3000', 'http://localhost:8081'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Global REST prefix
  app.setGlobalPrefix('api/v1');

  // Global DTO input validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fleet Pulse API')
    .setDescription(
      'Real-time delivery dispatch platform REST endpoints for drivers, delivery requests, and live operations.',
    )
    .setVersion('1.0')
    .addTag('health', 'Liveness and readiness probes')
    .addTag('drivers', 'Driver management, real-time location updates, and nearby driver search')
    .addTag('requests', 'Delivery request lifecycle management')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
  SwaggerModule.setup('api/v1/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`================================================================`);
  logger.log(`🚀 Fleet Pulse API running at http://localhost:${port}/api/v1`);
  logger.log(`📖 Swagger API Docs at http://localhost:${port}/docs`);
  logger.log(`================================================================`);
}

bootstrap();
