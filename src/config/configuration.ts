export default () => {
  const anthropicVisionModel =
    process.env.ANTHROPIC_VISION_MODEL?.trim() || 'claude-sonnet-4-20250514';

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiVersion: process.env.API_VERSION ?? 'v1',
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    supabase: {
      url: (process.env.SUPABASE_URL ?? '').trim().replace(/\/$/, ''),
      anonKey: (process.env.SUPABASE_ANON_KEY ?? '').trim(),
      serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
      jwtSecret: process.env.SUPABASE_JWT_SECRET ?? process.env.JWT_SECRET ?? '',
      listingsBucket: process.env.SUPABASE_LISTINGS_BUCKET ?? 'listings',
    },
    redis: {
      url: (process.env.REDIS_URL ?? '').trim() || 'redis://127.0.0.1:6379',
    },
    cookieEncryptionKeyB64: process.env.COOKIE_ENCRYPTION_KEY ?? '',
    ai: {
      anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
      anthropicVisionModel,
      anthropicReplyModel:
        process.env.ANTHROPIC_REPLY_MODEL?.trim() ||
        'claude-3-5-haiku-20241022',
      /**
       * `POST /api/listing/analyze` — defaults to same model as snap-to-list vision.
       * Override with LISTING_ANALYZE_MODEL (e.g. Haiku for speed/cost on mobile-only flows).
       */
      listingAnalyzeModel:
        process.env.LISTING_ANALYZE_MODEL?.trim() || anthropicVisionModel,
    },
    throttle: {
      ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
    },
    playwrightRateLimit: {
      points: parseInt(process.env.PLAYWRIGHT_RATE_LIMIT_POINTS ?? '5', 10),
      durationSec: parseInt(
        process.env.PLAYWRIGHT_RATE_LIMIT_DURATION_SEC ?? '60',
        10,
      ),
    },
    saleWebhookSecret: process.env.SALE_WEBHOOK_SECRET ?? '',
  };
};
