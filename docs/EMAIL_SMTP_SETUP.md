# Configurar email transacional (Brevo ou Resend)

Guia passo a passo para enviar emails reais a partir da NexiForma **sem SMS nem apps extra**. Ambos têm **plano gratuito** suficiente para arrancar.

| Serviço | Plano grátis | SMTP |
|---------|--------------|------|
| **Brevo** (ex-Sendinblue) | ~300 emails/dia | `smtp-relay.brevo.com:587` |
| **Resend** | ~3000 emails/mês | `smtp.resend.com:587` |

Substitui `teu-dominio.pt` pelo teu domínio real (ex. `nexiforma.pt`).

---

## Antes de começar

1. **Domínio próprio** - comprado num registrador (Cloudflare, PTisp, GoDaddy, etc.)
2. **Acesso ao DNS** - painel do registrador ou Cloudflare
3. **Email de suporte** - ex. `suporte@teu-dominio.pt` (caixa real ou alias)
4. Ficheiro **`.env`** na raiz do projeto NexiForma (copia de `.env.example`)

---

## Opção A - Brevo (recomendado em PT)

### 1. Criar conta

1. [https://www.brevo.com](https://www.brevo.com) → registo gratuito
2. Confirma o email da conta Brevo

### 2. Verificar o domínio

1. Menu **Transactional** → **Senders, Domains & Dedicated IPs** → **Domains**
2. **Add a domain** → `teu-dominio.pt`
3. Brevo mostra registos DNS - adiciona no teu painel DNS:

| Tipo | Nome / Host | Valor (exemplo) |
|------|-------------|-----------------|
| **TXT** (SPF) | `@` ou `teu-dominio.pt` | `v=spf1 include:spf.brevo.com ~all` |
| **TXT** (DKIM) | `mail._domainkey` | (valor longo que o Brevo gera) |
| **CNAME** (opcional Brevo) | `brevo1._domainkey` | (conforme consola) |
| **TXT** (DMARC) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@teu-dominio.pt` |

4. Espera 5–30 min → **Verify** na consola Brevo até ficar verde

> **DMARC:** começa com `p=none` (só monitorização). Depois de estável, podes usar `p=quarantine`.

### 3. Criar remetente

1. **Senders** → **Add a sender**
2. Nome: `NexiForma`
3. Email: `noreply@teu-dominio.pt` (ou `no-reply@...`)
4. Confirma o email se o Brevo pedir (link na caixa)

### 4. Credencial SMTP

1. **SMTP & API** → **SMTP**
2. Cria ou copia:
   - **Login / SMTP user:** normalmente o teu email de login Brevo ou um ID que mostram
   - **SMTP key / password:** chave SMTP (não a API key REST)

### 5. `.env` na NexiForma

```env
MAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=o-teu-login-smtp-brevo
SMTP_PASS=a-tua-chave-smtp-brevo

MAIL_FROM="NexiForma <noreply@teu-dominio.pt>"
MAIL_REPLY_TO=suporte@teu-dominio.pt

APP_PUBLIC_URL=https://app.teu-dominio.pt
CRON_NOTIFICACOES_ENABLED=true
```

6. Reinicia a API: `npm run dev:api` (ou redeploy)
7. Log da API deve mostrar: `Email via SMTP (smtp-relay.brevo.com).`

### 6. Testar

1. Login como gestor → **Portal** → **Notificações**
2. Badge deve dizer **Envio real activo**
3. Clica **Enviar digest de alertas** - verifica a caixa de entrada (e spam)
4. Testa **Recuperar palavra-passe** em `/login/recuperar`

---

## Opção B - Resend

### 1. Criar conta

1. [https://resend.com](https://resend.com) → Sign up
2. Confirma email

### 2. Adicionar domínio

1. **Domains** → **Add Domain** → `teu-dominio.pt`
2. Adiciona os registos DNS que o Resend mostra:

| Tipo | Propósito |
|------|-----------|
| **TXT** (SPF) | Inclui `include:amazonses.com` (valor exacto na consola) |
| **CNAME** (DKIM) | 3 registos DKIM que o Resend gera |
| **TXT** (DMARC) | `_dmarc` → `v=DMARC1; p=none; rua=mailto:dmarc@teu-dominio.pt` |

3. Aguarda verificação (ícone verde)

### 3. API key SMTP

1. **API Keys** → **Create API Key**
2. Permissão: **Sending access**
3. A **mesma key** serve como password SMTP

### 4. `.env` na NexiForma

```env
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxx_sua_api_key

MAIL_FROM="NexiForma <noreply@teu-dominio.pt>"
MAIL_REPLY_TO=suporte@teu-dominio.pt

APP_PUBLIC_URL=https://app.teu-dominio.pt
CRON_NOTIFICACOES_ENABLED=true
```

> Resend usa `SMTP_USER=resend` fixo e a API key como password.

### 5. Testar

Igual ao Brevo - digest em `/portal/notificacoes` e reset de password.

---

## Checklist de entregabilidade

- [ ] Domínio verificado (verde na consola Brevo/Resend)
- [ ] SPF publicado (`include:spf.brevo.com` ou valor Resend)
- [ ] DKIM activo (CNAME/TXT verificados)
- [ ] DMARC em `_dmarc` (mínimo `p=none`)
- [ ] `MAIL_FROM` usa `@teu-dominio.pt` (não Gmail pessoal)
- [ ] `MAIL_REPLY_TO` aponta para caixa real
- [ ] `APP_PUBLIC_URL` = URL pública correcta (links nos emails)
- [ ] Email de teste **não** foi para spam
- [ ] `CRON_NOTIFICACOES_ENABLED=true` se quiseres lembretes automáticos

---

## Problemas comuns

| Sintoma | Solução |
|---------|---------|
| API log: «SMTP não configurado» | Falta `SMTP_HOST` ou não reiniciaste a API após `.env` |
| «Envio real» mas email não chega | Verifica spam; domínio ainda não verificado no Brevo/Resend |
| Bounce / rejeitado | `MAIL_FROM` diferente do domínio verificado |
| Links no email quebrados | Corrigir `APP_PUBLIC_URL` |
| Limite excedido | Brevo 300/dia ou Resend 3000/mês - upgrade ou esperar |
| Só funciona em dev log | `MAIL_PROVIDER=log` - mudar para `smtp` |

---

## Desenvolvimento local

Podes manter `MAIL_PROVIDER=log` em dev e usar SMTP só em staging/produção.

Para testar SMTP localmente, usa as mesmas variáveis no `.env` - os emails saem a sério.

---

## Referência rápida NexiForma

| Variável | Obrigatório (SMTP) |
|----------|-------------------|
| `MAIL_PROVIDER` | `smtp` |
| `SMTP_HOST` | `smtp-relay.brevo.com` ou `smtp.resend.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Login Brevo ou `resend` |
| `SMTP_PASS` | Chave SMTP / API key |
| `MAIL_FROM` | `"Nome <noreply@dominio.pt>"` |
| `MAIL_REPLY_TO` | Email de suporte |

Ver também: [CANAIS_MENSAGENS.md](./CANAIS_MENSAGENS.md), [.env.example](../.env.example)
