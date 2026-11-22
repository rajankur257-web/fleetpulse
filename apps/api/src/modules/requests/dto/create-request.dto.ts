import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateRequestDto {
  @ApiProperty({ example: 12.9352, description: 'Pickup Latitude (-90 to 90)' })
  @IsLatitude()
  pickupLat!: number;

  @ApiProperty({ example: 77.6245, description: 'Pickup Longitude (-180 to 180)' })
  @IsLongitude()
  pickupLng!: number;

  @ApiProperty({ example: 12.9784, description: 'Drop Latitude (-90 to 90)' })
  @IsLatitude()
  dropLat!: number;

  @ApiProperty({ example: 77.6408, description: 'Drop Longitude (-180 to 180)' })
  @IsLongitude()
  dropLng!: number;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number = 1;
}
