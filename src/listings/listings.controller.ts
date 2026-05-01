import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { SnapToListDto } from './dto/snap-to-list.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  LISTING_PHOTO_MAX_BYTES,
  listingPhotoFileFilter,
} from '../config/multer.config';

@ApiTags('Listings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('listings')
export class ListingsController {
  private readonly logger = new Logger(ListingsController.name);

  constructor(private readonly listings: ListingsService) {}

  @Post('snap-to-list')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: {
        fileSize: LISTING_PHOTO_MAX_BYTES,
        files: 1,
      },
      fileFilter: listingPhotoFileFilter,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Primary photo is required. Optionally restrict crosslisting to connected accounts on specific marketplaces only.',
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
          description:
            'Primary listing image (JPEG, PNG, WebP, HEIC; size limit in server logs / multer config)',
        },
        description: {
          type: 'string',
          maxLength: 8000,
          description: 'Optional seller notes (brand, condition, flaws, etc.)',
        },
        marketplaces: {
          type: 'string',
          description:
            'Optional. Comma-separated marketplace ids (mercari,offerup,ebay,...) or JSON array string. Omit to enqueue all connected platforms.',
          example: 'mercari,offerup',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Snap-to-list',
    description:
      'Upload a photo → AI price & copy → persist listing → enqueue crosslisting jobs (Playwright for Mercari/OfferUp, API queue for other connected platforms).',
  })
  async snapToList(
    @CurrentUser() user: AuthUser,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() body: SnapToListDto,
  ) {
    try {
      return await this.listings.snapToList(user, photo, body);
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `snapToList controller: unexpected error — ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new HttpException(
        'Snap-to-list is temporarily unavailable. Please try again.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create listing manually (no AI)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateListingDto) {
    return this.listings.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List seller listings (limit/offset/cursor)' })
  findAll(@CurrentUser() user: AuthUser, @Query() q: PaginationQueryDto) {
    return this.listings.findAll(user, q);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listings.findOne(user, id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(user, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listings.remove(user, id);
  }

  @Post('import-from-marketplaces')
  @ApiOperation({ summary: 'Enqueue inventory import worker' })
  importFromMarketplaces(@CurrentUser() user: AuthUser) {
    return this.listings.importFromMarketplaces(user);
  }
}
