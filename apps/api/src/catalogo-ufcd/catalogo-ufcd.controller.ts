import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CatalogoUfcdService } from "./catalogo-ufcd.service";

@Controller("catalogo-ufcd")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogoUfcdController {
  constructor(private readonly catalogo: CatalogoUfcdService) {}

  @Get("fontes")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  fontes() {
    return this.catalogo.fontes();
  }

  @Get()
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  search(@Query("q") q?: string, @Query("limit") limit?: string) {
    return this.catalogo.search(q, limit ? Number(limit) : 50);
  }

  @Post("import")
  @Roles("tenant_manager", "coordenador_pedagogico")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 12 * 1024 * 1024 } }))
  importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Query("deactivateMissing") deactivateMissing?: string,
  ) {
    return this.catalogo.importFromFile(file, {
      deactivateMissing: deactivateMissing === "1" || deactivateMissing === "true",
    });
  }

  @Post("import/json")
  @Roles("tenant_manager", "coordenador_pedagogico")
  importJson(@Body() body: unknown) {
    return this.catalogo.importFromJson(body);
  }

  @Post("delete")
  @Roles("tenant_manager", "coordenador_pedagogico")
  deleteMany(@Body() body: { codigos?: unknown }) {
    return this.catalogo.deleteMany(body?.codigos);
  }

  @Get("validar/curso/:codigo")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  validateCurso(@CurrentUser() user: RequestUser, @Param("codigo") codigo: string) {
    return this.catalogo.validateForCurso(user, codigo);
  }

  @Get("validar/sigo/:acaoId")
  @Roles("tenant_manager", "coordenador_pedagogico")
  validateSigo(@CurrentUser() user: RequestUser, @Param("acaoId") acaoId: string) {
    return this.catalogo.validateForSigo(user, acaoId);
  }

  @Get(":codigo")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  getOne(@Param("codigo") codigo: string) {
    return this.catalogo.getOne(codigo);
  }
}
