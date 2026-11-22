import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateDriverLocationDto {
  @ApiProperty({ example: 12.9716, description: 'Latitude (-90 to 90)' })
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 77.5946, description: 'Longitude (-180 to 180)' })
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ example: 180, description: 'Heading in degrees (0-360)' })
  @IsNumber()
  @Min(0)
  @Max(360)
  @IsOptional()
  heading?: number;

  @ApiPropertyOptional({ example: 35.5, description: 'Speed in km/h' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  speed?: number;
}
