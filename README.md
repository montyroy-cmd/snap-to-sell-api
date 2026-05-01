# Sell Seva Backend (`sell-seva-backend`)

Production-ready [NestJS](https://nestjs.com/) API for **Sell Seva / Snap-to-Sell**: snap a photo in the Flutter app, get AI-assisted pricing and copy, cross-list to multiple marketplaces (Mercari, OfferUp, eBay, Poshmark, Etsy, Facebook Marketplace), with auto-delist hooks, messaging, offers, inventory-oriented workers, and analytics.

## Requirements

- **Node.js** 20+
- **Redis** (BullMQ queues + Playwright rate limiting)
- **Supabase** project (Postgres + Auth + Storage)
- Optional: **Playwright** browsers (`npx playwright install chromium`) for Mercari/OfferUp automation workers

## Quick start

1. Copy environment template and fill values:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure **two** Postgres URLs in `.env` (see [Supabase connection pooling](https://supabase.com/docs/guides/database/connecting-to-postgres)):

   - `DATABASE_URL` — PgBouncer pooler (often port `6543`, add `?pgbouncer=true` if required).
   - `DIRECT_URL` — direct connection for migrations (often port `5432`).

4. Create and apply the schema:

   ```bash
   npx prisma migrate dev --name init
   ```

5. In Supabase: create a **public** (or signed URL–compatible) Storage bucket named like `listings` (override with `SUPABASE_LISTINGS_BUCKET`). Enable **RLS** on all public tables and add policies so `auth.uid()` aligns with `profiles.user_id` (application uses Prisma with `DATABASE_URL`; RLS still protects direct SQL access).

6. Start Redis, then the API:

   ```bash
   npm run start:dev
   ```

7. Open **Swagger UI**: [http://localhost:3000/v1/swagger/index.html](http://localhost:3000/v1/swagger/index.html) (a `GET` to [http://localhost:3000/docs](http://localhost:3000/docs) or [http://localhost:3000/v1/docs](http://localhost:3000/v1/docs) redirects there).  
   HTTP API base path: **`/v1`** (e.g. `GET /v1/health`).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run start:dev` | Dev server with reload |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run compiled app |
| `npm run prisma:generate` | Regenerate Prisma Client |
| `npm run prisma:migrate` | Create/apply migrations (dev) |
| `npm run prisma:studio` | Prisma Studio |
| `npm test` | Unit tests |

## Architecture (high level)

- **Auth**: Supabase Auth (email/password) via REST; Nest verifies **JWT** with `SUPABASE_JWT_SECRET` and attaches `profiles` for ownership checks.
- **Social login**: Typically handled in the Flutter app with Supabase SDK; the API accepts the same JWT once the user exists in `auth.users` and has a `profiles` row (created on signup/login).
- **Encryption**: Marketplace session payloads are stored with **AES-256-GCM** (`COOKIE_ENCRYPTION_KEY`, 32-byte key base64-encoded).
- **Queues**: **BullMQ** workers — `MessageSyncWorker`, `PlaywrightWorker`, `AutoDelistWorker`, `OfferSenderWorker`, `InventoryImportWorker` (see `src/workers/`).
- **Rate limits**: Global **Throttler** (per authenticated user when JWT ran) + **5 ops / minute / user / Playwright marketplace** (`mercari`, `offerup`) via Redis (`rate-limiter-flexible`).
- **Realtime**: WebSocket namespace **`/ws/messages`** (Socket.IO). Pass `auth.token` (JWT) from the client; tighten verification in production as needed.

## API envelope

Successful responses are wrapped by a global interceptor:

```json
{
  "success": true,
  "data": {},
  "message": "",
  "error": null
}
```

Errors are normalized by the global exception filter with `success: false` and an `error` object.

## Notable endpoints (all under `/v1`)

| Area | Method & path |
|------|----------------|
| Health | `GET /v1/health` |
| Auth | `POST /v1/auth/signup`, `POST /v1/auth/login`, `POST /v1/auth/refresh-token`, `POST /v1/auth/connect-marketplace/:platform` |
| Listings | `POST /v1/listings/snap-to-list` (multipart `photo` + `description`), CRUD, `POST /v1/listings/import-from-marketplaces` |
| Marketplaces | `POST /v1/marketplaces/:platform/create-listing`, `update-quantity`, `delist` |
| Auto-delist | `POST /v1/webhooks/sale-detected` (header `x-webhook-secret` when `SALE_WEBHOOK_SECRET` is set in production), `POST /v1/auto-delist/process-sale` |
| Messaging | `GET /v1/messages/inbox`, `GET /v1/messages/conversation/:id`, `POST /v1/messages/reply`, WS `/ws/messages` |
| Offers | `GET/POST /v1/offers/rules`, `POST /v1/offers/send-auto-offers` |
| Analytics | `GET /v1/analytics/summary`, `GET /v1/analytics/sales-report` |

## Production checklist

- Set strong `SUPABASE_JWT_SECRET`, `COOKIE_ENCRYPTION_KEY`, `SALE_WEBHOOK_SECRET`, and restrict `ALLOWED_ORIGINS`.
- Run the API behind HTTPS; keep **Helmet** and strict CORS.
- Use a managed Redis; tune BullMQ concurrency per worker host.
- Replace Playwright placeholders in `PlaywrightService` / processors with real flows and selectors; respect marketplace terms of service.

## License

Private / UNLICENSED (see `package.json`).
