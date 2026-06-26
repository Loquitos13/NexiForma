# NexiForma

Plataforma SaaS B2B para **entidades formadoras certificadas (DGERT)** – dossiê pedagógico digital, LMS, assiduidade online e Control Plane para operação multi-tenant.

## Monorepo

| Pacote | Descrição |
|--------|-----------|
| `packages/database` | Prisma – `public` (dados tenants) + `control_plane` (SaaS, subs, auditoria, `platform_users`, `auth_refresh_sessions`) |
| `packages/shared` | Constantes (`APP_NAME`, `API_PREFIX`), tipos JWT (`JwtRole`) |
| `apps/api` | NestJS – login JWT + refresh + throttle, RBAC, tenants (super admin), portal exemplo |
| `apps/web` | Next.js 15 – BFF `app/api/auth/*`, páginas `/login`, landing |

## Requisitos

- Node.js **20+**
- Docker (PostgreSQL 16 + Redis 7 locais)

## Arranque (Windows PowerShell)

```powershell
cd C:\...\NexiForma
Copy-Item .env.example .env   # obrigatório na 1.ª vez (JWT_SECRET, DATABASE_URL, …)
docker compose up -d
npm install
npm run db:migrate
npm run db:migrate:deploy   # produção/staging (apenas migrate deploy)
npm run db:seed    # opcional – tenant `demo`, super-admin e utilizadores exemplo
```

Se a BD já estiver actualizada – **API e Web em paralelo** (recomendado):

```powershell
npm run dev          # arranca API (:4000) + Web (:3000) no mesmo terminal
```

**NexiGuia com LLM local (opcional):**

```powershell
npm run ollama:setup          # Docker Ollama + modelo qwen2.5:3b-instruct (~2 GB)
# No .env: NEXIGUIA_LLM_ENABLED=true e NEXIGUIA_LLM_URL=http://127.0.0.1:11435
npm run dev
```

Sem Ollama activo, o NexiGuia usa o motor local (keywords) - funciona offline.

### Interface (produção)

- **Landing** (`/`) – marketing DGERT, funcionalidades, CTAs; painel BFF só em `development`.
- **Auth** – login unificado em `/login` (slug da entidade ou vazio para equipa NexiForma); redirect automático para `/portal`, `/portal/formando` ou `/plataforma` conforme o role; `/login/plataforma` redireciona para `/login`; recuperação em `/login/recuperar`.
- **Portal / Plataforma** – barra de sessão com email, papel e logout; middleware protege `/portal/*` e `/plataforma/*`.

Ou em janelas separadas:

```powershell
npm run dev:api    # porta 4000 – obrigatório antes do login
```

Web (outra janela):

```powershell
npm run dev:web    # porta 3000 (ou 3002 se 3000 ocupada)
```

Se o login devolver *API indisponível* / `ECONNREFUSED`, a API não está a correr – confirma `http://127.0.0.1:4000/v1/health` → `200`.

## Autenticação (JWT + refresh)

### Melhorias de base na API

- **Helmet** – cabeçalhos HTTP de endurecimento.
- **cookie-parser** – leitura da cookie HttpOnly `nexiforma_refresh`.
- **CORS** com `credentials: true` (`CORS_ORIGIN` – origens separadas por vírgula).

### BFF (Next.js → Nest)

O front chama primeiro o **Next** (`apps/web`) para manter cookies de refresh na **mesma origem**. Os Route Handlers em `app/api/auth/*` encaminham para a API Nest e reescrevem o `Path` da `Set-Cookie` da API (por defeito `/${API_PREFIX}/auth`) para **`/api/auth`**, para o browser enviar a cookie refresh aos pedidos seguintes ao BFF.

| Browser Next | Proxied para Nest |
|--------------|-------------------|
| `POST /api/auth/tenant/login` | `POST /v1/auth/tenant/login` |
| `POST /api/auth/platform/login` | `POST /v1/auth/platform/login` |
| `POST /api/auth/refresh` | `POST /v1/auth/refresh` |
| `POST /api/auth/logout` | `POST /v1/auth/logout` |
| `GET /api/auth/me` | `GET /v1/auth/me` |

Variáveis no web: `API_URL` (preferido para o servidor) ou `NEXT_PUBLIC_API_URL`; se alterares paths, alinha `AUTH_COOKIE_PATH` no Nest com `NEST_AUTH_COOKIE_PATH` no Next e opcionalmente `BFF_AUTH_COOKIE_PATH` (`.env.example`).

