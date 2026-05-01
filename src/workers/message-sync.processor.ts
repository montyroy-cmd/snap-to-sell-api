import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_MESSAGE_SYNC } from '../queues/queue.constants';

@Processor(QUEUE_MESSAGE_SYNC, { concurrency: 2 })
export class MessageSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageSyncProcessor.name);

  process(job: Job<{ profileId?: string }>): Promise<void> {
    this.logger.log(
      `MessageSyncWorker job ${job.id} ${JSON.stringify(job.data)}`,
    );
    // Poll eBay, Etsy, Mercari, OfferUp — integrate marketplace APIs / Playwright here.
    return Promise.resolve();
  }
}
