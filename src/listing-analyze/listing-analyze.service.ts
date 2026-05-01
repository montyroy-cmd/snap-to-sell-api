import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  LISTING_ANALYZE_SYSTEM_PROMPT,
  LISTING_ANALYZE_TOOL,
} from './listing-analyze.constants';
import type { ListingAnalyzeDto } from './dto/listing-analyze.dto';

/** Response shape matches Next.js `route.ts` (Flutter `ListingAnalyzeApi`). */
export type ListingAnalyzeResponse = {
  analysis: unknown;
  photosAnalyzed: number;
  model: string;
};

@Injectable()
export class ListingAnalyzeService {
  private readonly logger = new Logger(ListingAnalyzeService.name);

  constructor(private readonly config: ConfigService) {}

  async analyze(dto: ListingAnalyzeDto): Promise<ListingAnalyzeResponse> {
    const apiKey = this.config.get<string>('ai.anthropicKey')?.trim();
    if (!apiKey) {
      throw new InternalServerErrorException(
        'AI service not configured. Contact support.',
      );
    }

    const model =
      this.config.get<string>('ai.listingAnalyzeModel') ??
      'claude-sonnet-4-20250514';

    const client = new Anthropic({
      apiKey,
      timeout: 90_000,
      maxRetries: 1,
    });

    const photoBlocks = dto.photos.map((base64) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: base64,
      },
    }));

    const instructionText = dto.categoryHint?.trim()
      ? `Analyze these ${dto.photos.length} photo(s) of an item. Hint: this is in the "${dto.categoryHint}" category. Identify everything you can and call the submit_listing_analysis tool.`
      : `Analyze these ${dto.photos.length} photo(s) of an item to be resold. Identify everything you can and call the submit_listing_analysis tool.`;

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system: LISTING_ANALYZE_SYSTEM_PROMPT,
        tools: [LISTING_ANALYZE_TOOL],
        tool_choice: { type: 'tool', name: 'submit_listing_analysis' },
        messages: [
          {
            role: 'user',
            content: [...photoBlocks, { type: 'text', text: instructionText }],
          },
        ],
      });

      const toolUseBlock = response.content.find(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === 'tool_use',
      );

      if (!toolUseBlock) {
        this.logger.error(
          'Listing analyze: no tool_use in Claude response',
          JSON.stringify(response.content),
        );
        throw new BadGatewayException(
          'AI did not return structured data. Try again with clearer photos.',
        );
      }

      return {
        analysis: toolUseBlock.input,
        photosAnalyzed: dto.photos.length,
        model,
      };
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (err instanceof BadGatewayException || err instanceof HttpException) {
        throw err;
      }

      if (e.status === 401) {
        throw new InternalServerErrorException(
          'AI service authentication failed. Contact support.',
        );
      }
      if (e.status === 429) {
        throw new HttpException(
          'AI service is busy. Please try again in a moment.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (e.status === 400) {
        throw new HttpException(
          e.message || 'Bad request to AI service',
          HttpStatus.BAD_REQUEST,
        );
      }

      const msg = e instanceof Error ? e.message : String(err);
      this.logger.warn(`Listing analyze failed: ${msg}`, e instanceof Error ? e.stack : undefined);

      throw new InternalServerErrorException(
        'AI analysis failed. Please try again.',
      );
    }
  }
}