Por detrás de um reverse proxy, activa **`TRUST_PROXY`** na Nest para IPs reais nos limites do `AuthController`.

**Cliente**: `bffFetch` (`apps/web/lib/client/bff-fetch.ts`) faz pedidos same-origin ao BFF com `credentials: "include"`. Face a **401**, dispara uma vez **`POST /api/auth/refresh`** (pedidos paralelos partilham a mesma `Promise`), grava novo access em `sessionStorage` (`nexiforma_access` – ver `access-token.ts`) e repete o pedido. Usar `{ authRetry401: false }` em logout ou rotas públicas. Os ecrãs de login usam `fetch` directo sem este comportamento.

**API de domínio (via BFF genérico)**: qualquer rota Nest `GET|POST|… /v1/<recurso>` exposta em **`/api/v1/<recurso>`** (excepto `auth/*` – continua em `/api/auth/*`). Exemplos:

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `GET /api/v1/portal/dashboard` | `GET /v1/portal/dashboard` | tenant_manager, formador |
| `GET /api/v1/cursos` | `GET /v1/cursos` | tenant_manager, formador |
| `POST /api/v1/cursos` | `POST /v1/cursos` | tenant_manager |
| `GET /api/v1/acoes-formacao` | `GET /v1/acoes-formacao` | tenant_manager, formador |
| `POST /api/v1/acoes-formacao` | `POST /v1/acoes-formacao` | tenant_manager |
| `GET /api/v1/turmas?acaoFormacaoId=` | `GET /v1/turmas` | tenant_manager, formador |
| `POST /api/v1/turmas` | `POST /v1/turmas` | tenant_manager |
| `GET /api/v1/formandos` | `GET /v1/formandos` | tenant_manager, formador |
| `POST /api/v1/formandos` | `POST /v1/formandos` | tenant_manager |
| `GET /api/v1/matriculas?turmaId=` | `GET /v1/matriculas` | tenant_manager, formador |
| `POST /api/v1/matriculas` | `POST /v1/matriculas` | tenant_manager |
| `GET /api/v1/cronogramas?acaoFormacaoId=` | `GET /v1/cronogramas` | tenant_manager, formador |
| `POST /api/v1/cronogramas` | `POST /v1/cronogramas` | tenant_manager |
| `GET /api/v1/sessoes-formacao?cronogramaId=` | `GET /v1/sessoes-formacao` | tenant_manager, formador |
| `POST /api/v1/sessoes-formacao` | `POST /v1/sessoes-formacao` | tenant_manager, formador |
| `GET /api/v1/folhas-presenca?sessaoId=` | `GET /v1/folhas-presenca` | tenant_manager, formador |
| `GET /api/v1/folhas-presenca/:id` | detalhe + presenças | tenant_manager, formador |
| `POST /api/v1/folhas-presenca` | abre folha (turma + sessão) | tenant_manager, formador |
| `PATCH /api/v1/folhas-presenca/:id/fechar` | fecha folha | tenant_manager |
| `PATCH /api/v1/presencas/:id` | marca presença | tenant_manager, formador |
| `GET /api/v1/compliance/resumo` | score DGERT por acção | tenant_manager, formador |
| `GET /api/v1/compliance/acoes-formacao/:id` | checklist alargado + pendências | tenant_manager, formador |
| `PATCH /api/v1/cursos/:id` | actualizar curso | tenant_manager |
| `GET /api/v1/acoes-formacao/:id` | detalhe acção | tenant_manager, formador |
| `PATCH /api/v1/acoes-formacao/:id` | actualizar acção | tenant_manager |
| `PATCH /api/v1/formandos/:id` | actualizar formando | tenant_manager |
| `PATCH /api/v1/matriculas/:id` | alterar estado matrícula | tenant_manager |
| `PATCH /api/v1/cronogramas/:id/aprovar` | aprovar cronograma | tenant_manager |
| `PATCH /api/v1/sessoes-formacao/:id` | estado/formador sessão | tenant_manager, formador |
| `GET /api/v1/dossie-pedagogico/acoes-formacao/:id` | dossiê agregado + checklist | tenant_manager, formador |
| `GET /api/v1/dossie-pedagogico/acoes-formacao/:id/validacao-sigo` | validação UFCD/NIF antes do SIGO | tenant_manager, formador |
| `GET /api/v1/dossie-pedagogico/acoes-formacao/:id/export/dossie.html` | HTML imprimível (PDF via browser) | tenant_manager, formador |
| `GET /api/v1/dossie-pedagogico/acoes-formacao/:id/export` | download JSON (`nexiforma.dossie_pedagogico.v1`) | tenant_manager, formador |
| `GET /api/v1/dossie-pedagogico/acoes-formacao/:id/export/sigo` | pacote SIGO JSON (`nexiforma.sigo_export.v1`) | tenant_manager, formador |
| `GET /api/v1/dossie-pedagogico/acoes-formacao/:id/export/sigo/formandos.csv` | CSV formandos (importação manual SIGO) | tenant_manager, formador |
| `GET /api/v1/sumarios?sessaoId=` | listar sumários | tenant_manager, formador |
| `POST /api/v1/sumarios/sessao/:sessaoId` | criar sumário | tenant_manager, formador |
| `POST /api/v1/sumarios/:id/assinar` | assinar (imutável) | tenant_manager, formador |
| `GET /api/v1/tenants` | `GET /v1/tenants` | super_admin |
| `GET /api/v1/users` | listar utilizadores do tenant | tenant_manager |
| `GET /api/v1/users/invites` | convites pendentes | tenant_manager |
| `POST /api/v1/users/invite` | enviar convite por email | tenant_manager |
| `POST /api/v1/users/accept-invite` | aceitar convite (público) | – |
| `PATCH /api/v1/users/:id` | activar/desactivar utilizador | tenant_manager |
| `GET /api/v1/formadores` | listar formadores | tenant_manager, formador |
| `GET /api/v1/billing/plans` | planos de subscrição | público |
| `GET /api/v1/billing/subscription` | subscrição actual | tenant_manager, formador |
| `POST /api/v1/billing/checkout` | checkout Stripe ou demo | tenant_manager |
| `POST /api/v1/billing/webhook/stripe` | webhook Stripe | Stripe |

