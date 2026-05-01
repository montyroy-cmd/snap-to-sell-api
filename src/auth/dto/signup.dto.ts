import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fullName?: string;

  /** Must be listed under Supabase → Authentication → URL Configuration → Redirect URLs */
  @ApiPropertyOptional({
    example: 'http://localhost:8080/auth/callback',
    description:
      'Where Supabase sends the user after they confirm email (defaults to Site URL if omitted)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  emailRedirectTo?: string;
}
