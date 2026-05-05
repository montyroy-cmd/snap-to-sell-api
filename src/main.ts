import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import {
  LISTING_ANALYZE_JSON_MAX_BYTES,
  LISTING_PHOTO_MAX_BYTES,
} from './config/multer.config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.use(express.json({ limit: LISTING_ANALYZE_JSON_MAX_BYTES }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: LISTING_ANALYZE_JSON_MAX_BYTES,
    }),
  );
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const config = app.get(ConfigService);

  // Azure App Service sits behind a reverse proxy; needed for correct URLs and client IPs.
  if (process.env.WEBSITE_SITE_NAME) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

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
    if (req.method !== 'GET') {
      next();
      return;
    }
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

  // Multipart: `MulterModule.register` in AppModule + `FileInterceptor` options in ListingsController (memory, same size cap).
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

  const portRaw = process.env.PORT ?? config.get<number>('port') ?? 3000;
  const port =
    typeof portRaw === 'string'
      ? Number.parseInt(portRaw, 10)
      : Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${String(portRaw)}`);
  }

  new Logger('Bootstrap').log(`Starting server on port: ${port}`);
  await app.listen(port);
}
void bootstrap();
