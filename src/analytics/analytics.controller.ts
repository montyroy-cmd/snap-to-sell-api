import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'High-level KPIs for the seller' })
  summary(@CurrentUser() user: AuthUser) {
    return this.analytics.summary(user);
  }

  @Get('sales-report')
  @ApiOperation({ summary: 'Recent sales with listing info' })
  salesReport(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.analytics.salesReport(user, Number.isNaN(n) ? 50 : n);
  }
}
