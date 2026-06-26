-- Fase 3: conteúdos LMS e progresso por matrícula
CREATE TYPE "ModuloConteudoTipo" AS ENUM ('VIDEO', 'PDF', 'SCORM', 'TEXTO', 'QUIZ');

CREATE TABLE "modulos_conteudo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "curso_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "ModuloConteudoTipo" NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "url_ou_ref" TEXT,
    "conteudo_html" TEXT,
    "duracao_min" INTEGER,
    "metadata" JSONB,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modulos_conteudo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progressos_modulo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "matricula_id" UUID NOT NULL,
    "modulo_id" UUID NOT NULL,
    "percentual" INTEGER NOT NULL DEFAULT 0,
    "pontuacao" INTEGER,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "concluido_em" TIMESTAMP(3),
    "ultima_visita" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progressos_modulo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "modulos_conteudo_tenant_id_curso_id_idx" ON "modulos_conteudo"("tenant_id", "curso_id");
CREATE INDEX "progressos_modulo_tenant_id_matricula_id_idx" ON "progressos_modulo"("tenant_id", "matricula_id");
CREATE UNIQUE INDEX "progressos_modulo_matricula_id_modulo_id_key" ON "progressos_modulo"("matricula_id", "modulo_id");

ALTER TABLE "modulos_conteudo" ADD CONSTRAINT "modulos_conteudo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "modulos_conteudo" ADD CONSTRAINT "modulos_conteudo_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "progressos_modulo" ADD CONSTRAINT "progressos_modulo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progressos_modulo" ADD CONSTRAINT "progressos_modulo_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progressos_modulo" ADD CONSTRAINT "progressos_modulo_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos_conteudo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