UI: **backoffice** em **`/portal`** (dashboard, **fluxo guiado**, cursos, acções, formandos, compliance DGERT, dossiê, **utilizadores**, **subscrição**) e **`/plataforma/tenantes`** (Control Plane). Convites: **`/convite/[token]`**.

### Fase 1 – SaaS operacional

- **Fluxo guiado** (`/portal/fluxo`) – curso → acção → turmas → cronograma/sessões/presenças → dossiê.
- **Utilizadores e convites** – gestão de equipa por tenant, email SMTP (ou URL em dev).
- **MFA TOTP** – obrigatório no login para gestores com MFA activo; setup em `/portal/utilizadores`.
- **Cognito** (opcional) – `POST /v1/auth/cognito/exchange` quando `COGNITO_ISSUER` + `COGNITO_CLIENT_ID`.
- **RLS PostgreSQL** – activar com `RLS_ENABLED=true` e script `packages/database/prisma/rls/enable_rls.sql`.
- **Subscrições** – planos seed (`starter`, `pro`, `enterprise`); Stripe ou modo demo sem chave.
- **Deploy** – Docker (`docker-compose.prod.yml`), CI (`.github/workflows/ci.yml`), guia AWS em `deploy/aws/README.md`.

BFF auth adicional:

| Browser Next | Nest |
|--------------|------|
| `POST /api/auth/mfa/verify` | verificar código no login |
| `POST /api/auth/mfa/setup` | iniciar TOTP |
| `POST /api/auth/mfa/confirm` | activar MFA |

Middleware Next protege `/portal/*` (cookie `nexiforma_refresh`).

### Fase 2 – LMS, assiduidade automática, Control Plane

- **LMS** – eventos `join` / `leave` / `heartbeat` em `acesso_lms`; portal formando com heartbeat.
- **Assiduidade** – `POST /v1/assiduidade/sessoes/:id/sincronizar` (LMS → folha automática); webhook Zoom `POST /v1/assiduidade/webhooks/zoom` (header `X-Nexiforma-Zoom-Token`).
- **Sessões** – campos `lmsAtivo`, `zoomMeetingId`, `minutosPresencaMin` (PATCH sessão).
- **Control Plane** – `GET /v1/control-plane/metrics`, tenants, audit-logs, subscription-keys (super_admin).
- **UI** – `/portal/lms`, `/portal/formando`, `/plataforma/*` (dashboard, tenants, auditoria).

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `POST /api/v1/lms/eventos` | registo LMS | manager, formador, formando |
| `GET /api/v1/lms/minhas-sessoes` | sessões LMS do formando | formando |
| `GET /api/v1/lms/acessos` | log de acessos | manager, formador |
| `POST /api/v1/assiduidade/sessoes/:id/sincronizar` | sync presenças | manager, formador |
| `GET /api/v1/control-plane/*` | Control Plane | super_admin |

