import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
} from 'class-validator';

/** Same JSON body as web POST /api/listing/analyze */
export class ListingAnalyzeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  photos!: string[];

  @IsOptional()
  @IsString()
  categoryHint?: string;
}
