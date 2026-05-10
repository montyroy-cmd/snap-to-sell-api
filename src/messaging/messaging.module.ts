import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MessagesGateway } from './messages.gateway';
import { InboxSeedService } from './inbox-seed.service';

@Module({
  controllers: [MessagingController],
  providers: [MessagingService, MessagesGateway, InboxSeedService],
  exports: [MessagingService, MessagesGateway],
})
export class MessagingModule {}
