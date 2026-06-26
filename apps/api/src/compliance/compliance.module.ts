import { Module } from "@nestjs/common";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";
import { ComplianceAlertasService } from "./compliance-alertas.service";

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceAlertasService],
  exports: [ComplianceService, ComplianceAlertasService],
})
export class ComplianceModule {}
