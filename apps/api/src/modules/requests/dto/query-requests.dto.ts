import { ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryRequestsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RequestStatus, description: 'Filter by request status' })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
}
