import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  getLive() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReady() {
    let dbStatus = 'disconnected';
    let redisStatus = 'disconnected';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    try {
      const ping = await this.redis.ping();
      if (ping === 'PONG') {
        redisStatus = 'connected';
      }
    } catch {
      redisStatus = 'error';
    }

    const isHealthy = dbStatus === 'connected' && redisStatus === 'connected';

    const result = {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      redis: redisStatus,
    };

    if (!isHealthy) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
