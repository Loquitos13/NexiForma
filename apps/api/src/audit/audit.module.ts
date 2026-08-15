import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { DocumentAccessAuditService } from "./document-access-audit.service";
import { ExternalServiceEventService } from "../common/external-service-event.service";

@Global()
@Module({
  providers: [AuditService, DocumentAccessAuditService, ExternalServiceEventService],
  exports: [AuditService, DocumentAccessAuditService, ExternalServiceEventService],
})
export class AuditModule {}
