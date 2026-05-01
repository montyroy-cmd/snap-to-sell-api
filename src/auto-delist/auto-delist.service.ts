import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ProcessSaleDto } from './dto/process-sale.dto';
import { SaleWebhookDto } from './dto/sale-webhook.dto';
import { QUEUE_AUTO_DELIST } from '../queues/queue.constants';

@Injectable()
export class AutoDelistService {
  private readonly logger = new Logger(AutoDelistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_AUTO_DELIST) private readonly delistQueue: Queue,
  ) {}

  private requireProfile(user: AuthUser) {
    if (!user.profile) throw new ForbiddenException('Profile not found');
    return user.profile;
  }

  validateWebhookSecret(provided?: string): void {
    const expected = this.config.get<string>('saleWebhookSecret');
    const isProd = this.config.get<string>('nodeEnv') === 'production';
    if (!expected) {
      if (isProd) {
        throw new UnauthorizedException('Webhook not configured');
      }
      this.logger.warn(
        'SALE_WEBHOOK_SECRET not set — allowing webhook in non-production',
      );
      return;
    }
    if (provided !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  async handleSaleWebhook(dto: SaleWebhookDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      include: { platformMappings: true },
    });
    if (!listing) {
      throw new ConflictException('Listing not found');
    }
    if (dto.profileId && dto.profileId !== listing.profileId) {
      throw new ForbiddenException('Listing ownership mismatch');
    }
    await this.applySaleAndMaybeDelist(listing.profileId, dto);
    return { ok: true };
  }

  async processSale(user: AuthUser, dto: ProcessSaleDto) {
    const profile = this.requireProfile(user);
    await this.applySaleAndMaybeDelist(profile.id, dto);
    return { ok: true };
  }

  private async applySaleAndMaybeDelist(
    profileId: string,
    dto: Pick<
      ProcessSaleDto,
      'listingId' | 'marketplace' | 'qtySold' | 'salePrice' | 'orderId'
    >,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM listings WHERE id = ${dto.listingId}::uuid FOR UPDATE`,
      );

      const listing = await tx.listing.findFirst({
        where: { id: dto.listingId, profileId },
      });
      if (!listing) {
        throw new ForbiddenException('Listing not found or not owned');
      }

      const updated = await tx.listing.updateMany({
        where: {
          id: dto.listingId,
          qtyRemaining: { gte: dto.qtySold },
        },
        data: { qtyRemaining: { decrement: dto.qtySold } },
      });
      if (updated.count === 0) {
        throw new ConflictException('Insufficient remaining quantity');
      }

      await tx.sale.create({
        data: {
          listingId: dto.listingId,
          marketplace: dto.marketplace,
          qtySold: dto.qtySold,
          salePrice: new Prisma.Decimal(dto.salePrice),
          orderId: dto.orderId,
        },
      });
    });

    const after = await this.prisma.listing.findUniqueOrThrow({
      where: { id: dto.listingId },
    });
    if (after.qtyRemaining <= 0) {
      const mappings = await this.prisma.listingPlatformMapping.findMany({
        where: {
          listingId: dto.listingId,
          status: 'active',
        },
      });
      for (const m of mappings) {
        await this.delistQueue.add(
          'auto-delist',
          { listingId: dto.listingId, marketplace: m.marketplace },
          { attempts: 5, backoff: { type: 'exponential', delay: 8000 } },
        );
      }
    }
  }
}
