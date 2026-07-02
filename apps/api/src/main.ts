import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
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
    }),
  );
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : ["http://localhost:3000"];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`NexiForma API em http://localhost:${port}/${API_PREFIX}`);
}

void bootstrap();
