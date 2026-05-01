import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { OfferRuleDto } from './dto/offer-rule.dto';
import { QUEUE_OFFER_SENDER } from '../queues/queue.constants';

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_OFFER_SENDER) private readonly offerQueue: Queue,
  ) {}

  private requireProfile(user: AuthUser) {
    if (!user.profile) throw new ForbiddenException('Profile not found');
    return user.profile;
  }

  async getRules(user: AuthUser) {
    const profile = this.requireProfile(user);
    return this.prisma.offerRule.findMany({ where: { profileId: profile.id } });
  }

  async upsertRule(user: AuthUser, dto: OfferRuleDto) {
    const profile = this.requireProfile(user);
    return this.prisma.offerRule.create({
      data: {
        profileId: profile.id,
        marketplace: dto.marketplace,
        discountPercent: new Prisma.Decimal(dto.discountPercent),
        minDiscountRule: dto.minDiscountRule,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async sendAutoOffers(user: AuthUser) {
    const profile = this.requireProfile(user);
    await this.offerQueue.add(
      'send-auto-offers',
      { profileId: profile.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 15_000 } },
    );
    return { enqueued: true };
  }
}
