import { Module } from "@nestjs/common";
import { CatalogoUfcdController } from "./catalogo-ufcd.controller";
import { CatalogoUfcdService } from "./catalogo-ufcd.service";

@Module({
  controllers: [CatalogoUfcdController],
  providers: [CatalogoUfcdService],
  exports: [CatalogoUfcdService],
})
export class CatalogoUfcdModule {}
