import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CompareQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seed?: number = 42;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(100)
  driverCount?: number = 40;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(100)
  requestCount?: number = 25;
}