### Fase 3 – Conteúdos LMS, personificação, fila assiduidade

- **Conteúdos** – `ModuloConteudo` (VIDEO, PDF, TEXTO, QUIZ, SCORM) + `ProgressoModulo` por matrícula.
- **API** – `GET/POST /v1/conteudos-lms/modulos`, `GET/PATCH /v1/conteudos-lms/progresso`.
- **Personificação** – super-admin `POST /v1/control-plane/tenants/:id/impersonate` (auditado, read-only por defeito); banner no portal; `POST /v1/auth/impersonation/end`.
- **Fila Redis** – webhooks Zoom enfileirados (`REDIS_URL`, `QUEUE_ENABLED=false` para síncrono).
- **UI** – `/portal/conteudos`, módulos no portal formando; personificação em `/plataforma/tenantes/[id]`.

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `GET/POST /api/v1/conteudos-lms/*` | módulos e progresso | manager, formador, formando |
| `POST /api/auth/impersonation/start` | personificar tenant | super_admin (cookie plataforma) |
| `POST /api/auth/impersonation/end` | terminar personificação | tenant impersonado |

### Fase 4 – SQS, observabilidade, SIGO API, SCORM

- **Fila produção** – `QUEUE_BACKEND=sqs` + `SQS_ASSIDUIDADE_URL` (Redis continua em dev).
- **Observabilidade** – logs HTTP JSON (`tenantId`, `durationMs`) para CloudWatch Logs Insights; `GET /v1/control-plane/observability/{status,audit-export}`.
- **SIGO API** – `SIGO_API_MODE=mock|http`; `POST /v1/sigo/acoes-formacao/:id/submit` após validação; export manual mantém-se.
- **SCORM 1.2** – player em `/portal/formando/scorm/[moduloId]`; API CMI `GET/POST /v1/conteudos-lms/scorm/:id/{launch,cmi}`; demo em `/scorm-demo/index.html`.

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `GET /api/v1/control-plane/observability/*` | status + audit export | super_admin |
| `GET /api/v1/sigo/config` | modo integração | manager, formador |
| `POST /api/v1/sigo/acoes-formacao/:id/submit` | submissão SIGO | manager |
| `GET/POST /api/v1/conteudos-lms/scorm/*` | runtime SCORM | formando, manager |

### Fase 5 – Storage S3, exports arquivados, SES, Teams, MFA gestores

- **Storage** – `STORAGE_BACKEND=local|s3`; exports dossiê/SIGO/HTML persistidos em `arquivos_exportacao` com URL pré-assinada (S3) ou path local.
- **API exports** – `GET/POST /v1/dossie-pedagogico/acoes-formacao/:id/arquivos`, `GET /v1/dossie-pedagogico/arquivos/:id/url`.
- **Email SES** – `MAIL_PROVIDER=ses` + `AWS_REGION`; fallback SMTP ou log em dev.
- **MFA gestores** – `MFA_REQUIRED_MANAGERS=true` bloqueia login de ADMIN/COORDENADOR/FINANCEIRO sem MFA activo.
- **Teams assiduidade** – `POST /v1/assiduidade/webhooks/teams` (lookup por `teamsMeetingId` na sessão); fila Redis/SQS partilhada com Zoom.
- **SCORM CMI** – estado CMI persistido em `progressos_modulo.metadata` entre sessões.

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `GET/POST /api/v1/dossie-pedagogico/acoes-formacao/:id/arquivos` | listar/gerar export | manager (POST), manager/formador (GET) |
| `GET /api/v1/dossie-pedagogico/arquivos/:id/url` | URL download | manager, formador |
| `POST /api/v1/assiduidade/webhooks/teams` | webhook Teams | token header |

### Fase 6 – SCORM upload, assets alojados, SCORM 2004, UX produção

