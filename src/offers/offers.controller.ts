import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { OffersService } from './offers.service';
import { OfferRuleDto } from './dto/offer-rule.dto';

@ApiTags('Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get('rules')
  @ApiOperation({ summary: 'List offer automation rules' })
  getRules(@CurrentUser() user: AuthUser) {
    return this.offers.getRules(user);
  }

  @Post('rules')
  @ApiOperation({ summary: 'Create offer rule (append-only in this version)' })
  createRule(@CurrentUser() user: AuthUser, @Body() dto: OfferRuleDto) {
    return this.offers.upsertRule(user, dto);
  }

  @Post('send-auto-offers')
  @ApiOperation({ summary: 'Enqueue OfferSenderWorker' })
  sendAuto(@CurrentUser() user: AuthUser) {
    return this.offers.sendAutoOffers(user);
  }
}
