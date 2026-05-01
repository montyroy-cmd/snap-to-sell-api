import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * System instructions for Snap-to-Sell vision listing analysis (Anthropic Claude).
 * Tuned for realistic resale pricing, marketplace copy, and Mercari/OfferUp-style taxonomy.
 */
export const SNAP_TO_SELL_VISION_SYSTEM_PROMPT = `You are Snap-to-Sell's senior resale analyst and copywriter. You examine seller photos of secondhand and new goods for peer-to-peer marketplaces (Mercari, OfferUp, Facebook Marketplace).

Your job:
1. Identify the product from pixels: category, brand (if logos/text/model numbers are visible), model or era, color, size if shown, obvious defects, packaging, and authenticity cues. If the image is unclear, say what you can infer and what is uncertain—never invent a specific model year or SKU you cannot see.
2. Price like a seller who checks sold comps: suggest a realistic ask (suggestedPrice) and a firm floor (minPrice) in USD for the US secondhand market. Consider condition, brand strength, category velocity, seasonality hints, and completeness (box, accessories). minPrice should usually be 15–35% below suggestedPrice unless the item is damaged or very slow-moving. Never output zero or nonsense prices.
3. Write listing copy that converts: a scannable title and an SEO-friendly description with honest keywords buyers search for.
4. Choose category labels that match how sellers pick categories on Mercari and OfferUp (short noun phrase, e.g. "Women's Shoes", "Video Games", "Home & Garden", "Electronics", "Toys & Hobbies", "Handbags", "Collectibles").
5. Assess itemCondition strictly from the photo: New (sealed/tags), Like New (no visible wear), Good (light wear), Fair (clear wear or minor damage), Poor (heavy wear, major flaws, or incomplete).

Output discipline:
- Respond with a single JSON object only—no markdown fences, no commentary.
- All narrative fields must be written for real listings, not generic filler.
- researchNotes must summarize your reasoning: brand evidence, what similar items tend to sell for (describe as ranges or patterns, not fake exact URLs), and demand notes (hot/niche/slow).`;

export interface SnapResearchNotes {
  brandDetection: string;
  similarSoldItems: string;
  demandNotes: string;
  [key: string]: unknown;
}

export interface SnapResearchResult {
  suggestedPrice: number;
  minPrice: number;
  title: string;
  description: string;
  category: string;
  itemCondition: string;
  researchNotes: SnapResearchNotes;
}

