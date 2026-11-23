import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DriverOwnershipGuard } from '../../common/guards/driver-ownership.guard';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { QueryDriversDto } from './dto/query-drivers.dto';
import { QueryNearbyDriversDto } from './dto/query-nearby-drivers.dto';
import { UpdateDriverLocationDto } from './dto/update-driver-location.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';

@ApiTags('drivers')
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new driver' })
  @ApiResponse({ status: 201, description: 'Driver created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  create(@Body() dto: CreateDriverDto) {
    return this.driversService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List drivers with optional pagination and status filter' })
  @ApiResponse({ status: 200, description: 'List of drivers' })
  findAll(@Query() query: QueryDriversDto) {
    return this.driversService.findAll(query);
  }

  @Get('nearby')
  @ApiOperation({
    summary: 'Find nearby available drivers using Redis GEO with PostGIS fallback',
  })
  @ApiResponse({ status: 200, description: 'Nearby available drivers ranked by distance' })
  @ApiResponse({ status: 400, description: 'Invalid coordinate parameters' })
  findNearby(@Query() query: QueryNearbyDriversDto) {
    return this.driversService.findNearby(
      query.lat,
      query.lng,
      query.radiusKm,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get driver details by ID' })
  @ApiParam({ name: 'id', description: 'Driver UUID' })
  @ApiResponse({ status: 200, description: 'Driver details' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.driversService.findOne(id);
  }

  @UseGuards(DriverOwnershipGuard)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update driver operational status (available/busy/offline)' })
  @ApiParam({ name: 'id', description: 'Driver UUID' })
  @ApiResponse({ status: 200, description: 'Driver status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status enum' })
  @ApiResponse({ status: 403, description: 'Forbidden: Driver ownership mismatch' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverStatusDto,
  ) {
    return this.driversService.updateStatus(id, dto.status);
  }

  @UseGuards(DriverOwnershipGuard)
  @Post(':id/location')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update driver real-time GPS location (hot path via Redis GEO)',
  })
  @ApiParam({ name: 'id', description: 'Driver UUID' })
  @ApiResponse({ status: 200, description: 'Location update acknowledged' })
  @ApiResponse({ status: 400, description: 'Invalid coordinate inputs or anti-spoofing velocity violation' })
  @ApiResponse({ status: 403, description: 'Forbidden: Driver ownership mismatch' })
  updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverLocationDto,
  ) {
    return this.driversService.updateLocation(id, dto);
  }
}
