import {
  Body,
  Controller,
  Param,
  ParseEnumPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Marketplace } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  MarketplacePlaywrightRateGuard,
  PlaywrightMarketplace,
} from '../common/guards/marketplace-playwright-rate.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { MarketplacesService } from './marketplaces.service';
import {
  CreatePlatformListingBodyDto,
  DelistBodyDto,
  UpdateQuantityBodyDto,
} from './dto/marketplace-listing.dto';

@ApiTags('Marketplaces')
@ApiBearerAuth()
@Controller('marketplaces')
@UseGuards(JwtAuthGuard, MarketplacePlaywrightRateGuard)
export class MarketplacesController {
  constructor(private readonly marketplaces: MarketplacesService) {}

  @Post(':platform/create-listing')
  @PlaywrightMarketplace('platform')
  @ApiOperation({
    summary: 'Enqueue Playwright / API worker to create listing on platform',
  })
  createListing(
    @CurrentUser() user: AuthUser,
    @Param('platform', new ParseEnumPipe(Marketplace)) platform: Marketplace,
    @Body() body: CreatePlatformListingBodyDto,
  ) {
    return this.marketplaces.enqueueCreateListing(
      user,
      platform,
      body.listingId,
    );
  }

  @Post(':platform/update-quantity')
  @PlaywrightMarketplace('platform')
  @ApiOperation({ summary: 'Enqueue worker to sync quantity on platform' })
  updateQuantity(
    @CurrentUser() user: AuthUser,
    @Param('platform', new ParseEnumPipe(Marketplace)) platform: Marketplace,
    @Body() body: UpdateQuantityBodyDto,
  ) {
    return this.marketplaces.enqueueUpdateQuantity(
      user,
      platform,
      body.listingId,
      body.quantity,
    );
  }

  @Post(':platform/delist')
  @PlaywrightMarketplace('platform')
  @ApiOperation({ summary: 'Enqueue delist job for platform' })
  delist(
    @CurrentUser() user: AuthUser,
    @Param('platform', new ParseEnumPipe(Marketplace)) platform: Marketplace,
    @Body() body: DelistBodyDto,
  ) {
    return this.marketplaces.enqueueDelist(user, platform, body.listingId);
  }
}
