import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePlatformListingBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  listingId: string;

  @ApiPropertyOptional({ description: 'Override title for this platform' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;
}

export class UpdateQuantityBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  listingId: string;

  @ApiProperty({ description: 'New quantity available on platform' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;
}

export class DelistBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  listingId: string;
}
