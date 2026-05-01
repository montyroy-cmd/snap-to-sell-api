import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private key: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const b64 = this.config.get<string>('cookieEncryptionKeyB64');
    if (b64) {
      const buf = Buffer.from(b64, 'base64');
      if (buf.length !== KEY_LENGTH) {
        this.logger.warn(
          `COOKIE_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes when base64-decoded; encryption disabled until fixed`,
        );
        return;
      }
      this.key = buf;
    } else {
      this.logger.warn(
        'COOKIE_ENCRYPTION_KEY not set; encrypt/decrypt will throw if used',
      );
    }
  }

  encrypt(plaintext: string): string {
    const k = this.requireKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, k, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64url');
  }

  decrypt(payload: string): string {
    const k = this.requireKey();
    const buf = Buffer.from(payload, 'base64url');
    if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid ciphertext');
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      'utf8',
    );
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new Error('Encryption key not configured');
    }
    return this.key;
  }
}
