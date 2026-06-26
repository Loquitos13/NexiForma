# Deploy AWS – NexiForma (Fase 1)

## Arquitectura recomendada

| Componente | Serviço AWS |
|------------|--------------|
| API NestJS | ECS Fargate + ALB |
| Web Next.js | ECS Fargate (standalone) ou Amplify |
| PostgreSQL | RDS PostgreSQL 16 |
| Secrets | Secrets Manager (`JWT_SECRET`, `STRIPE_*`, `DATABASE_URL`) |
| Email | SES (substitui SMTP) |
| Auth enterprise | Cognito User Pool (tenant) + MFA obrigatório gestores |
| Ficheiros / exports | S3 (`STORAGE_BACKEND=s3`, bucket dedicado) |

## Passos mínimos

1. **RDS** – criar instância PostgreSQL; aplicar migrations:
   ```bash
   DATABASE_URL=... npm run migrate:deploy -w @nexiforma/database
   npm run db:seed   # só staging
   ```

2. **RLS** (produção multi-tenant):
   ```bash
   psql $DATABASE_URL -f packages/database/prisma/rls/enable_rls.sql
   ```
   Definir `RLS_ENABLED=true` na API e usar role `app_tenant` na `DATABASE_URL`.

3. **Docker local prod**:
   ```powershell
   $env:JWT_SECRET="..."
   docker compose -f docker-compose.prod.yml up --build
   ```

4. **ECS** – push imagens `apps/api/Dockerfile` e `apps/web/Dockerfile` para ECR; task definitions com env vars do `.env.example`.

5. **Cognito** – pool com MFA ON para grupo `managers`; configurar:
   - `COGNITO_ISSUER=https://cognito-idp.{region}.amazonaws.com/{poolId}`
   - `COGNITO_CLIENT_ID=...`
   - Login front: obter `idToken` → `POST /v1/auth/cognito/exchange`

6. **Stripe** – webhook endpoint público:
   - `POST /v1/billing/webhook/stripe`
   - Variáveis: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, etc.

7. **CI** – GitHub Actions em `.github/workflows/ci.yml` (build + testes + migrate deploy).

8. **SQS assiduidade** (Fase 4) – fila `nexiforma-assiduidade` + IAM `sqs:SendMessage/ReceiveMessage/DeleteMessage` na task role ECS; env `QUEUE_BACKEND=sqs`, `SQS_ASSIDUIDADE_URL`.

9. **CloudWatch** – logs JSON da API (`OBSERVABILITY_ENABLED=true`); export auditoria via `GET /v1/control-plane/observability/audit-export`. Opcional: sidecar X-Ray (`AWS_XRAY_ENABLED=true`).

10. **SIGO** – `SIGO_API_MODE=http` quando endpoint DGEEC disponível; staging usar `mock`.

11. **S3** (Fase 5) – bucket dedicado (ex. `nexiforma-storage`) com encriptação SSE-S3; IAM na task role ECS conforme `deploy/aws/s3-iam-policy.example.json` (`PutObject`, `GetObject`, `DeleteObject`); variáveis `STORAGE_BACKEND=s3`, `S3_BUCKET`, `AWS_REGION`. Prefixos: `formandos/` (CC/BI), `documentos/`, `lms/`, exports dossiê. Documentos de identificação: servidos via API autenticada (`GET /v1/formando-portal/documentos/:id/download`); substituição apaga o ficheiro anterior no bucket.

12. **SES** – verificar domínio remetente; `MAIL_PROVIDER=ses`, `MAIL_FROM=noreply@nexiforma.pt`, `MAIL_REPLY_TO=suporte@nexiforma.pt`.
    - SNS topic (bounces/complaints) → subscrição HTTPS `https://api.../v1/mail/webhooks/ses`; env `SES_SNS_TOPIC_ARN`.
    - DNS: SPF (`include:amazonses.com`), DKIM (3 CNAME SES), DMARC.

13. **Teams webhook** – endpoint público `POST /v1/assiduidade/webhooks/teams` com header `x-nexiforma-teams-token`; configurar `teamsMeetingId` nas sessões LMS.

14. **MFA gestores** – Cognito pool + `MFA_REQUIRED_MANAGERS=true` na API nativa; gestores sem TOTP activo não conseguem login local.

## Health checks

- API: `GET /v1/health`
- ALB target group: porta 4000, path `/v1/health`
