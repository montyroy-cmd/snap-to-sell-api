import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { InboxSeedService } from '../../messaging/inbox-seed.service';

export type SupabaseJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
  aud?: string;
};

/** Swagger prepends `Bearer `; clients that also paste `Bearer <jwt>` would send `Bearer Bearer <jwt>`. */
function jwtFromRequest(req: Request): string | null {
  const raw = req.headers.authorization;
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  while (/^Bearer\s+/i.test(s)) {
    s = s.replace(/^Bearer\s+/i, '').trim();
  }
  return s.length > 0 ? s : null;
}

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(
  Strategy,
  'supabase-jwt',
) {
  private readonly logger = new Logger(SupabaseJwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly inboxSeed: InboxSeedService,
  ) {
    const symmetricSecret =
      config.get<string>('supabase.jwtSecret') ||
      (config.get<string>('nodeEnv') !== 'production'
        ? 'dev-insecure-jwt-secret'
        : '');
    const isProd = config.get<string>('nodeEnv') === 'production';

    if (isProd && !symmetricSecret) {
      throw new Error('SUPABASE_JWT_SECRET is required in production');
    }

    super({
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKeyProvider: (_req, _rawJwtToken, done) => {
        if (!symmetricSecret) {
          return done(new Error('No JWT secret configured'), undefined);
        }
        return done(null, symmetricSecret);
      },
      algorithms: ['HS256'],
    });

    if (symmetricSecret === 'dev-insecure-jwt-secret') {
      this.logger.warn(
        'Using insecure JWT secret for HS256 only — set SUPABASE_JWT_SECRET',
      );
    }
  }

  async validate(payload: SupabaseJwtPayload): Promise<AuthUser> {
    let profile = await this.prisma.profile.findUnique({
      where: { userId: payload.sub },
    });
    if (!profile) {
      this.logger.debug(`No profile for user ${payload.sub}`);
      profile = await this.prisma.profile.upsert({
        where: { userId: payload.sub },
        create: { userId: payload.sub },
        update: {},
      });
      await this.inboxSeed.seedIfEmpty(profile.id);
    }
    return { userId: payload.sub, email: payload.email, profile };
  }
}
