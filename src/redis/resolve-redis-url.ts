import type { ConfigService } from '@nestjs/config';

function isOnVercel(): boolean {
  return process.env.VERCEL === '1';
}

/** True when the URL targets loopback — invalid on Vercel serverless. */
export function isLoopbackRedisUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host === '::1'
    );
  } catch {
    return false;
  }
}

/**
 * Local/dev defaults to localhost Redis. On Vercel, REDIS_URL must point at a hosted
 * Redis — there is no redis listening on 127.0.0.1 inside the function bundle.
 */
export function resolveRedisConnectionUrl(config: ConfigService): string {
  const configured = (config.get<string>('redis.url') ?? '').trim();

  if (isOnVercel()) {
    if (!configured) {
      throw new Error(
        'REDIS_URL is required on Vercel (serverless has no localhost Redis). Add it in Project Settings → Environment Variables — e.g. Upstash or Redis Cloud connection URL (often rediss://…). Redeploy after saving.',
      );
    }
    if (isLoopbackRedisUrl(configured)) {
      throw new Error(
        'REDIS_URL must not point at localhost on Vercel (ECONNREFUSED 127.0.0.1:6379). Remove the local redis URL from Vercel env and set a hosted Redis URL (Upstash, Redis Cloud, etc.).',
      );
    }
    return configured;
  }

  if (configured) return configured;
  return 'redis://127.0.0.1:6379';
}
