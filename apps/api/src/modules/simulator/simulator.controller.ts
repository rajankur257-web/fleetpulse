import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SimulatorService } from './simulator.service';
import { StartSimulatorDto } from './dto/start-simulator.dto';

@ApiTags('simulator')
@Controller('sim')
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start fleet simulation with configurable drivers and speed' })
  @ApiResponse({ status: 200, description: 'Simulation started' })
  async start(@Body() dto: StartSimulatorDto) {
    const stats = await this.simulatorService.start(dto);
    return {
      message: 'Fleet simulation started',
      stats,
    };
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop active fleet simulation' })
  @ApiResponse({ status: 200, description: 'Simulation stopped' })
  async stop() {
    const stats = await this.simulatorService.stop();
    return {
      message: 'Fleet simulation stopped',
      stats,
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current simulation status, progress, and double assignment audit' })
  getStatus() {
    return this.simulatorService.getStatus();
  }
}
