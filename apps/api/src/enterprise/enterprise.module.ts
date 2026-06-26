import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantApiKeysController } from "./tenant-api-keys.controller";
import { TenantApiKeysService } from "./tenant-api-keys.service";
import { TenantSsoController } from "./tenant-sso.controller";
import { TenantSsoService } from "./tenant-sso.service";

@Module({
  imports: [AuthModule],
  controllers: [TenantApiKeysController, TenantSsoController],
  providers: [TenantApiKeysService, TenantSsoService],
})
export class EnterpriseModule {}
