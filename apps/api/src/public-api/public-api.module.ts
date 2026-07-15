import { Module } from "@nestjs/common";
import { FormacoesModule } from "../formacoes/formacoes.module";
import { CrmModule } from "../crm/crm.module";
import { PublicApiController } from "./public-api.controller";
import { PublicFormacoesController } from "./public-formacoes.controller";
import { PublicLeadsController } from "./public-leads.controller";
import { ApiKeyGuard } from "./api-key.guard";

@Module({
  imports: [FormacoesModule, CrmModule],
  controllers: [PublicApiController, PublicFormacoesController, PublicLeadsController],
  providers: [ApiKeyGuard],
})
export class PublicApiModule {}
