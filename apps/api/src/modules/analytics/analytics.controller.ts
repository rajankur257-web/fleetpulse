import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AlgorithmComparisonResponse,
  AnalyticsSummary,
  DeadZoneAlert,
  EtaComparisonResult,
  HeatmapPoint,
  PulseScoreResult,
  RepositioningHint,
} from '@fleet-pulse/shared';
import { AnalyticsService } from './analytics.service';
import { ComparisonService } from './comparison.service';
import { OsrmService } from './osrm.service';
import { CompareQueryDto } from './dto/compare-query.dto';
import { CompareEtaDto } from './dto/eta-query.dto';

@ApiTags('Analytics & Algorithm Comparison')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly comparisonService: ComparisonService,
    private readonly osrmService: OsrmService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get fleet KPI summary metrics' })
  async getSummary(): Promise<AnalyticsSummary> {
    return this.analyticsService.getSummary();
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Get demand heatmap points' })
  async getHeatmap(): Promise<HeatmapPoint[]> {
    return this.analyticsService.getHeatmap();
  }

  @Get('repositioning')
  @ApiOperation({ summary: 'Get idle-driver repositioning hints' })
  async getRepositioningHints(): Promise<RepositioningHint[]> {
    return this.analyticsService.getRepositioningHints();
  }

  @Get('dead-zones')
  @ApiOperation({ summary: 'Get dead-zone alerts for unassigned requests exceeding wait threshold' })
  async getDeadZones(
    @Query('thresholdSeconds') thresholdSeconds?: number,
  ): Promise<DeadZoneAlert[]> {
    return this.analyticsService.getDeadZones(thresholdSeconds ? Number(thresholdSeconds) : 120);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Run deterministic algorithm comparison replay (GET)' })
  async compareGet(@Query() query: CompareQueryDto): Promise<AlgorithmComparisonResponse> {
    return this.comparisonService.runComparison(query);
  }

  @Post('compare')
  @ApiOperation({ summary: 'Run deterministic algorithm comparison replay (POST)' })
  async comparePost(@Body() body: CompareQueryDto): Promise<AlgorithmComparisonResponse> {
    return this.comparisonService.runComparison(body);
  }

  @Post('eta/compare')
  @ApiOperation({ summary: 'Compare Haversine distance & ETA against OSRM road-network route' })
  async compareEta(@Body() dto: CompareEtaDto): Promise<EtaComparisonResult> {
    return this.osrmService.compareEta(
      { lat: Number(dto.originLat), lng: Number(dto.originLng) },
      { lat: Number(dto.destLat), lng: Number(dto.destLng) },
    );
  }

  @Get('pulse-scores')
  @ApiOperation({ summary: 'Get Pulse Scores for all drivers' })
  async getPulseScores(): Promise<PulseScoreResult[]> {
    return this.analyticsService.getPulseScores();
  }

  @Get('pulse-scores/:id')
  @ApiOperation({ summary: 'Get Pulse Score for a single driver' })
  async getDriverPulseScore(@Param('id') id: string): Promise<PulseScoreResult> {
    return this.analyticsService.getDriverPulseScore(id);
  }
}
