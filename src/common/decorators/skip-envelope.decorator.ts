import { SetMetadata } from '@nestjs/common';

/** Skips {@link TransformResponseInterceptor} wrapping — use for Next.js–compatible JSON shapes. */
export const SKIP_API_ENVELOPE_KEY = 'skipApiEnvelope';
export const SkipEnvelope = () => SetMetadata(SKIP_API_ENVELOPE_KEY, true);
