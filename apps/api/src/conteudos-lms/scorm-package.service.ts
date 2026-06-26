import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";
import type { ModuloConteudo } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormadorScopeService } from "../common/formador-scope.service";
import { requireTenantId } from "../common/tenant-scope";

type ScormPackageMeta = {
  scormVersion: "1.2" | "2004";
  storagePrefix: string;
  launchFile: string;
  launchUrl: string;
  uploadedAt: string;
};

@Injectable()
export class ScormPackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly formadorScope: FormadorScopeService,
  ) {}

  async uploadPackage(
    user: RequestUser,
    cursoId: string,
    titulo: string,
    file: Express.Multer.File,
  ): Promise<ModuloConteudo> {
    const tenantId = requireTenantId(user);
    await this.formadorScope.assertCanEditCurso(user, cursoId);
    if (!file?.buffer?.byteLength) {
      throw new BadRequestException("Ficheiro ZIP em falta.");
    }
    if (!file.originalname.toLowerCase().endsWith(".zip")) {
      throw new BadRequestException("Pacote SCORM deve ser um ficheiro .zip.");
    }

    const curso = await this.prisma.curso.findFirst({ where: { id: cursoId, tenantId } });
    if (!curso) {
      throw new NotFoundException("Curso não encontrado.");
    }

    const zip = new AdmZip(file.buffer);
    const manifestEntry = zip
      .getEntries()
      .find((e) => !e.isDirectory && /imsmanifest\.xml$/i.test(e.entryName));
    if (!manifestEntry) {
      throw new BadRequestException("ZIP inválido – imsmanifest.xml não encontrado.");
    }

    const manifestXml = manifestEntry.getData().toString("utf8");
    const launchFile = this.resolveLaunchFile(manifestXml, manifestEntry.entryName);
    const scormVersion = /2004|1\.3|cam1\.3/i.test(manifestXml) ? "2004" : "1.2";

    const moduloId = randomUUID();
    const storagePrefix = `${tenantId}/scorm/${cursoId}/${moduloId}`;

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const rel = entry.entryName.replace(/\\/g, "/");
      const key = `${storagePrefix}/${rel}`;
      await this.storage.putObject(key, entry.getData(), this.storage.guessContentType(rel));
    }

    const count = await this.prisma.moduloConteudo.count({ where: { tenantId, cursoId } });
    const launchUrl = `${this.storage.scormAssetBaseUrl(moduloId)}/${launchFile.split("/").map(encodeURIComponent).join("/")}`;
    const metadata: ScormPackageMeta = {
      scormVersion,
      storagePrefix,
      launchFile,
      launchUrl,
      uploadedAt: new Date().toISOString(),
    };

    return this.prisma.moduloConteudo.create({
      data: {
        id: moduloId,
        tenantId,
        cursoId,
        titulo: titulo.trim(),
        tipo: "SCORM",
        ordem: count,
        urlOuRef: launchUrl,
        publicado: true,
        metadata,
      },
    });
  }

  async readAsset(moduloId: string, tenantId: string, relativePath: string) {
    const modulo = await this.prisma.moduloConteudo.findFirst({
      where: { id: moduloId, tenantId, tipo: "SCORM" },
    });
    if (!modulo) {
      throw new NotFoundException("Módulo SCORM não encontrado.");
    }
    const meta = (modulo.metadata ?? {}) as ScormPackageMeta;
    if (!meta.storagePrefix) {
      throw new NotFoundException("Pacote SCORM não alojado.");
    }
    const key = `${meta.storagePrefix}/${relativePath}`;
    const obj = await this.storage.getObject(key);
    if (!obj) {
      throw new NotFoundException("Asset SCORM não encontrado.");
    }
    return obj;
  }

  private resolveLaunchFile(manifestXml: string, manifestPath: string): string {
    const baseDir = manifestPath.includes("/")
      ? manifestPath.slice(0, manifestPath.lastIndexOf("/") + 1)
      : "";

    const resourceHref =
      manifestXml.match(/<resource[^>]+href="([^"]+)"/i)?.[1] ??
      manifestXml.match(/<resource[^>]+adlcp:scormtype="sco"[^>]+href="([^"]+)"/i)?.[1];

    if (!resourceHref) {
      throw new BadRequestException("imsmanifest.xml sem resource href.");
    }

    const combined = `${baseDir}${resourceHref}`.replace(/\\/g, "/");
    return combined.replace(/\/+/g, "/").replace(/^\.\//, "");
  }
}
