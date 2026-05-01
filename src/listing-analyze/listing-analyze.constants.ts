/**
 * Mirrors SellSeva web `src/app/api/listing/analyze/route.ts` so Flutter + web share one contract.
 */
import type Anthropic from '@anthropic-ai/sdk';

export const MAX_LISTING_ANALYZE_PHOTOS = 8;

/** Same tool schema as Next.js listing analyze route (forces structured output). */
export const LISTING_ANALYZE_TOOL = {
  name: 'submit_listing_analysis',
  description:
    "Submit the analyzed listing data after examining the product photos. Be specific and accurate. If you cannot determine a field with reasonable confidence, mark its confidence as 'low' and provide your best guess as a placeholder rather than leaving fields blank.",
  input_schema: {
    type: 'object' as const,
    properties: {
      brand: {
        type: 'string',
        description:
          "Brand name visible in the photos (e.g., 'Patagonia', 'Levi's', 'Sony'). Empty string if no brand discernible.",
      },
      model: {
        type: 'string',
        description:
          "Specific model or style name if identifiable (e.g., 'Synchilla Snap-T', 'WH-1000XM4'). Empty string if not identifiable.",
      },
      size: {
        type: 'string',
        description:
          "Size as visible on tag or determinable (e.g., 'Medium', 'Mens 10', '32x30', 'One Size'). Empty string if not determinable.",
      },
      color: {
        type: 'string',
        description:
          "Primary color or color combination (e.g., 'Navy blue', 'Faded indigo', 'Black/White').",
      },
      condition: {
        type: 'string',
        enum: [
          'New with tags',
          'New without tags',
          'Like new',
          'Excellent',
          'Very good',
          'Good',
          'Fair',
          'For parts or repair',
        ],
        description: 'Condition assessment based on visible wear in photos.',
      },
      category: {
        type: 'string',
        enum: [
          'Apparel',
          'Footwear',
          'Electronics',
          'Accessories',
          'Jewelry',
          'Books & Media',
          'Collectibles',
          'Instruments',
          'Home & Garden',
          'Other',
        ],
        description: 'Best-fit category for the item.',
      },
      baseTitle: {
        type: 'string',
        description:
          "Concise listing title — typically 'Brand Model Style' format. Max ~50 chars.",
      },
      baseDescription: {
        type: 'string',
        description:
          '2-4 sentence neutral description suitable as a starting point. Mentions key features, materials, fit, condition. Will be customized per platform.',
      },
      basePrice: {
        type: 'number',
        description:
          'Suggested asking price in USD based on brand, condition, and typical secondhand market pricing.',
      },
      priceRange: {
        type: 'array',
        items: { type: 'number' },
        description:
          'Tuple of [low, high] reasonable asking price range in USD.',
      },
      priceReason: {
        type: 'string',
        description: '1-sentence explanation for the price recommendation.',
      },
      suggestedPlatforms: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'ebay',
            'poshmark',
            'mercari',
            'etsy',
            'depop',
            'facebook',
            'offerup',
          ],
        },
        description:
          '2-4 best-fit marketplaces for this item type, in priority order.',
      },
      confidence: {
        type: 'object',
        properties: {
          brand: { type: 'string', enum: ['high', 'medium', 'low'] },
          size: { type: 'string', enum: ['high', 'medium', 'low'] },
          condition: { type: 'string', enum: ['high', 'medium', 'low'] },
          price: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['brand', 'size', 'condition', 'price'],
        description:
          'Per-field confidence based on photo quality and visibility of key identifiers.',
      },
    },
    required: [
      'brand',
      'model',
      'size',
      'color',
      'condition',
      'category',
      'baseTitle',
      'baseDescription',
      'basePrice',
      'priceRange',
      'priceReason',
      'suggestedPlatforms',
      'confidence',
    ],
  },
} as unknown as Anthropic.Tool;

export const LISTING_ANALYZE_SYSTEM_PROMPT = `You are an expert appraiser for an online reseller's listing tool. You examine photos of items being resold (clothing, shoes, electronics, accessories, etc.) and produce structured listing data.

Your job:
1. Identify the brand, model, size, condition, and other relevant attributes from what you can see
2. Suggest a fair starting price based on brand reputation and visible condition
3. Recommend the best 2-4 marketplaces for this specific item type
4. Honestly rate your confidence per field — don't guess if a tag is unreadable; mark it low confidence

Be specific and accurate. Resellers depend on you for both authenticity assessment (don't claim a brand you can't see) and fair pricing (don't underprice based on bad photos, don't overprice based on good lighting).

Always call the submit_listing_analysis tool with your findings. Don't reply with text.`;
