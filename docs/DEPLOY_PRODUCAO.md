# Deploy em produção - NexiForma

> Checklist único para colocar a plataforma online. **Sem modos mock, sandbox ou demo** - apenas integrações reais ou `disabled` até credenciais estarem configuradas.

---

## 1. Variáveis obrigatórias (API)

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
APP_PUBLIC_URL=https://app.nexiforma.pt
API_PUBLIC_URL=https://api.nexiforma.pt
API_DOCS_PUBLIC_URL=https://api.nexiforma.pt
CORS_ORIGIN=https://app.nexiforma.pt
COOKIE_SECURE=true
TRUST_PROXY=true

JWT_SECRET=<32+ caracteres, secret manager>
AT_CREDENTIALS_ENCRYPTION_KEY=<32+ caracteres, secret manager>

# Email e SMS reais
MAIL_PROVIDER=ses
MAIL_FROM="NexiForma <noreply@nexiforma.pt>"
MAIL_REPLY_TO=suporte@nexiforma.pt
AWS_REGION=eu-west-1

SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Storage e filas
STORAGE_BACKEND=s3
S3_BUCKET=nexiforma-storage
QUEUE_BACKEND=sqs
SQS_ASSIDUIDADE_URL=

# Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

A API **recusa arrancar** em `NODE_ENV=production` se detectar `mock`, `sandbox`, `log` ou `local` onde não são permitidos.

---

## 2. Integrações - activar quando tiver credenciais

| Integração | Variável modo | Valores permitidos | Credenciais |
|------------|---------------|------------------|-------------|
| **AT Faturas** | `AT_FATURAS_MODE` | `production` \| `disabled` | Ver [CREDENCIAIS_AT.md](./CREDENCIAIS_AT.md) |
| **SIGO DGEEC** | `SIGO_API_MODE` | `disabled` \| `http` \| `soap` | Go-live: `disabled` (export manual). `http`/`soap` só com contrato DGEEC |
| **Zoom/Teams** | Por tenant | `OAUTH` | Control Plane / portal integrações |

### AT Faturas (produção)

```env
AT_FATURAS_MODE=production
AT_FATURAS_ENDPOINT=https://servicos.portaldasfinancas.gov.pt:400/fews/faturas
AT_FATURAS_PUBLIC_KEY_PATH=/run/secrets/at-public-key.pem
AT_FATURAS_CLIENT_CERT_PFX_PATH=/run/secrets/at-producer.pfx
AT_FATURAS_CLIENT_CERT_PASSPHRASE=
AT_SOFTWARE_CERT_NUMBER=
AT_FATURAS_TIMEOUT_MS=30000
```

Por tenant (portal → CRM → Faturação): subutilizador WFA, password, códigos de série, certificação software.

### SIGO (go-live recomendado)

```env
# Produção até existir contrato oficial DGEEC:
SIGO_API_MODE=disabled
```

Export manual JSON/CSV + validação UFCD/NIF/metadados formando continua em `/portal/sigo` e dossiê.

Quando a DGEEC publicar o contrato (Fase 12.5):

```env
SIGO_API_MODE=http
# ou SIGO_API_MODE=soap + SIGO_SOAP_WSDL_URL / SIGO_SOAP_ENDPOINT
SIGO_API_BASE_URL=https://...
SIGO_API_KEY=
SIGO_API_SUBMIT_PATH=/acoes
SIGO_API_STATUS_PATH=/acoes/{referenceId}
```

Credenciais SOAP por entidade: Portal → SIGO. Ver [FASE_12_SIGO_API.md](./FASE_12_SIGO_API.md).

### Sumários (assinatura)

Assinatura interna (`POST /sumarios/:id/assinar`) ou upload do PDF já assinado (`POST /sumarios/:id/upload-pdf-assinado`, apenas `.pdf`). Sem Chave Móvel Digital / AMA.

---

## 3. O que foi removido

- Modos `mock` e `sandbox` (AT, SIGO)
- Integração Chave Móvel Digital (CMD/AMA)- substituída por upload de PDF assinado
- Checkout billing demo sem Stripe
- Endpoints `POST .../testar-at` e `POST .../sigo/config/testar`
- Simulação de reconciliação SIGO aleatória
- Página e controller CMD legados

**Mantido (produção real):** `POST .../integracoes/testar` - verifica OAuth Zoom/Teams contra APIs reais (não é simulação).

---

