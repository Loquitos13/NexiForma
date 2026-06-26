import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { PortalController } from "./portal.controller";
import { PortalService } from "./portal.service";
import { TenantSettingsService } from "./tenant-settings.service";

@Module({
  imports: [StorageModule],
  controllers: [PortalController],
  providers: [PortalService, TenantSettingsService],
  exports: [TenantSettingsService],
})
export class PortalModule {}
