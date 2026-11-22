import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ACCESS_TOKEN_COOKIE } from './auth/auth.constants';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Applied by both main.ts and the e2e tests so tests exercise the exact
 * production pipeline (validation, error shape, cookies, security headers).
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.use(
    helmet({
      // Swagger UI is served over plain HTTP locally; upgrading its asset requests
      // to HTTPS would break it. Real deployments terminate TLS in front of the API.
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    }),
  );
  app.use(cookieParser());

  const origins = (config.get<string>('CORS_ORIGIN') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length > 0) {
    app.enableCors({ origin: origins, credentials: true });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // ...and reject them, so typos don't silently vanish
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SimpleInvoice API')
    .setDescription(
      'REST API for SimpleInvoice. Authenticate via POST /auth/login, then click "Authorize" and paste the accessToken.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth(ACCESS_TOKEN_COOKIE)
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}