## 4. Arranque e migrações

```bash
npm run db:migrate:deploy
npm run build -w @nexiforma/api
npm run build -w @nexiforma/web
# NODE_ENV=production + .env completo
node apps/api/dist/main.js
```

**Não executar** `prisma db seed` em produção (contém dados demo).

---

## 5. DNS e entregabilidade email

1. SPF: `v=spf1 include:amazonses.com ~all`
2. DKIM: 3 CNAME da consola AWS SES
3. DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@nexiforma.pt`
4. Webhook SNS → `POST /v1/mail/webhooks/ses`
5. Pedir saída do sandbox SES

---

## 6. Checklist pré-go-live

- [ ] `NODE_ENV=production` em API e build web
- [ ] JWT, encryption keys e Stripe em secret manager
- [ ] SES + Twilio + S3 + SQS operacionais
- [ ] AT: certificação software + credenciais WFA por tenant
- [ ] `SIGO_API_MODE=disabled` (ou `http`/`soap` só com contrato DGEEC)
- [ ] Sumários: assinatura interna ou upload PDF assinado no dossiê
- [ ] Catálogo UFCD carregado; cursos com códigos válidos
- [ ] Formandos com dados SIGO completos (coluna «SIGO» verde)
- [ ] RLS PostgreSQL activo (`RLS_ENABLED=true`)
- [ ] Backups BD configurados (ver secção 6.1)
- [ ] Monitorização (CloudWatch / observability)
- [ ] Runbook formação / inspeção DGERT (secção 6.2) executado num tenant piloto

### 6.1 Backup de segurança da base de dados (12/12 h)

A API corre um job Nest (`BackupModule`) a cada **12 horas** (`@Cron("0 0 */12 * * *")`):

```env
# Produção: activo por omissão quando NODE_ENV=production
DB_BACKUP_ENABLED=true
DB_BACKUP_PREFIX=backups/db
DB_BACKUP_KEEP=28
# PG_DUMP_PATH=pg_dump
# DB_BACKUP_DOCKER_CONTAINER=nexiforma-postgres
```

- Gera `pg_dump` → gzip → `STORAGE` (local ou S3 em `backups/db/nexiforma-*.sql.gz`).
- Manual: `npm run db:backup` (usa `DATABASE_URL` do `.env`).
- Em AWS RDS: manter também automated backups / snapshots RDS; o dump da app é cópia adicional para S3/storage.
- Requisito: `pg_dump` no PATH do contentor API (ou `PG_DUMP_PATH` / fallback docker exec).

### 6.2 Runbook E2E – formação / inspeção DGERT

Validar num tenant piloto (com módulo formação activo):

1. **Catálogo** – confirmar UFCDs activas em `/portal/catalogo-ufcd`.
2. **Curso** – criar curso com `codigoUfcd` válido (código inválido deve ser rejeitado).
3. **Acção + turma** – criar acção de formação e turma; matricular formandos com NIF real e dados SIGO completos (documento, nascimento, nacionalidade, habilitações).
4. **Cronograma / sessões** – planear sessões; formador inicia sessão (contador próprio); formandos entram em `/portal/formando/reuniao` (contador + assiduidade ao abrir); folhas de presença; sumários com assinatura interna ou upload PDF assinado.
5. **Compliance / dossiê** – em `/portal/compliance` e `/portal/dossie`, checklist DGERT a 100% / pronto para inspeção.
6. **Pacote inspeção** – gerar e descarregar ZIP/HTML do dossiê.
7. **Certificado** – emitir certificado NexiForma e verificar QR público (`/verificar/...`).
8. **SIGO** – com `SIGO_API_MODE=disabled`, validar e exportar JSON/CSV sem erros bloqueantes; não activar submit API sem contrato DGEEC (pedido sandbox/WSDL enviado à AGSE).
9. **LMS (opcional)** – publicar conteúdo SCORM/quiz e confirmar progresso no portal formando.
10. **Calendário** – formador/formando: entrar na sessão a partir do evento no calendário com o mesmo contador.

---

## 7. Documentação relacionada

- [CREDENCIAIS_AT.md](./CREDENCIAIS_AT.md)
- [CERTIFICACAO_SOFTWARE_AT.md](./CERTIFICACAO_SOFTWARE_AT.md)
- [FASE_12_SIGO_API.md](./FASE_12_SIGO_API.md)
- [deploy/aws/README.md](../deploy/aws/README.md)
