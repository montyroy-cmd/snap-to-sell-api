import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MarketplacesController } from './marketplaces.controller';
import { MarketplacesService } from './marketplaces.service';
import { MarketplacePlaywrightRateGuard } from '../common/guards/marketplace-playwright-rate.guard';
import { QUEUE_AUTO_DELIST, QUEUE_PLAYWRIGHT } from '../queues/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_PLAYWRIGHT }),
    BullModule.registerQueue({ name: QUEUE_AUTO_DELIST }),
  ],
  controllers: [MarketplacesController],
  providers: [MarketplacesService, MarketplacePlaywrightRateGuard],
})
export class MarketplacesModule {}