- **Upload SCORM** – `POST /v1/conteudos-lms/scorm/upload` (multipart ZIP até 50 MB); extrai pacote para storage (S3/local), parse `imsmanifest.xml`, cria módulo publicado.
- **Assets SCORM** – `GET /v1/conteudos-lms/scorm/assets/:moduloId/*` com cookie de sessão (`POST .../asset-session`); proxy BFF suporta binário e reescreve cookies.
- **SCORM 2004** – CMI `completion_status`, `success_status`, `score.scaled` mapeados para progresso.
- **UX** – landing/auth produção, dashboard portal, páginas `error`/`not-found`, barra de sessão com logout.

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `POST /api/v1/conteudos-lms/scorm/upload` | upload ZIP | tenant_manager |
| `POST /api/v1/conteudos-lms/scorm/:id/asset-session` | cookie assets | formando, manager, formador |
| `GET /api/v1/conteudos-lms/scorm/assets/:id/*` | ficheiros pacote | cookie SCORM |

### Fase 7 – Alertas compliance e certificados

- **Alertas** – `GET /v1/compliance/alertas` (inspecção iminente, cronograma por aprovar, sessões próximas).
- **Certificados** – `GET /v1/certificados/acoes-formacao/:id`, `GET .../matricula/:id/certificado.html` (PDF via browser).
- **UI** – widget alertas no dashboard; `/portal/certificados`.
- **Roadmap** – `docs/product-roadmap-pt.md` (gaps para liderar mercado PT).

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `GET /api/v1/compliance/alertas` | alertas operacionais | manager, formador |
| `GET /api/v1/certificados/acoes-formacao/:id` | elegibilidade por formando | manager, formador |
| `GET /api/v1/certificados/matricula/:id/certificado.html` | certificado imprimível | manager, formador, formando |

### Fase 8 – Notificações e pacote inspeção ZIP

- **Notificações email** – digest de alertas compliance, lembretes de sessão (amanhã), aviso de certificado disponível; reutiliza `MailService` (SES/SMTP/log).
- **SMS opcional** – `SMS_PROVIDER=twilio` + credenciais Twilio; fallback log em dev.
- **Pacote inspeção ZIP** – agrega dossiê JSON/HTML, SIGO JSON/CSV, compliance DGERT, validação SIGO, presenças CSV e evidências LMS num ZIP para auditoria DGERT.
- **UI** – botão «Pacote inspeção ZIP» em `/portal/dossie`; notificações em `/portal/compliance` e dashboard; «Notificar formandos elegíveis» em `/portal/certificados`.

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `GET /api/v1/dossie-pedagogico/acoes-formacao/:id/export/pacote-inspecao.zip` | download ZIP imediato | manager, formador |
| `POST /api/v1/dossie-pedagogico/acoes-formacao/:id/pacote-inspecao` | arquivar ZIP em storage | tenant_manager |
| `POST /api/v1/notificacoes/alertas/digest` | email digest alertas | tenant_manager |
| `POST /api/v1/notificacoes/sessoes/lembretes` | lembretes sessão amanhã | manager, formador |
| `POST /api/v1/notificacoes/certificados/acoes-formacao/:id` | aviso certificado | manager, formador |
| `GET /api/v1/notificacoes/config` | estado email/SMS | manager, formador |

### Fase 9 – Certificado QR verificável + assinatura CMD

- **Verificação pública** – certificados com QR code e código `NF-XXXXXXXX`; página pública `/verificar/:token`.
- **Integridade** – hash do conteúdo (formando, acção, curso) detecta alterações pós-emissão.
- **Assinatura CMD** – sumários com `CMD_SIGNATURE_MODE=mock|oauth`; fluxo mock em `/cmd/assinar`.
- **Revogação** – gestor pode revogar código de verificação.

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `GET /verificar/:token` | página pública validação | – |
| `GET /api/v1/verificacao/certificados/:token` | dados verificação | público |
| `GET /api/v1/certificados/.../certificado.html` | certificado + QR | manager, formador, formando |
| `POST /api/v1/sumarios/:id/assinar-cmd` | iniciar CMD | manager, formador |
| `POST /api/v1/cmd/assinar/confirmar` | confirmar CMD | público (token) |
| `GET /cmd/assinar` | simulação CMD (mock) | – |

### Fase 10 – CRM entidades, propostas e formadores CC/CCP

