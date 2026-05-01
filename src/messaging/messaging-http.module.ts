import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

/**
 * HTTP-only messaging module (no WebSocket gateway).
 * Useful for serverless runtimes like Vercel.
 */
@Module({
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingHttpModule {}
