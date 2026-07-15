import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { API_PREFIX } from "@nexiforma/shared";
import { AppModule } from "./app.module";
import { validateProductionConfig } from "./config/production-config";
import { PlatformAlertasService } from "./notificacoes/platform-alertas.service";

function reportProcessError(
  alertas: PlatformAlertasService,
  origem: string,
  err: unknown,
) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  void alertas
    .notificarErroServidor({
      modulo: origem,
      resumo: message,
      stack,
    })
    .catch(() => undefined);
}

async function bootstrap() {
  validateProductionConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const platformAlertas = app.get(PlatformAlertasService);
  process.on("unhandledRejection", (reason) => {
    reportProcessError(platformAlertas, "processo-unhandledRejection", reason);
  });
  process.on("uncaughtException", (err) => {
    reportProcessError(platformAlertas, "processo-uncaughtException", err);
  });
  if (process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
  }
  app.setGlobalPrefix(API_PREFIX);

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      strictTransportSecurity:
        process.env.NODE_ENV === "production"
          ? { maxAge: 63_072_000, includeSubDomains: true, preload: true }
          : false,
    }),
  );
  app.use(cookieParser());

  if (process.env.NODE_ENV !== "production") {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api/")) {
        const web =
          process.env.APP_PUBLIC_URL?.replace(/\/$/, "") ??
          `http://localhost:${process.env.WEB_PORT ?? "3000"}`;
        res.status(404).json({
          message:
            `Rota BFF (${req.path}) - use a aplicação Web em ${web}, não a API nesta porta.`,
          hint: "Login: /login · Auth BFF: /api/auth/* · API REST: /v1/*",
        });
        return;
      }
      next();
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const defaultWebOrigin =
    process.env.APP_PUBLIC_URL?.replace(/\/$/, "") ??
    `http://localhost:${process.env.WEB_PORT ?? "3000"}`;

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : [defaultWebOrigin];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = Number(process.env.API_PORT ?? 4000);
  const host = process.env.DEV_BIND_HOST ?? "0.0.0.0";
  await app.listen(port, host);
  const lanIp = process.env.DEV_LAN_IP?.trim();
  // eslint-disable-next-line no-console
  console.log(`NexiForma API em http://localhost:${port}/${API_PREFIX} (bind ${host})`);
  if (lanIp) {
    // eslint-disable-next-line no-console
    console.log(`NexiForma API rede: http://${lanIp}:${port}/${API_PREFIX}`);
  }
}

void bootstrap();
