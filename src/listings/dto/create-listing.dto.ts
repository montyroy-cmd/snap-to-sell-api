import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateListingDto {
  @ApiProperty({ example: 'Vintage leather jacket', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({
    description: 'Listing body / details shown to buyers',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 89.99,
    description: 'Target / list price (USD)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  suggestedPrice?: number;

  @ApiPropertyOptional({
    example: 59.99,
    description: 'Floor price you will not go below (USD)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional({ default: 1, description: 'Quantity for sale' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qtyTotal?: number;

  @ApiPropertyOptional({
    default: 'used',
    description: 'Item condition label (e.g. new, like_new, used, for_parts)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  itemCondition?: string;

  @ApiPropertyOptional({
    example: 'Clothing',
    description: 'Category slug or label',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string;
}
