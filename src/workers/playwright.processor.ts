import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Marketplace } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { PlaywrightService } from '../playwright/playwright.service';
import { QUEUE_PLAYWRIGHT } from '../queues/queue.constants';

@Processor(QUEUE_PLAYWRIGHT, { concurrency: 1 })
export class PlaywrightProcessor extends WorkerHost {
  private readonly logger = new Logger(PlaywrightProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly playwright: PlaywrightService,
  ) {
    super();
  }

  async process(
    job: Job<{
      listingId: string;
      marketplace: Marketplace;
      quantity?: number;
    }>,
  ): Promise<void> {
    const { listingId, marketplace, quantity } = job.data;
    this.logger.log(`PlaywrightWorker ${job.name} ${listingId} ${marketplace}`);

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { profile: true },
    });
    if (!listing) {
      this.logger.warn(`Listing ${listingId} missing`);
      return;
    }

    const account = await this.prisma.sellerMarketplaceAccount.findUnique({
      where: {
        profileId_marketplace: {
          profileId: listing.profileId,
          marketplace,
        },
      },
    });

    let storageJson: string | null = null;
    if (account?.encryptedSessionData) {
      try {
        storageJson = this.encryption.decrypt(account.encryptedSessionData);
      } catch (e) {
        this.logger.error(`Decrypt session failed: ${(e as Error).message}`);
      }
    }

    if (job.name === 'create-listing') {
      const price =
        listing.suggestedPrice?.toNumber() ?? listing.minPrice?.toNumber() ?? 0;
      const result = await this.playwright.createListingPlaceholder(
        marketplace,
        storageJson,
        {
          title: listing.title,
          description: listing.description,
          price,
        },
      );
      await this.prisma.listingPlatformMapping.upsert({
        where: {
          listingId_marketplace: { listingId, marketplace },
        },
        create: {
          listingId,
          marketplace,
          platformListingId: result.externalId ?? null,
          status: result.ok ? 'active' : 'error',
          lastSyncedAt: new Date(),
        },
        update: {
          platformListingId: result.externalId ?? undefined,
          status: result.ok ? 'active' : 'error',
          lastSyncedAt: new Date(),
        },
      });
    }

    if (job.name === 'update-quantity' && quantity != null) {
      this.logger.log(`Quantity sync placeholder: ${quantity}`);
      await this.prisma.listingPlatformMapping.updateMany({
        where: { listingId, marketplace },
        data: { lastSyncedAt: new Date() },
      });
    }
  }
}
