import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { resolveRedisConnectionUrl } from './resolve-redis-url';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const url = resolveRedisConnectionUrl(config);
        const client = new Redis(url, {
          maxRetriesPerRequest: null,
          connectTimeout: 10_000,
          enableOfflineQueue: false,
        });
        const log = new Logger('Redis');
        client.on('error', (err) => {
          log.warn(err.message);
        });
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
