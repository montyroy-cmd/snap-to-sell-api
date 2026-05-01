import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MessagesGateway } from './messages.gateway';

@Module({
  controllers: [MessagingController],
  providers: [MessagingService, MessagesGateway],
  exports: [MessagingService, MessagesGateway],
})
export class MessagingModule {}
