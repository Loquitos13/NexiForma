-- Plano de subscrição só-módulos (CRM, Teams, IA avulsos - sem Core formação).
INSERT INTO "control_plane"."subscription_plans" (
  "id",
  "code",
  "name",
  "price_cents_monthly",
  "max_active_users",
  "features",
  "active",
  "created_at"
)
SELECT
  gen_random_uuid(),
  'modular',
  'Módulos à la carte',
  0,
  NULL,
  '{"modules_only": true}'::jsonb,
  true,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "control_plane"."subscription_plans" WHERE "code" = 'modular'
);
