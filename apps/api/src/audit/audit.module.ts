import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { DocumentAccessAuditService } from "./document-access-audit.service";

@Global()
@Module({
  providers: [AuditService, DocumentAccessAuditService],
  exports: [AuditService, DocumentAccessAuditService],
})
export class AuditModule {}
