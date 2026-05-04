import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

export type ProductCheckResult = {
  listingId: string;
  title: string;
  qtyRemaining: number;
  qtyTotal: number;
  inStock: boolean;
  category: string;
  condition: string;
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireProfile(user: AuthUser) {
    if (!user.profile) {
      throw new ForbiddenException('Profile not found for this user');
    }
    return user.profile;
  }

  /** Sample “check product” — resolves a listing owned by the current seller. */
  async checkByListingId(
    user: AuthUser,
    listingId: string,
  ): Promise<ProductCheckResult> {
    const profile = this.requireProfile(user);
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, profileId: profile.id },
      select: {
        id: true,
        title: true,
        qtyRemaining: true,
        qtyTotal: true,
        category: true,
        itemCondition: true,
      },
    });
    if (!listing) {
      throw new NotFoundException('Product (listing) not found');
    }
    return {
      listingId: listing.id,
      title: listing.title,
      qtyRemaining: listing.qtyRemaining,
      qtyTotal: listing.qtyTotal,
      inStock: listing.qtyRemaining > 0,
      category: listing.category,
      condition: listing.itemCondition,
    };
  }
}
