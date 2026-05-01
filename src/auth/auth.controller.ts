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
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { ConnectMarketplaceDto } from './dto/connect-marketplace.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SocialAuthDto } from './dto/social-auth.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Email/password signup via Supabase Auth' })
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Email/password login via Supabase Auth' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh Supabase session' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @Public()
  @Post('social')
  @ApiOperation({
    summary: 'Social sign-in/up (Google, etc.) via Supabase Auth',
  })
  social(@Body() dto: SocialAuthDto) {
    return this.auth.social(dto);
  }

  @Post('connect-marketplace/:platform')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Store encrypted marketplace session (Playwright storage JSON)',
  })
  connectMarketplace(
    @CurrentUser() user: AuthUser,
    @Param('platform', new ParseEnumPipe(Marketplace)) platform: Marketplace,
    @Body() dto: ConnectMarketplaceDto,
  ) {
    return this.auth.connectMarketplace(user.userId, platform, dto);
  }
}