- **Entidades cliente** – CRUD B2B (`/portal/entidades`); liga formandos e propostas.
- **Propostas comerciais** – orçamentos com estados (RASCUNHO → ENVIADA → ACEITE/REJEITADA), valor e curso opcional.
- **Formadores** – gestão CC/CCP com datas de validade; alertas automáticos 90 dias antes (`GET /formadores/alertas-cc`).

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `GET/POST/PATCH /api/v1/entidades-cliente` | CRM entidades | manager (POST/PATCH), manager/formador (GET) |
| `GET/POST/PATCH /api/v1/propostas` | propostas B2B | manager (POST/PATCH), manager/formador (GET) |
| `GET/PATCH /api/v1/formadores` | equipa + credenciais | manager (PATCH), manager/formador (GET) |
| `GET /api/v1/formadores/alertas-cc` | alertas renovação | manager, formador |

### Portal do formando + RGPD + identificação (pós-fase 10)

- **Menu formando** – Aprendizagem, Catálogo, Inscrições, Perfil (`/portal/formando/*`).
- **Documentos** – CC (frente/verso), BI, carta de condução com captura por câmara e molduras (identificação do formando).
- **RGPD** – consentimento no 1.º login (`ConsentGate`); decisão exclusiva do utilizador; registo consultável em `/portal/rgpd`.
- **PWA** – `manifest.json` + service worker no layout formando (instalação mobile).

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `GET/PATCH /api/v1/formando-portal/me` | perfil formando | formando |
| `GET/POST /api/v1/formando-portal/documentos` | documentos identificação | formando |
| `GET/PATCH /api/v1/consent/me` | consentimento RGPD | utilizadores tenant |
| `GET /api/v1/consent/tenant` | registo RGPD (leitura) | tenant_manager |

### Fases 11–13 – Plataforma DGERT + integrações + UI

- **Quiz engine** – perguntas por módulo, tentativas, nota mínima e pré-requisitos; player em `/portal/formando/quiz/:moduloId`.
- **Catálogo UFCD** – referência DGEEC com validação em cursos e SIGO (`/portal/catalogo-ufcd`).
- **Integrações Zoom / Teams / Moodle** – config por tenant (mock|oauth); criar reuniões no cronograma; sync Moodle WS.
- **SIGO reconciliação** – submissões persistidas com estados, reenvio e reconciliação mock (`/portal/sigo`).
- **RGPD** – pedidos export/delete com arquivo JSON (`/portal/rgpd`).
- **Documentos** – anexos a entidades e acções via storage.
- **Avaliações** – registo no dossiê por matrícula.
- **Relatórios executivos** – KPIs formação, comercial e compliance (`/portal/relatorios`).
- **API pública** – `GET /v1/public/v1/cursos` com header `X-Api-Key: nf_live_...` (chave Control Plane).
- **PWA formando** – `manifest.json` para instalação mobile.

| Browser (BFF) | Nest | Papéis |
|---------------|------|--------|
| `GET/POST /api/v1/integracoes` | Zoom/Teams/Moodle | manager |
| `POST /api/v1/integracoes/sessoes/:id/reuniao?provider=` | criar reunião | manager, formador |
| `GET /api/v1/integracoes/moodle/sync` | sync cursos Moodle | manager, formador |

#### Teams (SaaS B2B)

- **Plataforma** (`.env`): `NEXIFORMA_TEAMS_CLIENT_ID`, `NEXIFORMA_TEAMS_CLIENT_SECRET` – app Azure única NexiForma.
- **Por tenant** (Control Plane ou portal): `tenantId` M365 do cliente + `organizerId` (email M365 com licença Teams).
- **IT do cliente** (Teams PowerShell, uma vez): `New-CsApplicationAccessPolicy` + `Grant-CsApplicationAccessPolicy` com o Client ID NexiForma e o organizador.
- **Teste Graph** (sem BD): `npm run test:teams-meeting` – opcionalmente `node scripts/test-teams-meeting.mjs <tenantId> <email-organizador>`.
- **Fluxo portal**: Integrações → OAUTH Teams → «Testar ligação» → «Criar sala Teams real» (ou LMS & assiduidade).
| `GET/POST /api/v1/quizzes/...` | quiz LMS | formando + gestão |
| `GET /api/v1/catalogo-ufcd` | catálogo UFCD | manager, formador |
| `GET/POST /api/v1/sigo/submissoes` | trilho SIGO | manager |
| `GET/POST /api/v1/rgpd/pedidos` | RGPD | manager |
| `GET/POST /api/v1/documentos` | anexos | manager, formador |
| `GET /api/v1/relatorios/executivo` | dashboard KPI | manager |
| `GET /v1/public/v1/cursos` | API marketplace | chave API |

