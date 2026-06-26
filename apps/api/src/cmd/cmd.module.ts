import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CmdController } from "./cmd.controller";
import { CmdSignatureService } from "./cmd-signature.service";

@Module({
  imports: [AuditModule],
  controllers: [CmdController],
  providers: [CmdSignatureService],
  exports: [CmdSignatureService],
})
export class CmdModule {}
