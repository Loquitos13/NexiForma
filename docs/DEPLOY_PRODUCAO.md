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
| **SIGO DGEEC** | `SIGO_API_MODE` | `http` \| `disabled` | `SIGO_API_BASE_URL`, `SIGO_API_KEY` |
| **CMD** | `CMD_SIGNATURE_MODE` | `oauth` \| `disabled` | `CMD_OAUTH_URL` |
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

### SIGO (quando API DGEEC disponível)

```env
SIGO_API_MODE=http
SIGO_API_BASE_URL=https://...
SIGO_API_KEY=
SIGO_API_SUBMIT_PATH=/acoes
SIGO_API_STATUS_PATH=/acoes/{referenceId}
```

Export manual JSON/CSV continua disponível com `SIGO_API_MODE=disabled`.

### CMD (Chave Móvel Digital)

```env
CMD_SIGNATURE_MODE=oauth
CMD_OAUTH_URL=https://autenticacao.gov.pt/...
```

---

## 3. O que foi removido

- Modos `mock` e `sandbox` (AT, SIGO, CMD)
- Checkout billing demo sem Stripe
- Endpoints `POST .../testar-at` e `POST .../sigo/config/testar`
- Simulação de reconciliação SIGO aleatória
- Página CMD de simulação manual com token
- Controller CMD legado em certificados (PIN mock `999999`)

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
- [ ] RLS PostgreSQL activo (`RLS_ENABLED=true`)
- [ ] Backups BD configurados
- [ ] Monitorização (CloudWatch / observability)

---

## 7. Documentação relacionada

- [CREDENCIAIS_AT.md](./CREDENCIAIS_AT.md)
- [CERTIFICACAO_SOFTWARE_AT.md](./CERTIFICACAO_SOFTWARE_AT.md)
- [FASE_12_SIGO_API.md](./FASE_12_SIGO_API.md)
- [deploy/aws/README.md](../deploy/aws/README.md)
