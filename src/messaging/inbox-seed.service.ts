import { Injectable, Logger } from '@nestjs/common';
import { Marketplace, MessageSenderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type SeedConversation = {
  marketplace: Marketplace;
  buyerId: string;
  messageText: string;
  unreadCount?: number;
  minutesAgo: number;
};

const SEED_CONVERSATIONS: SeedConversation[] = [
  {
    marketplace: Marketplace.ebay,
    buyerId: 'seed-ebay-vintage-jacket',
    messageText:
      'Hi, is the vintage denim jacket still available? I can pay today if you can ship by tomorrow.',
    unreadCount: 1,
    minutesAgo: 18,
  },
  {
    marketplace: Marketplace.poshmark,
    buyerId: 'seed-poshmark-bundle',
    messageText:
      'Would you consider a bundle discount on the Nike hoodie and the Levi jeans?',
    unreadCount: 1,
    minutesAgo: 42,
  },
  {
    marketplace: Marketplace.mercari,
    buyerId: 'seed-mercari-camera',
    messageText:
      'Does the Canon camera include the charger and memory card shown in the photos?',
    unreadCount: 1,
    minutesAgo: 75,
  },
  {
    marketplace: Marketplace.etsy,
    buyerId: 'seed-etsy-handmade-sign',
    messageText:
      'Can this be customized with a different name before I place the order?',
    unreadCount: 1,
    minutesAgo: 110,
  },
  {
    marketplace: Marketplace.facebook_marketplace,
    buyerId: 'seed-facebook-local-pickup',
    messageText:
      'I am nearby this evening. Is porch pickup available for the storage shelf?',
    unreadCount: 1,
    minutesAgo: 150,
  },
  {
    marketplace: Marketplace.offerup,
    buyerId: 'seed-offerup-tools',
    messageText:
      'Would you take $35 for the tool set if I pick it up this afternoon?',
    unreadCount: 1,
    minutesAgo: 195,
  },
  {
    marketplace: Marketplace.ebay,
    buyerId: 'seed-ebay-watch',
    messageText:
      'Can you confirm the Seiko watch is keeping time and the crystal has no cracks?',
    unreadCount: 1,
    minutesAgo: 260,
  },
  {
    marketplace: Marketplace.poshmark,
    buyerId: 'seed-poshmark-measurements',
    messageText:
      'Could you send the pit-to-pit and length measurements for the Patagonia fleece?',
    unreadCount: 1,
    minutesAgo: 320,
  },
  {
    marketplace: Marketplace.mercari,
    buyerId: 'seed-mercari-shipping',
    messageText:
      'If I buy the sneakers now, could you ship them before the weekend?',
    unreadCount: 1,
    minutesAgo: 390,
  },
  {
    marketplace: Marketplace.etsy,
    buyerId: 'seed-etsy-repeat-buyer',
    messageText:
      'I bought from your shop before. Do you still have the matching brass hooks?',
    unreadCount: 1,
    minutesAgo: 470,
  },
];

@Injectable()
export class InboxSeedService {
  private readonly logger = new Logger(InboxSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedIfEmpty(profileId: string): Promise<void> {
    const existingConversationCount = await this.prisma.conversation.count({
      where: { profileId },
    });

    if (existingConversationCount > 0) {
      return;
    }

    const now = Date.now();

    try {
      await this.prisma.$transaction(
        SEED_CONVERSATIONS.map((seed) => {
          const createdAt = new Date(now - seed.minutesAgo * 60_000);

          return this.prisma.conversation.create({
            data: {
              profileId,
              marketplace: seed.marketplace,
              buyerId: seed.buyerId,
              unreadCount: seed.unreadCount ?? 1,
              createdAt,
              updatedAt: createdAt,
              messages: {
                create: {
                  senderType: MessageSenderType.buyer,
                  messageText: seed.messageText,
                  isRead: false,
                  createdAt,
                },
              },
            },
          });
        }),
      );
    } catch (err) {
      this.logger.error(`Inbox seed failed for profile ${profileId}`, err);
      throw err;
    }
  }
}
