import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('supabase.url');
    const key = this.config.get<string>('supabase.serviceRoleKey');
    if (url && key) {
      this.client = createClient(url, key, { auth: { persistSession: false } });
    }
  }

  /**
   * Upload listing photo to Supabase Storage; returns public URL when bucket is public, else signed URL path info.
   */
  async uploadListingPhoto(
    buffer: Buffer,
    mimeType: string,
    profileId: string,
  ): Promise<{ path: string; publicUrl: string }> {
    const bucket =
      this.config.get<string>('supabase.listingsBucket') ?? 'listings';
    const ext = mimeType.includes('png')
      ? 'png'
      : mimeType.includes('webp')
        ? 'webp'
        : 'jpg';
    const path = `${profileId}/${randomUUID()}.${ext}`;

    if (!this.client) {
      this.logger.warn(
        'Supabase not configured; returning placeholder path only',
      );
      return { path, publicUrl: `local://${path}` };
    }

    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: mimeType || 'image/jpeg',
        upsert: false,
      });
    if (error) {
      this.logger.error(`Storage upload failed: ${error.message}`);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const base =
      this.config.get<string>('supabase.url')?.replace(/\/$/, '') ?? '';
    const publicUrl = `${base}/storage/v1/object/public/${bucket}/${path}`;
    return { path, publicUrl };
  }
}
