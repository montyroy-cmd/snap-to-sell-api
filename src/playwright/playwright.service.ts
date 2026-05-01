import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import { chromium, type Browser, type Page } from 'playwright';

const HUMAN_DELAY_MS = { min: 400, max: 1200 };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function humanDelay(): Promise<void> {
  const ms = Math.floor(
    Math.random() * (HUMAN_DELAY_MS.max - HUMAN_DELAY_MS.min) +
      HUMAN_DELAY_MS.min,
  );
  return sleep(ms);
}

/**
 * Playwright automation for Mercari & OfferUp.
 * Session cookies should be injected via BrowserContext; store encrypted at rest using EncryptionService.
 */
@Injectable()
export class PlaywrightService implements OnModuleDestroy {
  private readonly logger = new Logger(PlaywrightService.name);
  private browser: Browser | null = null;

  async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async withSession<T>(
    marketplace: Marketplace,
    storageStateJson: string | null,
    fn: (page: Page) => Promise<T>,
  ): Promise<T> {
    const browser = await this.getBrowser();
    const contextOptions: Parameters<Browser['newContext']>[0] = {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    };
    if (storageStateJson) {
      try {
        contextOptions.storageState = JSON.parse(
          storageStateJson,
        ) as NonNullable<Parameters<Browser['newContext']>[0]>['storageState'];
      } catch {
        this.logger.warn(
          'Invalid storage state JSON; proceeding without session',
        );
      }
    }
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    try {
      await humanDelay();
      return await fn(page);
    } finally {
      await context.close();
    }
  }

  /**
   * Placeholder: navigate to listing flow. Replace selectors with real marketplace flows.
   */
  async createListingPlaceholder(
    marketplace: Marketplace,
    storageStateJson: string | null,
    listingPayload: { title: string; description: string; price: number },
  ): Promise<{ ok: boolean; externalId?: string }> {
    this.logger.log(
      `Playwright createListing placeholder for ${marketplace}: ${listingPayload.title}`,
    );
    return this.withSession(marketplace, storageStateJson, async (page) => {
      await humanDelay();
      if (marketplace === 'mercari') {
        await page.goto('https://www.mercari.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
      } else if (marketplace === 'offerup') {
        await page.goto('https://offerup.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
      }
      await humanDelay();
      return { ok: true, externalId: `sim_${Date.now()}` };
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
