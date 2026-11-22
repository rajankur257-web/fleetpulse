import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DispatchStrategyType } from '@fleet-pulse/shared';

export class SetStrategyDto {
  @ApiProperty({
    enum: DispatchStrategyType,
    example: DispatchStrategyType.SCORED,
    description: 'Dispatch strategy to make active',
  })
  @IsEnum(DispatchStrategyType)
  strategy!: DispatchStrategyType;
}
