import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Marketplace } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class OfferRuleDto {
  @ApiProperty({ enum: Marketplace })
  @IsEnum(Marketplace)
  marketplace: Marketplace;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent: number;

  @ApiProperty({ example: 'Never below min_price on listing' })
  @IsString()
  minDiscountRule: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
