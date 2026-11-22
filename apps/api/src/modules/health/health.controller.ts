import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness health check endpoint' })
  @ApiResponse({ status: 200, description: 'Application is running' })
  getLive() {
    return this.healthService.getLive();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness health check verifying PostgreSQL and Redis',
  })
  @ApiResponse({
    status: 200,
    description: 'PostgreSQL and Redis are both connected and ready',
  })
  @ApiResponse({
    status: 503,
    description: 'One or more backing services are unavailable',
  })
  getReady() {
    return this.healthService.getReady();
  }
}
