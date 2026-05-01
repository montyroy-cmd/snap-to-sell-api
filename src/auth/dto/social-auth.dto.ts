import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum SocialProvider {
  google = 'google',
  facebook = 'facebook',
}

export class SocialAuthDto {
  @ApiProperty({ enum: SocialProvider, example: SocialProvider.google })
  @IsEnum(SocialProvider)
  provider: SocialProvider;

  /** Google ID token (preferred for mobile sign-in). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  idToken?: string;

  /** Provider access token (optional; depends on provider). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  accessToken?: string;

  /** Optional profile hint from client. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  email?: string;

  /** Optional profile hint from client. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;
}
