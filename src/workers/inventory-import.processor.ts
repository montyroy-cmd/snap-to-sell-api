import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_INVENTORY_IMPORT } from '../queues/queue.constants';

@Processor(QUEUE_INVENTORY_IMPORT, { concurrency: 1 })
export class InventoryImportProcessor extends WorkerHost {
  private readonly logger = new Logger(InventoryImportProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  process(job: Job<{ profileId: string }>): Promise<void> {
    this.logger.log(`InventoryImportWorker profile ${job.data.profileId}`);
    // Pull remote listings and reconcile with local Listing + ListingPlatformMapping.
    return Promise.resolve();
  }
}
