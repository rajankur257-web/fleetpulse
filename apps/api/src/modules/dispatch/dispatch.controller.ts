import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { StrategyRegistry } from './strategies/strategy.registry';
import { SetStrategyDto } from './dto/set-strategy.dto';
import { BatchDispatchDto } from './dto/batch-dispatch.dto';

@ApiTags('dispatch')
@Controller('dispatch')
export class DispatchController {
  constructor(
    private readonly dispatchService: DispatchService,
    private readonly registry: StrategyRegistry,
  ) {}

  @Post('match/:requestId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Match and assign a single delivery request' })
  @ApiResponse({ status: 200, description: 'Assignment result (or null if no candidate found)' })
  @ApiResponse({ status: 404, description: 'Delivery request not found' })
  @ApiResponse({ status: 400, description: 'Delivery request not in pending/offered state' })
  async matchRequest(@Param('requestId', ParseUUIDPipe) requestId: string) {
    const result = await this.dispatchService.matchRequest(requestId);
    return {
      success: !!result,
      assignment: result,
    };
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch dispatch all pending requests or specified list' })
  @ApiResponse({ status: 200, description: 'List of successful assignments' })
  async batchDispatch(@Body() body: BatchDispatchDto) {
    const assignments = await this.dispatchService.batchMatch(
      body.requestIds,
      body.strategy,
    );
    return {
      matchedCount: assignments.length,
      assignments,
    };
  }

  @Get('strategies')
  @ApiOperation({ summary: 'Get all dispatch strategies and the currently active strategy' })
  getStrategies() {
    return {
      activeStrategy: this.registry.getActiveStrategyType(),
      strategies: this.registry.getAllStrategyTypes(),
    };
  }

  @Post('strategy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the active dispatch strategy' })
  setStrategy(@Body() body: SetStrategyDto) {
    this.registry.setActiveStrategyType(body.strategy);
    return {
      success: true,
      activeStrategy: this.registry.getActiveStrategyType(),
    };
  }
}
