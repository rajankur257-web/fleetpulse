import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateRequestDto } from './dto/create-request.dto';
import { QueryRequestsDto } from './dto/query-requests.dto';
import { RequestsService } from './requests.service';

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new delivery request' })
  @ApiResponse({ status: 201, description: 'Delivery request created' })
  @ApiResponse({ status: 400, description: 'Invalid coordinate or priority input' })
  create(@Body() dto: CreateRequestDto) {
    return this.requestsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List delivery requests with optional pagination and status filter',
  })
  @ApiResponse({ status: 200, description: 'List of requests' })
  findAll(@Query() query: QueryRequestsDto) {
    return this.requestsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get delivery request details by ID' })
  @ApiParam({ name: 'id', description: 'Request UUID' })
  @ApiResponse({ status: 200, description: 'Request details' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.requestsService.findOne(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an active delivery request' })
  @ApiParam({ name: 'id', description: 'Request UUID' })
  @ApiResponse({ status: 200, description: 'Request cancelled' })
  @ApiResponse({ status: 400, description: 'Request already completed/cancelled' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.requestsService.cancel(id);
  }
}
