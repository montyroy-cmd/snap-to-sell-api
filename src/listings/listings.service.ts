import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Listing, Marketplace, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AiService } from '../ai/ai.service';
import { StorageService } from '../storage/storage.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { SnapToListDto } from './dto/snap-to-list.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  QUEUE_CROSSLIST,
  QUEUE_INVENTORY_IMPORT,
  QUEUE_PLAYWRIGHT,
} from '../queues/queue.constants';

/** Playwright automation (session-based browsers) */
const PLAYWRIGHT_MARKETPLACES: Marketplace[] = ['mercari', 'offerup'];

const BULL_ADD_TIMEOUT_MS = 15_000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
    @InjectQueue(QUEUE_PLAYWRIGHT) private readonly playwrightQueue: Queue,
    @InjectQueue(QUEUE_CROSSLIST) private readonly crosslistQueue: Queue,
    @InjectQueue(QUEUE_INVENTORY_IMPORT) private readonly importQueue: Queue,
  ) {}

  private requireProfile(user: AuthUser) {
    if (!user.profile) {
      throw new ForbiddenException('Profile not found for this user');
    }
    return user.profile;
  }

  async snapToList(
    user: AuthUser,
    file: Express.Multer.File | undefined,
    dto: SnapToListDto,
  ) {
    this.logger.log(
      `snapToList: start (userId=${user.userId}, hasFile=${Boolean(file?.buffer?.length)})`,
    );

    try {
      const profile = this.requireProfile(user);
      if (!file?.buffer?.length) {
        throw new BadRequestException(
          'Photo is required: multipart field "photo" (JPEG, PNG, WebP, or HEIC).',
        );
      }

      this.logger.log('snapToList: before AI (analyzePhotoAndSuggestPrice)');
      const ai = await this.ai.analyzePhotoAndSuggestPrice(
        file.buffer,
        dto.description,
        file.mimetype,
      );
      this.logger.log(
        `snapToList: after AI (title preview="${ai.title?.slice(0, 60)}…")`,
      );

      this.logger.log('snapToList: before storage upload');
      let upload: { path: string; publicUrl: string };
      try {
        upload = await this.storage.uploadListingPhoto(
          file.buffer,
          file.mimetype,
          profile.id,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `snapToList: storage upload failed — ${msg}`,
          err instanceof Error ? err.stack : undefined,
        );
        const isProd = process.env.NODE_ENV === 'production';
        throw new BadRequestException({
          message:
            'Could not store your photo. Check storage settings or try a different image.',
          ...(isProd ? {} : { storageError: msg }),
        });
      }
      this.logger.log(`snapToList: after storage (path=${upload.path})`);

      const imagesPayload: Prisma.InputJsonValue = [
        {
          url: upload.publicUrl,
          path: upload.path,
          sortOrder: 0,
          isPrimary: true,
        },
      ];

      this.logger.log('snapToList: before Prisma listing.create');
      let listing: Listing;
      try {
        listing = await this.prisma.listing.create({
          data: {
            profileId: profile.id,
            title: ai.title,
            description: ai.description,
            suggestedPrice: new Prisma.Decimal(ai.suggestedPrice),
            minPrice: new Prisma.Decimal(ai.minPrice),
            qtyTotal: 1,
            qtyRemaining: 1,
            itemCondition: ai.itemCondition,
            category: ai.category,
            aiResearchData: {
              ...ai.researchNotes,
              imagePath: upload.path,
            } as Prisma.InputJsonValue,
            images: imagesPayload,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `snapToList: Prisma create failed — ${msg}`,
          err instanceof Error ? err.stack : undefined,
        );
        throw new ServiceUnavailableException(
          'Could not save your listing to the database. Please try again in a moment.',
        );
      }
      this.logger.log(`snapToList: after Prisma (listingId=${listing.id})`);

      const accounts = await this.prisma.sellerMarketplaceAccount.findMany({
        where: { profileId: profile.id, status: 'connected' },
      });

      const selected = dto.marketplaces?.length
        ? new Set(dto.marketplaces)
        : null;

      const enqueued: {
        marketplace: Marketplace;
        queue: string;
        jobName: string;
      }[] = [];

      const enqueueFailures: { marketplace: Marketplace; reason: string }[] =
        [];

      this.logger.log(
        `snapToList: queue phase (${accounts.length} connected account(s))`,
      );
      for (const a of accounts) {
        if (selected && !selected.has(a.marketplace)) {
          continue;
        }
        try {
          if (PLAYWRIGHT_MARKETPLACES.includes(a.marketplace)) {
            await withTimeout(
              this.playwrightQueue.add(
                'create-listing',
                { listingId: listing.id, marketplace: a.marketplace },
                { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
              ),
              BULL_ADD_TIMEOUT_MS,
              `playwrightQueue.add(${a.marketplace})`,
            );
            enqueued.push({
              marketplace: a.marketplace,
              queue: QUEUE_PLAYWRIGHT,
              jobName: 'create-listing',
            });
          } else {
            await withTimeout(
              this.crosslistQueue.add(
                'create-listing',
                { listingId: listing.id, marketplace: a.marketplace },
                { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
              ),
              BULL_ADD_TIMEOUT_MS,
              `crosslistQueue.add(${a.marketplace})`,
            );
            enqueued.push({
              marketplace: a.marketplace,
              queue: QUEUE_CROSSLIST,
              jobName: 'create-listing',
            });
          }
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `snapToList: BullMQ add failed for ${a.marketplace} — ${reason}`,
          );
          enqueueFailures.push({ marketplace: a.marketplace, reason });
        }
      }
      this.logger.log(
        `snapToList: done (enqueued=${enqueued.length}, enqueueFailures=${enqueueFailures.length})`,
      );

      const redisLikelyDown = enqueueFailures.some(
        (f) =>
          f.reason.includes('ECONNREFUSED') ||
          f.reason.includes('ETIMEDOUT') ||
          f.reason.includes('timed out after') ||
          f.reason.includes(':6379'),
      );

      return {
        listing,
        ai,
        image: { publicUrl: upload.publicUrl, path: upload.path },
        enqueuedCrosslistingJobs: enqueued,
        ...(enqueueFailures.length > 0 && {
          enqueueFailures,
          ...(redisLikelyDown && {
            enqueueHint:
              'Start Redis (e.g. docker compose up) or set REDIS_URL so BullMQ can queue crosslisting jobs.',
          }),
        }),
      };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `snapToList: unexpected error — ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Snap-to-list could not be completed. Please try again shortly.',
      );
    }
  }

  async create(user: AuthUser, dto: CreateListingDto) {
    const profile = this.requireProfile(user);
    return this.prisma.listing.create({
      data: {
        profileId: profile.id,
        title: dto.title,
        description: dto.description ?? '',
        suggestedPrice:
          dto.suggestedPrice != null
            ? new Prisma.Decimal(dto.suggestedPrice)
            : null,
        minPrice:
          dto.minPrice != null ? new Prisma.Decimal(dto.minPrice) : null,
        qtyTotal: dto.qtyTotal ?? 1,
        qtyRemaining: dto.qtyTotal ?? 1,
        itemCondition: dto.itemCondition ?? 'used',
        category: dto.category ?? '',
        images: [] as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(user: AuthUser, q: PaginationQueryDto) {
    const profile = this.requireProfile(user);
    const limit = q.limit ?? 20;
    const offset = q.offset ?? 0;
    const where: Prisma.ListingWhereInput = { profileId: profile.id };
    if (q.cursor) {
      const d = new Date(q.cursor);
      if (!Number.isNaN(d.getTime())) {
        where.createdAt = { lt: d };
      }
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: q.cursor ? 0 : offset,
      }),
      this.prisma.listing.count({ where: { profileId: profile.id } }),
    ]);
    const last = items.at(-1);
    return {
      items,
      total,
      limit,
      offset,
      nextCursor: last ? last.createdAt.toISOString() : null,
    };
  }

  async findOne(user: AuthUser, id: string) {
    const profile = this.requireProfile(user);
    const listing = await this.prisma.listing.findFirst({
      where: { id, profileId: profile.id },
      include: { platformMappings: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async update(user: AuthUser, id: string, dto: UpdateListingDto) {
    await this.findOne(user, id);
    return this.prisma.listing.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        suggestedPrice:
          dto.suggestedPrice != null
            ? new Prisma.Decimal(dto.suggestedPrice)
            : undefined,
        minPrice:
          dto.minPrice != null ? new Prisma.Decimal(dto.minPrice) : undefined,
        qtyTotal: dto.qtyTotal,
        itemCondition: dto.itemCondition,
        category: dto.category,
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.findOne(user, id);
    await this.prisma.listing.delete({ where: { id } });
    return { deleted: true, id };
  }

  async importFromMarketplaces(user: AuthUser) {
    const profile = this.requireProfile(user);
    await this.importQueue.add(
      'import',
      { profileId: profile.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
    );
    return { enqueued: true };
  }
}
