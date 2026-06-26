-- NexiForma – Row Level Security (aplicar manualmente após migrate em produção)
-- Requer: SET app.tenant_id = '<uuid>' por pedido (ver apps/api/src/prisma/tenant-context.ts)

-- Roles de aplicação (executar como superuser)
DO $$ BEGIN
  CREATE ROLE app_tenant NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE app_control_plane NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO app_tenant;
GRANT USAGE ON SCHEMA control_plane TO app_control_plane;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA control_plane TO app_control_plane;

-- Função helper para políticas
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Tabelas public com tenant_id
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users', 'entidades_cliente', 'propostas_comerciais', 'formandos', 'formadores', 'cursos',
    'acoes_formacao', 'turmas', 'matriculas', 'cronogramas', 'sessoes_formacao',
    'sumarios', 'folhas_presenca', 'presencas', 'acesso_lms', 'tenant_invites',
    'modulos_conteudo', 'progressos_modulo', 'arquivos_exportacao'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I FOR ALL TO app_tenant USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
      t
    );
  END LOOP;
END $$;

-- control_plane.tenants: tenant só vê o próprio registo
ALTER TABLE control_plane.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_self ON control_plane.tenants;
CREATE POLICY tenant_self ON control_plane.tenants
  FOR SELECT TO app_tenant
  USING (id = public.current_tenant_id());
