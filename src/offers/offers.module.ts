import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { QUEUE_OFFER_SENDER } from '../queues/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_OFFER_SENDER })],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
