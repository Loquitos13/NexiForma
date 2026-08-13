import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";
import { ComplianceAlertasService } from "./compliance-alertas.service";

@Module({
  imports: [AuditModule],
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceAlertasService],
  exports: [ComplianceService, ComplianceAlertasService],
})
export class ComplianceModule {}
