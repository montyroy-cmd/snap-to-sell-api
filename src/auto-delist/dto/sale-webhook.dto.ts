import { ApiProperty } from '@nestjs/swagger';
import { Marketplace } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class SaleWebhookDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  listingId: string;

  @ApiProperty({ enum: Marketplace })
  @IsEnum(Marketplace)
  marketplace: Marketplace;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qtySold: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  salePrice: number;

  @ApiProperty()
  @IsString()
  orderId: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  profileId?: string;
}
