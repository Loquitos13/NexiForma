-- Estado EXPIRED para chaves de acesso tenant (valor enum — UPDATE numa migração seguinte por limitação PG)

ALTER TYPE "control_plane"."TenantAccessKeyStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
