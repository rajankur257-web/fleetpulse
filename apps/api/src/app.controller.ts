import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request, Response } from 'express';

@Controller()
export class AppController {
  @Get()
  @ApiExcludeEndpoint()
  getRoot(@Req() req: Request, @Res() res: Response) {
    const accepts = req.headers.accept || '';
    if (accepts.includes('text/html')) {
      return res.redirect('/docs');
    }

    return res.json({
      service: 'Fleet Pulse API',
      status: 'online',
      version: '1.0.0',
      documentation: '/docs',
      health: {
        live: '/api/v1/health/live',
        ready: '/api/v1/health/ready',
      },
      message:
        'Fleet Pulse backend API is running. The web dispatcher dashboard is hosted separately.',
    });
  }
}
