import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { InboxSeedService } from './inbox-seed.service';

/**
 * HTTP-only messaging module (no WebSocket gateway).
 * Useful for serverless runtimes like Vercel.
 */
@Module({
  controllers: [MessagingController],
  providers: [MessagingService, InboxSeedService],
  exports: [MessagingService],
})
export class MessagingHttpModule {}