type AnthropicVisionBackend = { client: Anthropic; model: string };

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropic: Anthropic | null = null;

  constructor(private readonly config: ConfigService) {
    const anthropicKey = this.config.get<string>('ai.anthropicKey');
    if (anthropicKey) {
      this.anthropic = new Anthropic({
        apiKey: anthropicKey,
        timeout: 90_000,
        maxRetries: 1,
      });
    }
  }

  /**
   * Vision + optional seller notes via Claude.
   * Does not throw; on failure returns a heuristic fallback derived from user text when possible.
   */
  async analyzePhotoAndSuggestPrice(
    photoBuffer: Buffer,
    description?: string,
    mimeType: string = 'image/jpeg',
  ): Promise<SnapResearchResult> {
    const text = description?.trim() ?? '';
    const backend = this.resolveAnthropicVisionBackend();

    if (!photoBuffer?.length) {
      this.logger.warn(
        'analyzePhotoAndSuggestPrice: empty buffer; using text-only fallback',
      );
      return this.fallbackResult(text, 'no_image_buffer');
    }

    if (!backend) {
      this.logger.warn(
        'analyzePhotoAndSuggestPrice: ANTHROPIC_API_KEY not set; using fallback',
      );
      return this.fallbackResult(text, 'no_api_key');
    }

    try {
      return await this.suggestWithVision(backend, photoBuffer, mimeType, text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `analyzePhotoAndSuggestPrice: AI failed (${msg}); using fallback`,
        err instanceof Error ? err.stack : undefined,
      );
      return this.fallbackResult(text, 'ai_error', msg);
    }
  }

  /**
   * Vision + text research: delegates to {@link analyzePhotoAndSuggestPrice}.
   */
  async getPriceSuggestion(
    photoBuffer: Buffer,
    description?: string,
    mimeType: string = 'image/jpeg',
  ): Promise<SnapResearchResult> {
    return this.analyzePhotoAndSuggestPrice(photoBuffer, description, mimeType);
  }

  /**
   * @deprecated Prefer {@link getPriceSuggestion} for snap-to-list; kept for callers that only have a public URL.
   */
  async suggestListingFromSnap(params: {
    userDescription: string;
    imagePublicUrl?: string;
  }): Promise<SnapResearchResult> {
    const backend = this.resolveAnthropicVisionBackend();
    if (!backend) {
      this.logger.warn(
        'suggestListingFromSnap: ANTHROPIC_API_KEY not set; using fallback',
      );
      return this.fallbackResult(params.userDescription, 'no_api_key');
    }

    const instruction = this.buildVisionUserJsonInstruction(
      params.userDescription,
    );

    try {
      const content: Anthropic.MessageParam['content'] = [
        { type: 'text', text: instruction },
      ];
      if (params.imagePublicUrl) {
        content.unshift({
          type: 'image',
          source: { type: 'url', url: params.imagePublicUrl },
        });
      }
      const raw = await this.completeVisionAnthropic(
        backend.client,
        backend.model,
        content,
      );
      return this.parseVisionJsonResponse(raw, params.userDescription);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`suggestListingFromSnap failed (${msg})`);
      return this.fallbackResult(params.userDescription, 'ai_error', msg);
    }
  }

  async suggestReply(messageText: string): Promise<string> {
    const fallback =
      'Thanks for your message — I will get back to you shortly.';
    const system =
      'You help marketplace sellers reply briefly and professionally. One short paragraph.';

    if (!this.anthropic) {
      return fallback;
    }

    try {
      const model =
        this.config.get<string>('ai.anthropicReplyModel') ??
        'claude-3-5-haiku-20241022';
      const r = await this.anthropic.messages.create({
        model,
        max_tokens: 256,
        system,
        messages: [{ role: 'user', content: messageText }],
      });
      const text = r.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('\n')
        .trim();
      if (text) return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`suggestReply: Anthropic failed (${msg})`);
    }

    return fallback;
  }

  private resolveAnthropicVisionBackend(): AnthropicVisionBackend | null {
    if (!this.anthropic) return null;
    const model =
      this.config.get<string>('ai.anthropicVisionModel') ??
      'claude-sonnet-4-20250514';
    return { client: this.anthropic, model };
  }

  private buildVisionUserJsonInstruction(userDescription: string): string {
    return `Seller notes (may be empty):\n${userDescription || '(none)'}\n\nReturn ONLY one JSON object with exactly these keys:
- title: string, compelling marketplace title, max 80 characters, no ALL CAPS spam.
- description: string, 200–400 characters, honest and SEO-friendly (materials, fit, compatibility, condition, what's included). No HTML.
- suggestedPrice: number, USD, realistic resale ask.
- minPrice: number, USD, floor price (see system rules).
- category: string, Mercari/OfferUp-style category (short phrase).
- itemCondition: exactly one of: New | Like New | Good | Fair | Poor
- researchNotes: object with string fields:
  - brandDetection: what brand/model evidence you see or "Unclear from photo"
  - similarSoldItems: how comparable listings tend to price (ranges/patterns, no fake links)
  - demandNotes: liquidity / seasonality / niche vs mass appeal

Use the image as the primary source of truth; merge seller notes when they add facts (size, defects) not visible in the photo.`;
  }

  private normalizeImageMime(mimeType: string): string {
    const m = (mimeType || 'image/jpeg').toLowerCase();
    if (m === 'image/jpg') return 'image/jpeg';
    return m;
  }

  private toAnthropicImageMediaType(
    mime: string,
  ): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
    const m = mime.toLowerCase();
    if (m === 'image/png') return 'image/png';
    if (m === 'image/gif') return 'image/gif';
    if (m === 'image/webp') return 'image/webp';
    if (m === 'image/heic' || m === 'image/heif') {
      this.logger.warn(
        'Claude vision expects JPEG/PNG/GIF/WebP; HEIC may fail — consider converting uploads',
      );
    }
    return 'image/jpeg';
  }

  private async suggestWithVision(
    backend: AnthropicVisionBackend,
    photoBuffer: Buffer,
    mimeType: string,
    userDescription: string,
  ): Promise<SnapResearchResult> {
    const mime = this.normalizeImageMime(mimeType);
    const instruction = this.buildVisionUserJsonInstruction(userDescription);
    const mediaType = this.toAnthropicImageMediaType(mime);
    const raw = await this.completeVisionAnthropic(
      backend.client,
      backend.model,
      [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: photoBuffer.toString('base64'),
          },
        },
        { type: 'text', text: instruction },
      ],
    );
    return this.parseVisionJsonResponse(raw, userDescription);
  }

  private async completeVisionAnthropic(
    client: Anthropic,
    model: string,
    content: Anthropic.MessageParam['content'],
  ): Promise<string | undefined> {
    const r = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SNAP_TO_SELL_VISION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });
    return r.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim();
  }

  private parseVisionJsonResponse(
    raw: string | null | undefined,
    fallbackDescription: string,
  ): SnapResearchResult {
    if (!raw) {
      return this.fallbackResult(fallbackDescription, 'empty_model_output');
    }

    const cleaned = this.stripJsonFences(raw);

    let j: Record<string, unknown>;
    try {
      j = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return this.fallbackResult(fallbackDescription, 'json_parse_error');
    }

    const title = this.clampTitle(this.asString(j.title, ''));
    let description = this.clampDescription(
      this.asString(j.description, fallbackDescription),
    );
    if (description.length < 200 && description.length > 0) {
      description =
        `${description} Ships quickly; see photos for exact condition and included items.`.slice(
          0,
          400,
        );
    }
    const category = this.asString(j.category, 'General').slice(0, 120);
    const itemCondition = this.normalizeItemCondition(
      this.asString(j.itemCondition, 'Good'),
    );
    const { suggestedPrice, minPrice } = this.coercePrices(
      j.suggestedPrice,
      j.minPrice,
    );

    const researchNotes = this.parseResearchNotes(j);

    if (!title) {
      return this.fallbackResult(fallbackDescription, 'invalid_title');
    }

    return {
      suggestedPrice,
      minPrice,
      title,
      description: description || fallbackDescription.slice(0, 400),
      category,
      itemCondition,
      researchNotes,
    };
  }

  private parseResearchNotes(j: Record<string, unknown>): SnapResearchNotes {
    const rn = j.researchNotes;
    const src =
      typeof rn === 'object' && rn !== null && !Array.isArray(rn)
        ? (rn as Record<string, unknown>)
        : {};

    return {
      brandDetection: this.asString(src.brandDetection ?? j.brandDetection, ''),
      similarSoldItems: this.asString(
        src.similarSoldItems ?? j.similarSoldItems,
        '',
      ),
      demandNotes: this.asString(src.demandNotes ?? j.demandNotes, ''),
    };
  }

  private stripJsonFences(raw: string): string {
    let s = raw.trim();
    if (s.startsWith('```')) {
      s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    }
    return s.trim();
  }

  private asString(v: unknown, fallback: string): string {
    return typeof v === 'string' ? v.trim() : fallback;
  }

  private clampTitle(title: string): string {
    const t = title.replace(/\s+/g, ' ').trim();
    return t.length <= 80 ? t : t.slice(0, 77).trimEnd() + '…';
  }

  private clampDescription(d: string): string {
    const x = d.replace(/\s+/g, ' ').trim();
    if (x.length <= 400) return x;
    return x.slice(0, 397).trimEnd() + '…';
  }

  private normalizeItemCondition(raw: string): string {
    const k = raw.toLowerCase().replace(/[-_]/g, ' ').trim();
    const map: [string, string][] = [
      ['new', 'New'],
      ['like new', 'Like New'],
      ['likenew', 'Like New'],
      ['excellent', 'Like New'],
      ['mint', 'Like New'],
      ['good', 'Good'],
      ['very good', 'Good'],
      ['used', 'Good'],
      ['fair', 'Fair'],
      ['acceptable', 'Fair'],
      ['poor', 'Poor'],
      ['damaged', 'Poor'],
      ['for parts', 'Poor'],
    ];
    for (const [needle, out] of map) {
      if (k === needle || k.includes(needle)) return out;
    }
    return 'Good';
  }

  private coercePrices(
    suggestedRaw: unknown,
    minRaw: unknown,
  ): { suggestedPrice: number; minPrice: number } {
    const suggested = Number(suggestedRaw);
    const min = Number(minRaw);
    const maxUsd = 500_000;
    let suggestedPrice =
      Number.isFinite(suggested) && suggested > 0
        ? Math.min(suggested, maxUsd)
        : 0;
    let minPrice = Number.isFinite(min) && min > 0 ? Math.min(min, maxUsd) : 0;

    if (!suggestedPrice) {
      suggestedPrice = 29.99;
      minPrice = minPrice && minPrice < suggestedPrice ? minPrice : 19.99;
      return {
        suggestedPrice: this.roundMoney(suggestedPrice),
        minPrice: this.roundMoney(minPrice),
      };
    }

    if (!minPrice || minPrice >= suggestedPrice) {
      minPrice = Math.max(0.99, suggestedPrice * 0.72);
    }
    if (minPrice > suggestedPrice) {
      minPrice = suggestedPrice * 0.85;
    }

    return {
      suggestedPrice: this.roundMoney(suggestedPrice),
      minPrice: this.roundMoney(minPrice),
    };
  }

  private roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private fallbackResult(
    userDescription: string,
    reason: string,
    detail?: string,
  ): SnapResearchResult {
    const titleBase =
      userDescription.slice(0, 80) || 'Item for sale — add details';
    return {
      suggestedPrice: 29.99,
      minPrice: 19.99,
      title: titleBase.length > 80 ? titleBase.slice(0, 77) + '…' : titleBase,
      description:
        userDescription.slice(0, 400) ||
        'Add a short description and retake the photo with good lighting so we can analyze the listing.',
      category: 'General',
      itemCondition: 'Good',
      researchNotes: {
        brandDetection: 'Analysis unavailable — photo or AI service required.',
        similarSoldItems:
          'Set prices manually from sold comps on your marketplace of choice.',
        demandNotes: detail
          ? `Fallback triggered (${reason}): ${detail.slice(0, 200)}`
          : `Fallback triggered (${reason}).`,
      },
    };
  }
}
