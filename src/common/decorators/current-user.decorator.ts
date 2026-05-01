import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Profile } from '@prisma/client';

export type AuthUser = {
  userId: string;
  email?: string;
  profile: Profile | null;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
