import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Marketplace } from '@prisma/client';
import { Request } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { REDIS_CLIENT } from '../../redis/redis.module';
import Redis from 'ioredis';
import type { AuthUser } from '../decorators/current-user.decorator';

export const PLAYWRIGHT_MARKETPLACE_KEY = 'playwrightMarketplaceParam';

/** Mark route with route param name holding Marketplace (e.g. 'platform'). */
export const PlaywrightMarketplace = (paramName: string) =>
  SetMetadata(PLAYWRIGHT_MARKETPLACE_KEY, paramName);

const PLAYWRIGHT_PLATFORMS: Marketplace[] = ['mercari', 'offerup'];

@Injectable()
export class MarketplacePlaywrightRateGuard implements CanActivate {
  private limiter: RateLimiterRedis;

  constructor(
    @Inject(REDIS_CLIENT) redis: Redis,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {
    const points = this.config.get<number>('playwrightRateLimit.points') ?? 5;
    const duration =
      this.config.get<number>('playwrightRateLimit.durationSec') ?? 60;
    this.limiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'rl:pw',
      points,
      duration,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName = this.reflector.getAllAndOverride<string>(
      PLAYWRIGHT_MARKETPLACE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!paramName) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const platform = req.params[paramName] as Marketplace | undefined;
    if (!platform || !PLAYWRIGHT_PLATFORMS.includes(platform)) {
      return true;
    }
    const user = (req as Request & { user?: AuthUser }).user;
    const userId = user?.userId ?? req.ip ?? 'anon';
    const key = `${userId}:${platform}`;
    try {
      await this.limiter.consume(key);
      return true;
    } catch {
      throw new ServiceUnavailableException(
        `Rate limit exceeded for ${platform}: max 5 operations per minute`,
      );
    }
  }
}
