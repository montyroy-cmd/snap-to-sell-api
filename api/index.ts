import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import * as swaggerUiDist from 'swagger-ui-dist';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import {
  LISTING_ANALYZE_JSON_MAX_BYTES,
  LISTING_PHOTO_MAX_BYTES,
} from '../src/config/multer.config';
import { AppVercelModule } from '../src/app-vercel.module';

let cachedHandler:
  | ((req: Request, res: Response) => Promise<void> | void)
  | undefined;

async function buildHandler() {
  const server = express();
  server.use(express.json({ limit: LISTING_ANALYZE_JSON_MAX_BYTES }));
  server.use(
    express.urlencoded({
      extended: true,
      limit: LISTING_ANALYZE_JSON_MAX_BYTES,
    }),
  );
  const adapter = new ExpressAdapter(server);

  const app = await NestFactory.create(AppVercelModule, adapter, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const config = app.get(ConfigService);

  // Keep parity with `src/main.ts` runtime config
  app.setGlobalPrefix('v1', {
    exclude: [{ path: 'api/listing/analyze', method: RequestMethod.POST }],
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'https://cdn.jsdelivr.net',
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
          connectSrc: ["'self'"],
        },
      },
    }),
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();
    if (req.path === '/docs' || req.path === '/v1/docs') {
      res.redirect(302, '/v1/swagger/index.html');
      return;
    }
    next();
  });
  app.enableCors({
    origin: config.get<string[]>('allowedOrigins') ?? true,
    credentials: true,
  });

  new Logger('Bootstrap').log(
    `Listing photo uploads (snap-to-list): memory storage, max ${LISTING_PHOTO_MAX_BYTES} bytes (MulterModule in AppModule; FileInterceptor in ListingsController)`,
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Sell Seva / Snap-to-Sell API')
    .setDescription(
      'Unified reseller platform: snap-to-list, crosslisting, auto-delist, messaging, offers, analytics.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'Paste only the access_token from login (no "Bearer " prefix — Swagger adds it).',
    })
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('swagger', app, document, { useGlobalPrefix: true });

  // Vercel/Nest 11: the generated Swagger index references `./swagger/*` assets.
  // Serve swagger-ui-dist under `/v1/swagger/swagger/*` to satisfy those requests.
  server.use(
    '/v1/swagger/swagger',
    express.static(swaggerUiDist.getAbsoluteFSPath()),
  );

  await app.init();

  return (req: Request, res: Response) => server(req, res);
}

export default async function handler(req: Request, res: Response) {
  if (!cachedHandler) {
    cachedHandler = await buildHandler();
  }
  return cachedHandler(req, res);
}

