import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseJwtStrategy } from './strategies/supabase-jwt.strategy';
import { InboxSeedService } from '../messaging/inbox-seed.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'supabase-jwt' }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SupabaseJwtStrategy, InboxSeedService],
  exports: [AuthService],
})
export class AuthModule {}
