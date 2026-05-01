import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AutoDelistController } from './auto-delist.controller';
import { AutoDelistService } from './auto-delist.service';
import { QUEUE_AUTO_DELIST } from '../queues/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_AUTO_DELIST })],
  controllers: [AutoDelistController],
  providers: [AutoDelistService],
})
export class AutoDelistModule {}
