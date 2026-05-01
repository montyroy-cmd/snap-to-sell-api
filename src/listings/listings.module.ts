import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import {
  QUEUE_CROSSLIST,
  QUEUE_INVENTORY_IMPORT,
  QUEUE_PLAYWRIGHT,
} from '../queues/queue.constants';

@Module({
  imports: [
    AiModule,
    StorageModule,
    BullModule.registerQueue({ name: QUEUE_PLAYWRIGHT }),
    BullModule.registerQueue({ name: QUEUE_CROSSLIST }),
    BullModule.registerQueue({ name: QUEUE_INVENTORY_IMPORT }),
  ],
  controllers: [ListingsController],
  providers: [ListingsService],
})
export class ListingsModule {}
