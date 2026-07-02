import { Module } from "@nestjs/common";
import { FormacoesModule } from "../formacoes/formacoes.module";
import { PublicApiController } from "./public-api.controller";
import { PublicFormacoesController } from "./public-formacoes.controller";
import { ApiKeyGuard } from "./api-key.guard";

@Module({
  imports: [FormacoesModule],
  controllers: [PublicApiController, PublicFormacoesController],
  providers: [ApiKeyGuard],
})
export class PublicApiModule {}