### Fluxos

- **Login unificado** – página `/login`: com `{ tenantSlug, email, password }` → BFF `POST /api/auth/tenant/login`; com slug vazio → `POST /api/auth/platform/login` (equipa NexiForma). Após autenticação, redirect por role (`tenant_manager`/`formador` → `/portal`, `comercial` → `/portal/crm`, `formando` → `/portal/formando`, `super_admin` → `/plataforma`).
- **Refresh** – BFF `POST /api/auth/refresh` ou `POST /v1/auth/refresh`: rotação do refresh na BD; novo access JWT + nova cookie.
- **Logout** – BFF `POST /api/auth/logout` ou `POST /v1/auth/logout` (HTTP 204).
- **Perfil** – BFF `GET /api/auth/me` ou `GET /v1/auth/me` com `Authorization: Bearer <access>` (sem throttle).

Claims do access JWT: `kind` (`tenant` \| `platform`), `role`: `tenant_manager` \| `comercial` \| `formador` \| `formando` \| `super_admin`, `tenantId` / `tenantSlug` quando existir.

### Refresh também no JSON (dev / opt-in)

- Em `NODE_ENV !== production`, o login também devolve `refreshToken` no JSON (útil quando front e API estão em portas diferentes sem reverse proxy).

### Throttling (@nestjs/throttler)

- Aplicado **só** ao `AuthController`: logins mais restritos (~10/min/IP), refresh e logout com limites separados.

Utilizadores de exemplo após `npm run db:seed`:

| Função | Email | Notas |
|--------|-------|-------|
| Super admin | `super@nexiforma.local` | `/login` (slug vazio) · password `super123#` → `/plataforma` |
| Gestão tenant | `manager@demo.local` | slug `demo` em `/login` · password `manager123` → `/portal` |
| Formador | `formador@demo.local` | slug `demo` · password `trainer123` → `/portal` (nav limitada) |
| Comercial | `comercial@demo.local` | slug `demo` · password `com123` → `/portal/crm` (só CRM) |
| Formando | `formando@demo.local` | slug `demo` · password `user123` → `/portal/formando` |

Rotas exemplo: `GET /v1/tenants` (super admin); `GET/POST /v1/cursos`, `GET/POST /v1/acoes-formacao` (manager, formador); `GET|POST /v1/turmas`, `GET|POST /v1/formandos`, `GET /v1/matriculas?turmaId=`, `POST /v1/matriculas` (manager).

Após `npm run db:seed` o tenant `demo` inclui curso, acção, turma, formando, matrícula, cronograma, sessão 1 com **sumário assinado**, folha de presença e checklist do dossiê quase completo.

Configura `.env`: `JWT_EXPIRES`, `JWT_REFRESH_EXPIRES` (ex.: `7d`), opcionalmente `JWT_REFRESH_PEPPER`, `COOKIE_SAMESITE` / `COOKIE_SECURE`.

## Builds e testes

```powershell
npm run build
npm run test
```

Com Docker a correr:

```powershell
$env:DATABASE_URL = "postgresql://nexiforma:nexiforma_dev@localhost:5432/nexiforma?schema=public"
npm run db:migrate:deploy
```

## Segurança e produto

- Produção: `JWT_SECRET`, `JWT_REFRESH_PEPPER` e cookies `Secure`/`SameSite` compatíveis com o teu trajecto HTTPS; KMS/Secrets Manager e Cognito/MFA quando integrares AWS – ver `docs/architecture-mvp.md`.

## Documentação adicional

| Documento | Conteúdo |
|-----------|----------|
| [`docs/product-roadmap-pt.md`](docs/product-roadmap-pt.md) | Roadmap mercado PT / fases 8–13 |
| [`docs/architecture-mvp.md`](docs/architecture-mvp.md) | Arquitectura MVP |
| [`PROXIMAS_TAREFAS.md`](PROXIMAS_TAREFAS.md) | Tarefas em aberto por fase |

## Licença

Proprietário – NexiForma.
