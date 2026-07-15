import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CognitoAuthService } from "./cognito-auth.service";
import { MfaService } from "./mfa.service";
import { GlobalJwtAuthGuard } from "./guards/global-jwt-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { parseJwtExpirySeconds } from "./jwt-expiry";
import { LoginAttemptLimiterService } from "./login-attempt-limiter.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Global()
@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: parseJwtExpirySeconds(cfg.get<string>("JWT_EXPIRES") ?? "15m"),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MfaService,
    CognitoAuthService,
    LoginAttemptLimiterService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    GlobalJwtAuthGuard,
    { provide: APP_GUARD, useClass: GlobalJwtAuthGuard },
  ],
  exports: [AuthService, JwtModule, GlobalJwtAuthGuard],
})
export class AuthModule {}
