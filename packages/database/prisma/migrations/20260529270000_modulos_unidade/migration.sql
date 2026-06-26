-- Unidades formativas (módulos do percurso) com conteúdos agrupados
CREATE TABLE "modulos_unidade" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "curso_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modulos_unidade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "modulos_unidade_tenant_id_curso_id_idx" ON "modulos_unidade"("tenant_id", "curso_id");

ALTER TABLE "modulos_unidade" ADD CONSTRAINT "modulos_unidade_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "modulos_unidade" ADD CONSTRAINT "modulos_unidade_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "modulos_conteudo" ADD COLUMN "modulo_unidade_id" UUID;

ALTER TABLE "modulos_conteudo" ADD CONSTRAINT "modulos_conteudo_modulo_unidade_id_fkey" FOREIGN KEY ("modulo_unidade_id") REFERENCES "modulos_unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "modulos_conteudo_modulo_unidade_id_idx" ON "modulos_conteudo"("modulo_unidade_id");
