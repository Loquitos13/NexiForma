-- Migrar papéis legados para os novos coordenadores (após commit dos ADD VALUE).
UPDATE "public"."users"
SET "role" = 'COORDENADOR_PEDAGOGICO'
WHERE "role" = 'COORDENADOR';

UPDATE "public"."users"
SET "role" = 'COORDENADOR_FINANCEIRO'
WHERE "role" = 'FINANCEIRO';
