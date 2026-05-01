import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireProfile(user: AuthUser) {
    if (!user.profile) throw new ForbiddenException('Profile not found');
    return user.profile;
  }

  async summary(user: AuthUser) {
    const profile = this.requireProfile(user);
    const [listingCount, activeMappings, salesAgg, events] =
      await this.prisma.$transaction([
        this.prisma.listing.count({ where: { profileId: profile.id } }),
        this.prisma.listingPlatformMapping.count({
          where: { listing: { profileId: profile.id }, status: 'active' },
        }),
        this.prisma.sale.aggregate({
          where: { listing: { profileId: profile.id } },
          _sum: { salePrice: true, qtySold: true },
          _count: true,
        }),
        this.prisma.analyticsEvent.groupBy({
          by: ['eventType'],
          where: { profileId: profile.id },
          _count: true,
          orderBy: { eventType: 'asc' },
        }),
      ]);
    return {
      listings: listingCount,
      activeCrosslistings: activeMappings,
      sales: {
        count: salesAgg._count,
        totalRevenue: salesAgg._sum.salePrice?.toNumber() ?? 0,
        unitsSold: salesAgg._sum.qtySold ?? 0,
      },
      eventsByType: events,
    };
  }

  async salesReport(user: AuthUser, limit = 50) {
    const profile = this.requireProfile(user);
    return this.prisma.sale.findMany({
      where: { listing: { profileId: profile.id } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        listing: { select: { id: true, title: true } },
      },
    });
  }
}
