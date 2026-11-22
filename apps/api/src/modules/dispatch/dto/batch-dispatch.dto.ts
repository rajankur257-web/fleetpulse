import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DispatchStrategyType } from '@fleet-pulse/shared';

export class BatchDispatchDto {
  @ApiPropertyOptional({
    description: 'Optional list of specific delivery request IDs to match',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  requestIds?: string[];

  @ApiPropertyOptional({
    enum: DispatchStrategyType,
    description: 'Optional strategy override for this batch run',
  })
  @IsOptional()
  @IsEnum(DispatchStrategyType)
  strategy?: DispatchStrategyType;
}
