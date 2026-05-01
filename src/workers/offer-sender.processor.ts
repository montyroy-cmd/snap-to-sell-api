import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_OFFER_SENDER } from '../queues/queue.constants';

@Processor(QUEUE_OFFER_SENDER, { concurrency: 1 })
export class OfferSenderProcessor extends WorkerHost {
  private readonly logger = new Logger(OfferSenderProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ profileId: string }>): Promise<void> {
    this.logger.log(`OfferSenderWorker profile ${job.data.profileId}`);
    const rules = await this.prisma.offerRule.findMany({
      where: { profileId: job.data.profileId, isActive: true },
    });
    this.logger.log(`Active offer rules: ${rules.length}`);
    // Send offers via marketplace APIs / Playwright; persist Offer rows.
  }
}
