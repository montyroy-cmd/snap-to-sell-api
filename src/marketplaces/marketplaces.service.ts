import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { QUEUE_AUTO_DELIST, QUEUE_PLAYWRIGHT } from '../queues/queue.constants';

@Injectable()
export class MarketplacesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_PLAYWRIGHT) private readonly playwrightQueue: Queue,
    @InjectQueue(QUEUE_AUTO_DELIST) private readonly delistQueue: Queue,
  ) {}

  private requireProfile(user: AuthUser) {
    if (!user.profile) throw new ForbiddenException('Profile not found');
    return user.profile;
  }

  async enqueueCreateListing(
    user: AuthUser,
    platform: Marketplace,
    listingId: string,
  ) {
    const profile = this.requireProfile(user);
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, profileId: profile.id },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    await this.playwrightQueue.add(
      'create-listing',
      { listingId, marketplace: platform },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    return { enqueued: true, job: 'create-listing', listingId, platform };
  }

  async enqueueUpdateQuantity(
    user: AuthUser,
    platform: Marketplace,
    listingId: string,
    quantity: number,
  ) {
    const profile = this.requireProfile(user);
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, profileId: profile.id },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    await this.playwrightQueue.add(
      'update-quantity',
      { listingId, marketplace: platform, quantity },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    return {
      enqueued: true,
      job: 'update-quantity',
      listingId,
      platform,
      quantity,
    };
  }

  async enqueueDelist(
    user: AuthUser,
    platform: Marketplace,
    listingId: string,
  ) {
    const profile = this.requireProfile(user);
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, profileId: profile.id },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    await this.delistQueue.add(
      'delist',
      { listingId, marketplace: platform },
      { attempts: 5, backoff: { type: 'exponential', delay: 8000 } },
    );
    return { enqueued: true, job: 'delist', listingId, platform };
  }
}
