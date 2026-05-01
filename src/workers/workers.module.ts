import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PlaywrightModule } from '../playwright/playwright.module';
import { EncryptionModule } from '../encryption/encryption.module';
import {
  QUEUE_AUTO_DELIST,
  QUEUE_CROSSLIST,
  QUEUE_INVENTORY_IMPORT,
  QUEUE_MESSAGE_SYNC,
  QUEUE_OFFER_SENDER,
  QUEUE_PLAYWRIGHT,
} from '../queues/queue.constants';
import { MessageSyncProcessor } from './message-sync.processor';
import { PlaywrightProcessor } from './playwright.processor';
import { AutoDelistProcessor } from './auto-delist.processor';
import { OfferSenderProcessor } from './offer-sender.processor';
import { InventoryImportProcessor } from './inventory-import.processor';
import { CrosslistProcessor } from './crosslist.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_MESSAGE_SYNC }),
    BullModule.registerQueue({ name: QUEUE_PLAYWRIGHT }),
    BullModule.registerQueue({ name: QUEUE_AUTO_DELIST }),
    BullModule.registerQueue({ name: QUEUE_OFFER_SENDER }),
    BullModule.registerQueue({ name: QUEUE_INVENTORY_IMPORT }),
    BullModule.registerQueue({ name: QUEUE_CROSSLIST }),
    PlaywrightModule,
    EncryptionModule,
  ],
  providers: [
    MessageSyncProcessor,
    PlaywrightProcessor,
    AutoDelistProcessor,
    OfferSenderProcessor,
    InventoryImportProcessor,
    CrosslistProcessor,
  ],
})
export class WorkersModule {}
