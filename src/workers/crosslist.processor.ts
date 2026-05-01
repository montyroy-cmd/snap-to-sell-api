import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Marketplace } from '@prisma/client';
import { QUEUE_CROSSLIST } from '../queues/queue.constants';

@Processor(QUEUE_CROSSLIST, { concurrency: 2 })
export class CrosslistProcessor extends WorkerHost {
  private readonly logger = new Logger(CrosslistProcessor.name);

  process(
    job: Job<{ listingId: string; marketplace: Marketplace }>,
  ): Promise<void> {
    const { listingId, marketplace } = job.data;
    this.logger.log(
      `CrosslistWorker create-listing listingId=${listingId} marketplace=${marketplace}`,
    );
    // Integrate marketplace official APIs or partner feeds per platform.
    return Promise.resolve();
  }
}
