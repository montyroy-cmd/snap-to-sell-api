import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { memoryStorage } from 'multer';
import * as winston from 'winston';
import { WinstonModule } from 'nest-winston';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { resolveRedisConnectionUrl } from './redis/resolve-redis-url';
import { EncryptionModule } from './encryption/encryption.module';
import { PlaywrightModule } from './playwright/playwright.module';
import { AiModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { ListingsModule } from './listings/listings.module';
import { MarketplacesModule } from './marketplaces/marketplaces.module';
import { AutoDelistModule } from './auto-delist/auto-delist.module';
import { MessagingModule } from './messaging/messaging.module';
import { OffersModule } from './offers/offers.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WorkersModule } from './workers/workers.module';
import { ListingAnalyzeModule } from './listing-analyze/listing-analyze.module';
import { HealthController } from './health/health.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { LISTING_PHOTO_MAX_BYTES } from './config/multer.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: LISTING_PHOTO_MAX_BYTES },
    }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf((raw) => {
              const info = raw as Record<string, unknown>;
              const timestamp =
                typeof info.timestamp === 'string' ? info.timestamp : '';
              const level = typeof info.level === 'string' ? info.level : '';
              const msgVal = info.message;
              const message =
                typeof msgVal === 'string'
                  ? msgVal
                  : msgVal != null
                    ? JSON.stringify(msgVal)
                    : '';
              const context =
                typeof info.context === 'string' ? info.context : 'App';
              const meta: Record<string, unknown> = { ...info };
              delete meta.timestamp;
              delete meta.level;
              delete meta.message;
              delete meta.context;
              for (const k of Object.keys(meta)) {
                if (/password|authorization|cookie|token|secret/i.test(k)) {
                  meta[k] = '[REDACTED]';
                }
              }
              return `${timestamp} [${context}] ${level}: ${message} ${JSON.stringify(meta)}`;
            }),
          ),
        }),
      ],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'global',
            ttl: config.get<number>('throttle.ttlMs') ?? 60_000,
            limit: config.get<number>('throttle.limit') ?? 120,
          },
        ],
        getTracker: (req: { ip?: string; user?: { userId?: string } }) =>
          req.user?.userId ?? req.ip ?? 'anon',
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = resolveRedisConnectionUrl(config);
        return {
          // Without enableOfflineQueue: false, queue.add() can hang forever when Redis
          // is down (commands sit in ioredis's offline queue). Snap-to-list then never
          // returns even though we catch add() errors below.
          connection: {
            url,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            // Fail fast when REDIS_URL points at a dead host (avoids long hangs on snap-to-list).
            connectTimeout: 10_000,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        };
      },
    }),
    PrismaModule,
    RedisModule,
    EncryptionModule,
    PlaywrightModule,
    AiModule,
    StorageModule,
    AuthModule,
    ListingsModule,
    MarketplacesModule,
    AutoDelistModule,
    MessagingModule,
    OffersModule,
    AnalyticsModule,
    WorkersModule,
    ListingAnalyzeModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
  ],
})
export class AppModule {}
