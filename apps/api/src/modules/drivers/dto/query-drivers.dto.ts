import { ApiPropertyOptional } from '@nestjs/swagger';
import { DriverStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryDriversDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DriverStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;
}
