-- Novos valores de enum (devem ser commitados antes do UPDATE - ver migration seguinte).
ALTER TYPE "public"."TenantUserRole" ADD VALUE IF NOT EXISTS 'COORDENADOR_COMERCIAL';
ALTER TYPE "public"."TenantUserRole" ADD VALUE IF NOT EXISTS 'COORDENADOR_PEDAGOGICO';
ALTER TYPE "public"."TenantUserRole" ADD VALUE IF NOT EXISTS 'COORDENADOR_FINANCEIRO';
