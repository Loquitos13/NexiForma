import { Module } from "@nestjs/common";
import { PublicApiController } from "./public-api.controller";
import { ApiKeyGuard } from "./api-key.guard";

@Module({
  controllers: [PublicApiController],
  providers: [ApiKeyGuard],
})
export class PublicApiModule {}
