import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountStatus, Marketplace, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { InboxSeedService } from '../messaging/inbox-seed.service';
import { ConnectMarketplaceDto } from './dto/connect-marketplace.dto';
import { LoginDto } from './dto/login.dto';
import { SocialAuthDto, SocialProvider } from './dto/social-auth.dto';
import { SignupDto } from './dto/signup.dto';

type SupabaseAuthErrorBody = {
  msg?: string;
  message?: string;
  error_description?: string;
  error?: string;
  hint?: string;
  code?: string | number;
};

function messageFromSupabaseAuthError(
  body: Record<string, unknown>,
): string | undefined {
  const b = body as SupabaseAuthErrorBody;
  const parts = [
    b.msg,
    b.message,
    b.error_description,
    typeof b.error === 'string' ? b.error : undefined,
    b.hint,
  ].filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  if (parts.length === 0) return undefined;
  return [...new Set(parts.map((p) => p.trim()))].join(' — ');
}

/** Table/relation missing or other schema mismatch (Prisma P2021, etc.). */
function isPrismaSchemaOrTableError(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === 'P2021' || e.code === 'P2010' || e.code === 'P2022')
  );
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly inboxSeed: InboxSeedService,
  ) {}

  private supabaseUrl(): string {
    const url = this.config.get<string>('supabase.url');
    if (!url) throw new BadRequestException('Supabase is not configured');
    return url;
  }

  private supabaseAuthHeaders(): Record<string, string> {
    const key = this.anonKey();
    return {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
  }

  private anonKey(): string {
    const k = this.config.get<string>('supabase.anonKey');
    if (!k)
      throw new BadRequestException('SUPABASE_ANON_KEY is not configured');
    return k;
  }

  async signup(dto: SignupDto) {
    const redirect = dto.emailRedirectTo?.trim();
    const signupPath = `${this.supabaseUrl()}/auth/v1/signup`;
    const signupUrl = redirect
      ? `${signupPath}?${new URLSearchParams({ redirect_to: redirect }).toString()}`
      : signupPath;
    const res = await fetch(signupUrl, {
      method: 'POST',
      headers: this.supabaseAuthHeaders(),
      body: JSON.stringify({
        email: dto.email,
        password: dto.password,
        data: { full_name: dto.fullName },
      }),
    });
    let body: Record<string, unknown>;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        `Signup failed (${res.status}): invalid response from auth server`,
      );
    }
    if (!res.ok) {
      this.logger.warn(`Signup failed: ${JSON.stringify(body)}`);
      const detail = messageFromSupabaseAuthError(body);
      throw new BadRequestException(
        detail ??
          `Signup failed (${res.status}). Check Supabase Auth settings and keys.`,
      );
    }
    const b = body as {
      user?: { id?: string };
      id?: string;
      session?: { user?: { id?: string } };
    };
    const userId = b.user?.id ?? b.session?.user?.id ?? b.id;
    if (!userId) {
      throw new BadRequestException('Unexpected signup response');
    }
    try {
      const profile = await this.prisma.profile.upsert({
        where: { userId },
        create: {
          userId,
          fullName: dto.fullName ?? null,
        },
        update: { fullName: dto.fullName ?? undefined },
      });
      await this.inboxSeed.seedIfEmpty(profile.id);
    } catch (e) {
      this.logger.error('Profile upsert after signup failed', e);
      if (isPrismaSchemaOrTableError(e)) {
        throw new ServiceUnavailableException(
          'Could not create user profile: apply the Prisma schema to this database (e.g. npx prisma db push or migrate deploy).',
        );
      }
      throw e;
    }
    return body;
  }

  async login(dto: LoginDto) {
    const res = await fetch(
      `${this.supabaseUrl()}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: this.supabaseAuthHeaders(),
        body: JSON.stringify({ email: dto.email, password: dto.password }),
      },
    );
    let body: Record<string, unknown>;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        `Login failed (${res.status}): invalid response from auth server`,
      );
    }
    if (!res.ok) {
      const detail = messageFromSupabaseAuthError(body);
      throw new BadRequestException(detail ?? 'Login failed');
    }
    const accessToken = (body as { access_token?: string }).access_token;
    const userObj = (body as { user?: { id: string } }).user;
    if (userObj?.id) {
      try {
        const profile = await this.prisma.profile.upsert({
          where: { userId: userObj.id },
          create: { userId: userObj.id },
          update: {},
        });
        await this.inboxSeed.seedIfEmpty(profile.id);
      } catch (e) {
        this.logger.error('Profile upsert after login failed', e);
        if (isPrismaSchemaOrTableError(e)) {
          throw new ServiceUnavailableException(
            'Could not sync user profile: apply the Prisma schema to this database (e.g. npx prisma db push or migrate deploy) and ensure the DB role can write to table profiles.',
          );
        }
        throw e;
      }
    }
    return { ...body, access_token: accessToken };
  }

  async refresh(refreshToken: string) {
    const res = await fetch(
      `${this.supabaseUrl()}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: this.supabaseAuthHeaders(),
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );
    let body: Record<string, unknown>;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        `Refresh failed (${res.status}): invalid response from auth server`,
      );
    }
    if (!res.ok) {
      const detail = messageFromSupabaseAuthError(body);
      throw new BadRequestException(detail ?? 'Refresh failed');
    }
    return body;
  }

  async social(dto: SocialAuthDto) {
    if (dto.provider === SocialProvider.google) {
      const idToken = dto.idToken?.trim();
      if (!idToken) {
        throw new BadRequestException('idToken is required for Google sign-in');
      }

      // Supabase GoTrue supports exchanging a provider id_token for a Supabase session.
      const res = await fetch(
        `${this.supabaseUrl()}/auth/v1/token?grant_type=id_token`,
        {
          method: 'POST',
          headers: this.supabaseAuthHeaders(),
          body: JSON.stringify({
            provider: 'google',
            id_token: idToken,
          }),
        },
      );

      let body: Record<string, unknown>;
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        throw new BadRequestException(
          `Social login failed (${res.status}): invalid response from auth server`,
        );
      }

      if (!res.ok) {
        const detail = messageFromSupabaseAuthError(body);
        throw new BadRequestException(detail ?? 'Social login failed');
      }

      const userObj = (body as { user?: { id?: string } }).user;
      const userId = userObj?.id;
      if (userId) {
        try {
          const profile = await this.prisma.profile.upsert({
            where: { userId },
            create: { userId, fullName: dto.fullName ?? null },
            update: { fullName: dto.fullName ?? undefined },
          });
          await this.inboxSeed.seedIfEmpty(profile.id);
        } catch (e) {
          this.logger.error('Profile upsert after social login failed', e);
          if (isPrismaSchemaOrTableError(e)) {
            throw new ServiceUnavailableException(
              'Could not sync user profile: apply the Prisma schema to this database (e.g. npx prisma db push or migrate deploy) and ensure the DB role can write to table profiles.',
            );
          }
          throw e;
        }
      }

      return body;
    }

    throw new BadRequestException(
      `Unsupported social provider: ${dto.provider}`,
    );
  }

  async connectMarketplace(
    userId: string,
    platform: Marketplace,
    dto: ConnectMarketplaceDto,
  ) {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { userId },
    });
    const encrypted = this.encryption.encrypt(dto.sessionJson);
    return this.prisma.sellerMarketplaceAccount.upsert({
      where: {
        profileId_marketplace: { profileId: profile.id, marketplace: platform },
      },
      create: {
        profileId: profile.id,
        marketplace: platform,
        encryptedSessionData: encrypted,
        status: AccountStatus.connected,
        lastSynced: new Date(),
      },
      update: {
        encryptedSessionData: encrypted,
        status: AccountStatus.connected,
        lastSynced: new Date(),
      },
    });
  }
}
