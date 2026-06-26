# Fase 13 – Enterprise

> SSO OpenID Connect (Azure AD / Okta), API pública documentada, export SAF-T PT e chaves API por tenant.

---

## Estado

| Sub-fase | Conteúdo | Estado |
|----------|----------|--------|
| **13.1** | OpenAPI spec + `/v1/docs/openapi.json` | ✅ |
| **13.2** | API pública (`/v1/public/v1/*`) + chaves `nf_live_` | ✅ |
| **13.3** | Chaves API self-service (`tenant_manager`) | ✅ |
| **13.4** | SSO OIDC por tenant (PKCE, Azure AD compatível) | ✅ |
| **13.5** | Export SAF-T PT (faturas comerciais) | ✅ |
| **13.6** | RGPD export automático formando | ✅ |
| **13.7** | KPIs faturação no dashboard CRM | ✅ |

---

## API pública

Base: `/v1/public/v1` - autenticação `X-Api-Key: nf_live_...`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |
| GET | `/cursos` | Cursos do tenant |
| GET | `/acoes-formacao` | Acções de formação |
| GET | `/propostas` | Propostas comerciais |
| GET | `/faturas` | Faturas emitidas/comunicadas |
| GET | `/matriculas` | Matrículas activas |

Documentação OpenAPI: `GET /v1/docs/openapi.json`

### Chaves API (gestor tenant)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/enterprise/api-keys` | Listar chaves |
| POST | `/enterprise/api-keys` | Criar chave (mostrada uma vez) |
| DELETE | `/enterprise/api-keys/:id` | Revogar |

---

## SSO OpenID Connect

Configuração em `/portal/enterprise` (gestor) ou `PATCH /v1/enterprise/sso`.

Variáveis por tenant (metadata):

- `issuer` - ex. `https://login.microsoftonline.com/{tenant-id}/v2.0`
- `clientId` - Application (client) ID Azure AD
- `clientSecret` - encriptado em repouso
- `scopes` - default `openid profile email`

Fluxo:

1. `GET /v1/auth/sso/config?slug=...` - config pública
2. `GET /v1/auth/sso/start?slug=...` - redirect OAuth (PKCE)
3. `GET /v1/auth/sso/callback` - callback API (`API_PUBLIC_URL`)

Registar redirect URI no IdP: `{API_PUBLIC_URL}/v1/auth/sso/callback`

---

## Export SAF-T PT

`GET /v1/crm/faturas/export/saft?ano=2026&mes=1`

Gera XML SAF-T (PT) 1.04_01 com faturas **EMITIDA**, **COMUNICADA_AT** e **ANULADA** no período.

---

## RGPD formando

`POST /v1/rgpd/me/export` - role `formando` - gera JSON e devolve URL de download.

---

## Variáveis de ambiente

```env
API_PUBLIC_URL=https://api.nexiforma.pt
SUBSCRIPTION_KEY_PEPPER=<secret>
```

---

## UI

- `/portal/enterprise` - SSO + chaves API + link OpenAPI
- CRM dashboard - KPIs faturação emitida / AT
- Faturas - export SAF-T por ano/mês
