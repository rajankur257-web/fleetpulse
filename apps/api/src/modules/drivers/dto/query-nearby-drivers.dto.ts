import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class QueryNearbyDriversDto {
  @ApiProperty({ example: 12.9716, description: 'Latitude (-90 to 90)' })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 77.5946, description: 'Longitude (-180 to 180)' })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({
    example: 5,
    default: 5,
    description: 'Radius in kilometers (max 100km)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100)
  radiusKm: number = 5;
}
