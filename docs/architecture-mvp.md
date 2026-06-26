# NexiForma – visão MVP e próximos passos

## O que já existe no repositório

- Monorepo npm workspaces: `packages/database`, `packages/shared`, `apps/api`, `apps/web`.
- **Prisma** com esquema **multi-schema PostgreSQL**: `control_plane` (incl. `platform_users` para super admins) e `public` (utilizadores tenant, dossiê, LMS, etc.).
- **API NestJS**: autenticação **JWT + refresh rotativo** (`auth_refresh_sessions`), cookie HttpOnly (`nexiforma_refresh`), **Helmet**, **Throttle** só em `/v1/auth/*`, fluxos `/v1/auth/refresh`, `/v1/auth/logout`, RBAC (`super_admin`, `tenant_manager`, `formador`, `formando`), `GET /v1/tenants` apenas super admin, **portal** com dashboard agregado, **cursos**, **acções**, **turmas**, **formandos**, **matrículas**, **cronogramas**, **sessões** e **folhas de presença** (isolamento por `tenantId` no JWT).
- **Next.js** (`apps/web`): BFF, **backoffice** `/portal/*` (sidebar: dashboard, cursos, acções, formandos, compliance DGERT, dossiê), login, Control Plane.
- **Compliance DGERT**: checklist alargado (19 critérios, 6 grupos, obrigatório vs recomendado), `GET /v1/compliance/resumo` e por acção; cronograma aprovável via API.

## Ordem típica de trabalho local (Windows PowerShell)

```powershell
cd C:\...\NexiForma
copy .env.example .env
docker compose up -d
npm install
npm run db:migrate   # primeira vez: prisma migrate dev na pasta database
npm run dev:web      # porta 3000
```

Noutra janela (a API faz `predev:api` e compila pacotes antes):

```powershell
npm run dev:api      # porta 4000
```

## Próximos passos de produto (prioridade)

1. **Fila SQS** – consumidor assíncrono para eventos Zoom/Teams em escala.
2. **Conteúdos LMS** – módulos SCORM, vídeos, avaliações (além de presença).
3. **Personificação** – fluxo super admin → tenant com auditoria `ImpersonationSession`.
4. **CloudWatch / X-Ray** – export de `GlobalAuditLog` + traces por `tenant_id` (**Fase 4**: logs JSON + audit-export).
5. **SIGO API oficial** – adapter `mock|http` (**Fase 12**); export JSON/CSV manual mantém-se.
6. **CRM Faturação AT** – emissão + webservice e-fatura no fluxo comercial (**Fase 10B**); ver [FASE_10B_FATURACAO_AT_CRM.md](./FASE_10B_FATURACAO_AT_CRM.md).
