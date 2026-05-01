import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AutoDelistService } from './auto-delist.service';
import { ProcessSaleDto } from './dto/process-sale.dto';
import { SaleWebhookDto } from './dto/sale-webhook.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';

@ApiTags('AutoDelist')
@Controller()
export class AutoDelistController {
  constructor(private readonly autoDelist: AutoDelistService) {}

  @Public()
  @Post('webhooks/sale-detected')
  @ApiOperation({
    summary: 'External sale signal (requires x-webhook-secret when configured)',
  })
  webhookSale(
    @Headers('x-webhook-secret') secret: string | undefined,
    @Body() dto: SaleWebhookDto,
  ) {
    this.autoDelist.validateWebhookSecret(secret);
    return this.autoDelist.handleSaleWebhook(dto);
  }

  @Post('auto-delist/process-sale')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Authenticated sale processing with row lock + optional auto-delist fan-out',
  })
  processSale(@CurrentUser() user: AuthUser, @Body() dto: ProcessSaleDto) {
    return this.autoDelist.processSale(user, dto);
  }
}
