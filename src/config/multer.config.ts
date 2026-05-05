import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import type { FileFilterCallback } from 'multer';
import { memoryStorage } from 'multer';

/** Max listing photo size (bytes). Kept in sync with MulterModule, ListingsController, main bootstrap. */
export const LISTING_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Max JSON body for `POST /api/listing/analyze` (8 base64 photos ≈ 4/3 × raw size each).
 * Express default (~100kb) rejects typical camera JPEGs and surfaces as a generic 500.
 */
export const LISTING_ANALYZE_JSON_MAX_BYTES =
  Math.ceil(LISTING_PHOTO_MAX_BYTES * 8 * (4 / 3)) + 64 * 1024;

const allowedImageMimes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const listingPhotoFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  const mime = (file.mimetype || '').toLowerCase();
  if (!allowedImageMimes.has(mime)) {
    // Multer overload: (error: Error) or (null, acceptFile) — not (Error, false).
    cb(
      new BadRequestException(
        `Unsupported image type: ${file.mimetype}. Use JPEG, PNG, WebP, or HEIC.`,
      ),
    );
    return;
  }
  cb(null, true);
};

/** Options for `POST /v1/listings/snap-to-list` (memory storage + type guard). */
export const listingPhotoMulterOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: LISTING_PHOTO_MAX_BYTES,
    files: 1,
  },
  fileFilter: listingPhotoFileFilter,
};
