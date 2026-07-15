-- NexiForma – Row Level Security (aplicar manualmente após migrate em produção)
-- Requer: SET app.tenant_id por pedido (ver apps/api/src/prisma/tenant-rls.interceptor.ts)
-- A API deve ligar com role app_tenant (não superuser) em produção.

DO $$ BEGIN
  CREATE ROLE app_tenant NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE app_control_plane NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO app_tenant;
GRANT USAGE ON SCHEMA control_plane TO app_tenant, app_control_plane;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA control_plane TO app_control_plane;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant;

ALTER DEFAULT PRIVILEGES IN SCHEMA control_plane
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_control_plane;

-- Função helper: lê tenant da sessão (set_config com is_local=false na API)
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', false), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Todas as tabelas public com tenant_id NOT NULL
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tbl
      ON tbl.table_schema = c.table_schema AND tbl.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND c.is_nullable = 'NO'
      AND tbl.table_type = 'BASE TABLE'
    ORDER BY c.table_name
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I FOR ALL TO app_tenant '
      || 'USING (tenant_id = public.current_tenant_id()) '
      || 'WITH CHECK (tenant_id = public.current_tenant_id())',
      t
    );
  END LOOP;
END $$;

-- control_plane.tenants: tenant só vê o próprio registo
ALTER TABLE control_plane.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_plane.tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_self ON control_plane.tenants;
CREATE POLICY tenant_self ON control_plane.tenants
  FOR SELECT TO app_tenant
  USING (id = public.current_tenant_id());

-- control_plane: chaves e subscrições limitadas ao tenant activo
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['tenant_subscriptions', 'tenant_subscription_keys', 'tenant_health_checks'])
  LOOP
    EXECUTE format('ALTER TABLE control_plane.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE control_plane.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON control_plane.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON control_plane.%I FOR ALL TO app_tenant '
      || 'USING (tenant_id = public.current_tenant_id()) '
      || 'WITH CHECK (tenant_id = public.current_tenant_id())',
      t
    );
  END LOOP;
END $$;

-- Dev local: utilizador docker pode assumir app_tenant
DO $$ BEGIN
  GRANT app_tenant TO nexiforma;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
