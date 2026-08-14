import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SigoModule } from "../sigo/sigo.module";
import { ViesController } from "./vies.controller";
import { ViesService } from "./vies.service";

/**
 * Confirmação NIF no servidor (create + feedback UI).
 * A API key NIF.PT nunca é enviada ao browser.
 */
@Module({
  imports: [PrismaModule, forwardRef(() => SigoModule)],
  controllers: [ViesController],
  providers: [ViesService],
  exports: [ViesService],
})
export class ViesModule {}
