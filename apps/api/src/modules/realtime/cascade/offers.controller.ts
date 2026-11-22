import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { OfferCascadeService } from './offer-cascade.service';

export class AcceptOfferDto {
  @ApiProperty({ description: 'Driver ID accepting the offer' })
  @IsUUID()
  driverId!: string;
}

export class RejectOfferDto {
  @ApiProperty({ description: 'Driver ID rejecting the offer' })
  @IsUUID()
  driverId!: string;

  @ApiPropertyOptional({ description: 'Reason for rejection' })
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offerCascadeService: OfferCascadeService) {}

  @Post(':requestId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start offer cascade workflow for a delivery request' })
  @ApiResponse({ status: 200, description: 'Offer cascade initiated' })
  async startCascade(@Param('requestId', ParseUUIDPipe) requestId: string) {
    const started = await this.offerCascadeService.startCascade(requestId);
    return {
      success: started,
      requestId,
    };
  }

  @Post(':requestId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver accepts an active delivery request offer' })
  @ApiResponse({ status: 200, description: 'Offer accepted and driver assigned' })
  @ApiResponse({ status: 400, description: 'Offer expired or invalid driver' })
  async acceptOffer(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() body: AcceptOfferDto,
  ) {
    const accepted = await this.offerCascadeService.acceptOffer(
      requestId,
      body.driverId,
    );
    return {
      success: accepted,
      requestId,
      driverId: body.driverId,
    };
  }

  @Post(':requestId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver rejects an active delivery request offer' })
  @ApiResponse({ status: 200, description: 'Offer rejected, cascading to next driver' })
  async rejectOffer(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() body: RejectOfferDto,
  ) {
    const cascaded = await this.offerCascadeService.rejectOffer(
      requestId,
      body.driverId,
      body.reason,
    );
    return {
      success: cascaded,
      requestId,
      driverId: body.driverId,
    };
  }
}
