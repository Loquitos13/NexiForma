-- Índices para catálogo público / website (consultas por tenant + publicado)

CREATE INDEX IF NOT EXISTS "cursos_tenant_publicado_idx"
  ON "public"."cursos" ("tenant_id", "publicado")
  WHERE "publicado" = true;

CREATE INDEX IF NOT EXISTS "cursos_tenant_codigo_publico_idx"
  ON "public"."cursos" ("tenant_id", "codigo_publico");

CREATE INDEX IF NOT EXISTS "acoes_formacao_tenant_publicado_idx"
  ON "public"."acoes_formacao" ("tenant_id", "publicado")
  WHERE "publicado" = true;

CREATE INDEX IF NOT EXISTS "acoes_formacao_tenant_curso_idx"
  ON "public"."acoes_formacao" ("tenant_id", "curso_id");

CREATE INDEX IF NOT EXISTS "acoes_formacao_curso_publicado_idx"
  ON "public"."acoes_formacao" ("curso_id", "publicado")
  WHERE "publicado" = true;
