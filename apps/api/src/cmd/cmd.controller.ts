import { Body, Controller, Get, Post } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { CmdSignatureService } from "./cmd-signature.service";
import { ConfirmarCmdDto } from "./dto/confirmar-cmd.dto";

@Public()
@Controller("cmd")
export class CmdController {
  constructor(private readonly cmd: CmdSignatureService) {}

  @Get("config")
  config() {
    return this.cmd.getConfig();
  }

  /** Confirmação pública após autenticação OAuth CMD (callback Autenticação.gov.pt). */
  @Post("assinar/confirmar")
  confirmar(@Body() dto: ConfirmarCmdDto) {
    return this.cmd.confirmarAssinatura(dto);
  }
}
