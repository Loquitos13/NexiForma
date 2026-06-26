/*
  Warnings:

  - A unique constraint covering the columns `[matricula_id]` on the table `certificados_verificacao` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "certificados_verificacao_tenant_id_matricula_id_key";

-- AlterTable
ALTER TABLE "avaliacoes_formando" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "certificados_verificacao" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "documentos_anexo" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "propostas_comerciais" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quiz_perguntas" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quiz_tentativas" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rgpd_pedidos" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sigo_submissoes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenant_integracoes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "certificados_verificacao_matricula_id_key" ON "certificados_verificacao"("matricula_id");

-- AddForeignKey
ALTER TABLE "quiz_perguntas" ADD CONSTRAINT "quiz_perguntas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_tentativas" ADD CONSTRAINT "quiz_tentativas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sigo_submissoes" ADD CONSTRAINT "sigo_submissoes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rgpd_pedidos" ADD CONSTRAINT "rgpd_pedidos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_anexo" ADD CONSTRAINT "documentos_anexo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_formando" ADD CONSTRAINT "avaliacoes_formando_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "avaliacoes_formando_tenant_matricula_idx" RENAME TO "avaliacoes_formando_tenant_id_matricula_id_idx";

-- RenameIndex
ALTER INDEX "documentos_anexo_tenant_idx" RENAME TO "documentos_anexo_tenant_id_idx";

-- RenameIndex
ALTER INDEX "quiz_perguntas_tenant_modulo_idx" RENAME TO "quiz_perguntas_tenant_id_modulo_id_idx";

-- RenameIndex
ALTER INDEX "quiz_tentativas_tenant_matricula_idx" RENAME TO "quiz_tentativas_tenant_id_matricula_id_idx";

-- RenameIndex
ALTER INDEX "rgpd_pedidos_tenant_idx" RENAME TO "rgpd_pedidos_tenant_id_idx";

-- RenameIndex
ALTER INDEX "sigo_submissoes_tenant_acao_idx" RENAME TO "sigo_submissoes_tenant_id_acao_formacao_id_idx";
