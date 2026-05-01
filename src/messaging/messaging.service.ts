import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  private requireProfile(user: AuthUser) {
    if (!user.profile) throw new ForbiddenException('Profile not found');
    return user.profile;
  }

  async inbox(user: AuthUser, platform?: string) {
    const profile = this.requireProfile(user);
    const where: Prisma.ConversationWhereInput = { profileId: profile.id };
    if (platform && platform !== 'all') {
      where.marketplace = platform as Marketplace;
    }
    return this.prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        listing: { select: { id: true, title: true } },
      },
    });
  }

  async conversation(user: AuthUser, id: string) {
    const profile = this.requireProfile(user);
    const conv = await this.prisma.conversation.findFirst({
      where: { id, profileId: profile.id },
      include: { messages: { orderBy: { createdAt: 'asc' } }, listing: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async reply(user: AuthUser, conversationId: string, messageText: string) {
    const profile = this.requireProfile(user);
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, profileId: profile.id },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const msg = await this.prisma.message.create({
      data: {
        conversationId,
        senderType: 'seller',
        messageText,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return msg;
  }
}
