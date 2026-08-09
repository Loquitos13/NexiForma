import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { StorageModule } from "../storage/storage.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CognitoAuthService } from "./cognito-auth.service";
import { SocialAuthController } from "./social-auth.controller";
import { SocialAuthService } from "./social-auth.service";
import { MfaService } from "./mfa.service";
import { GlobalJwtAuthGuard } from "./guards/global-jwt-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { parseJwtExpirySeconds } from "./jwt-expiry";
import { LoginAttemptLimiterService } from "./login-attempt-limiter.service";
import { EmailConfirmationService } from "./email-confirmation.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Global()
@Module({
  imports: [
    ConfigModule,
    StorageModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: parseJwtExpirySeconds(cfg.get<string>("JWT_EXPIRES") ?? "60m"),
        },
      }),
    }),
  ],
  controllers: [AuthController, SocialAuthController],
  providers: [
    AuthService,
    MfaService,
    CognitoAuthService,
    SocialAuthService,
    LoginAttemptLimiterService,
    EmailConfirmationService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    GlobalJwtAuthGuard,
    { provide: APP_GUARD, useClass: GlobalJwtAuthGuard },
  ],
  exports: [
    AuthService,
    SocialAuthService,
    JwtModule,
    GlobalJwtAuthGuard,
    LoginAttemptLimiterService,
    EmailConfirmationService,
  ],
})
export class AuthModule {}
