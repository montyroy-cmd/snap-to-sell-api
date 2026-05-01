import { ApiPropertyOptional } from '@nestjs/swagger';
import { Marketplace } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const MARKETPLACE_VALUES = Object.values(Marketplace) as string[];

function isMarketplace(v: string): v is Marketplace {
  return MARKETPLACE_VALUES.includes(v);
}

function parseMarketplacesField(value: unknown): Marketplace[] | undefined {
  if (value == null || value === '') return undefined;
  if (Array.isArray(value)) {
    const out = value.filter(
      (v): v is Marketplace => typeof v === 'string' && isMarketplace(v),
    );
    return out.length ? out : undefined;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return undefined;
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        const out = parsed.filter(
          (v): v is Marketplace => typeof v === 'string' && isMarketplace(v),
        );
        return out.length ? out : undefined;
      }
    } catch {
      /* comma-separated */
    }
    const out = s
      .split(',')
      .map((x) => x.trim())
      .filter(isMarketplace);
    return out.length ? out : undefined;
  }
  return undefined;
}

export class SnapToListDto {
  @ApiPropertyOptional({
    description:
      'Optional notes about the item (condition, brand, flaws, etc.)',
    maxLength: 8000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @ApiPropertyOptional({
    description:
      'Subset of marketplaces to crosslist (must have a connected account for each). Omit to use all connected platforms. Comma-separated IDs or JSON string array.',
    example: 'mercari,offerup,ebay',
    enum: Marketplace,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseMarketplacesField(value))
  @IsArray()
  @IsEnum(Marketplace, { each: true })
  marketplaces?: Marketplace[];
}
