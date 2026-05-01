import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { SkipEnvelope } from '../common/decorators/skip-envelope.decorator';
import { ListingAnalyzeDto } from './dto/listing-analyze.dto';
import { ListingAnalyzeService } from './listing-analyze.service';

/**
 * Mobile + tooling expect **Next-shaped** JSON at POST /api/listing/analyze (no /v1 prefix, no envelope).
 * Guarded by throttle only — intentionally **public** (Flutter sends no JWT).
 */
@ApiTags('Listing AI')
@Controller('api')
@Public()
@Throttle({ default: { limit: 45, ttl: 60000 } })
export class ListingAnalyzeController {
  constructor(private readonly listingAnalyze: ListingAnalyzeService) {}

  @Post('listing/analyze')
  @SkipEnvelope()
  @ApiOperation({
    summary: 'Analyze listing photos (Claude vision)',
    description:
      'Same contract as Next.js POST /api/listing/analyze — raw JSON { analysis, photosAnalyzed, model }.',
  })
  analyze(@Body() dto: ListingAnalyzeDto) {
    return this.listingAnalyze.analyze(dto);
  }
}
