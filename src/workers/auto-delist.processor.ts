import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Marketplace } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { PlaywrightService } from '../playwright/playwright.service';
import { QUEUE_AUTO_DELIST } from '../queues/queue.constants';

@Processor(QUEUE_AUTO_DELIST, { concurrency: 1 })
export class AutoDelistProcessor extends WorkerHost {
  private readonly logger = new Logger(AutoDelistProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly playwright: PlaywrightService,
  ) {
    super();
  }

  async process(
    job: Job<{ listingId: string; marketplace: Marketplace }>,
  ): Promise<void> {
    const { listingId, marketplace } = job.data;
    this.logger.log(`AutoDelistWorker ${listingId} ${marketplace}`);

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });
    if (!listing) return;

    const account = await this.prisma.sellerMarketplaceAccount.findUnique({
      where: {
        profileId_marketplace: { profileId: listing.profileId, marketplace },
      },
    });
    let storageJson: string | null = null;
    if (account?.encryptedSessionData) {
      try {
        storageJson = this.encryption.decrypt(account.encryptedSessionData);
      } catch {
        /* ignore */
      }
    }

    await this.playwright.withSession(
      marketplace,
      storageJson,
      async (page) => {
        void page;
        await Promise.resolve();
        this.logger.log(
          'Delist automation: implement end-listing flow per marketplace',
        );
      },
    );

    await this.prisma.listingPlatformMapping.updateMany({
      where: { listingId, marketplace },
      data: { status: 'delisted', lastSyncedAt: new Date() },
    });

    await this.prisma.delistJob.create({
      data: {
        listingId,
        marketplace,
        jobType: 'auto',
        status: 'completed',
        retries: job.attemptsMade,
      },
    });
  }
}
