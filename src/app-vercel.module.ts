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
import { EncryptionModule } from './encryption/encryption.module';
import { PlaywrightModule } from './playwright/playwright.module';
import { AiModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { ListingsModule } from './listings/listings.module';
import { MarketplacesModule } from './marketplaces/marketplaces.module';
import { AutoDelistModule } from './auto-delist/auto-delist.module';
import { OffersModule } from './offers/offers.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ListingAnalyzeModule } from './listing-analyze/listing-analyze.module';
import { HealthController } from './health/health.controller';
import { LISTING_PHOTO_MAX_BYTES } from './config/multer.config';
import { MessagingHttpModule } from './messaging/messaging-http.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';

/**
 * Vercel/serverless friendly module:
 * - excludes BullMQ processors (`WorkersModule`)
 * - excludes Socket.IO gateway (`MessagingModule` -> uses `MessagingHttpModule`)
 *
 * REST endpoints still work; queue producers can still enqueue if Redis is configured.
 */
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
        const url =
          (config.get<string>('redis.url') ?? '').trim() ||
          'redis://127.0.0.1:6379';
        return {
          connection: {
            url,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
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
    MessagingHttpModule,
    OffersModule,
    AnalyticsModule,
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
export class AppVercelModule {}
