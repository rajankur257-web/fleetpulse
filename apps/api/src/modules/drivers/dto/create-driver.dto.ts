import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DriverStatus } from '@prisma/client';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateDriverDto {
  @ApiProperty({ example: 'Rohan Kumar' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 12.9716, description: 'Latitude (-90 to 90)' })
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 77.5946, description: 'Longitude (-180 to 180)' })
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ enum: DriverStatus, default: DriverStatus.available })
  @IsEnum(DriverStatus)
  @IsOptional()
  status?: DriverStatus = DriverStatus.available;

  @ApiPropertyOptional({ example: 5.0, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number = 5.0;
}
