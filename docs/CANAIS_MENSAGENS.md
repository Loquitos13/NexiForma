# Notificações – só email

A NexiForma envia **tudo por email** por defeito: convites, recuperação de password, lembretes de sessão, certificados, alertas compliance e digest semanal.

**Não precisas de SMS, Telegram, WhatsApp nem push no browser.**

---

## Configuração mínima

### Desenvolvimento

```env
MAIL_PROVIDER=log
```

Os emails aparecem no log da API (inclui links de reset de password).

### Produção (SMTP grátis – ex. Brevo)

```env
MAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="NexiForma <noreply@teu-dominio.pt>"
MAIL_REPLY_TO=suporte@teu-dominio.pt
APP_PUBLIC_URL=https://app.teu-dominio.pt

CRON_NOTIFICACOES_ENABLED=true
```

Alternativas SMTP grátis: **Resend**, **Mailjet**. Em AWS: `MAIL_PROVIDER=ses`.

### O que **não** configurar

- `SMS_PROVIDER` - omitir (SMS desactivado)
- `VAPID_*` - omitir (push desactivado)
- `TELEGRAM_*` - omitir

---

## O que é enviado por email

| Evento | Destinatário | Email usado |
|--------|--------------|-------------|
| Convite de utilizador | Novo membro | `User.email` |
| Recuperação password | Quem pediu reset | `User.email` |
| Sessão amanhã (cron 18h) | Formandos matriculados | contacto → conta |
| Sessão iniciada | Formandos + formador | contacto / perfil formador |
| Certificado emitido | Formando | contacto → conta |
| Alertas compliance | Gestores (ADMIN, COORD, FINANCEIRO) | `User.email` |
| Digest alertas (cron 8h) | Gestores + formadores | perfil formador → conta |
| Resumo inspeção DGERT (seg 9h) | Coordenadores + admin | `User.email` |
| CC/CCP formador a expirar | Formador | perfil → conta |
| Email reunião incorrecto | Formador + coordenadores | perfil / conta |
| Pedido anulação fatura | Gestores | `User.email` |
| Anulação rejeitada | Comercial solicitante | `User.email` |
| Proposta aceite/rejeitada | Gestores | `User.email` |
| Proposta aceite/rejeitada (enviada pelo comercial) | Comercial que enviou | `User.email` |
| Formação catálogo actualizada/despublicada/eliminada | Gestores | `User.email` |
| Sync website falhou | Gestores | `User.email` |
| Erro plataforma (qualquer tenant) | Superadmin (`platform_users`) | email da conta |

### Endereço por perfil

| Perfil | Regra |
|--------|--------|
| **Formando** | `FormandoProfile.email` → `User.email` |
| **Formador** | `FormadorProfile.email` → `User.email` |
| **Gestor** | `User.email` |
| **Comercial** | `User.email` | Propostas que enviou (aceite/rejeitada) |
| **Gestor** | `User.email` | Propostas, faturação, catálogo formações, sync website, compliance |
| **Superadmin** | `platform_users.email` | Erros críticos em qualquer tenant |

Disparo manual: `/portal/notificacoes`.

---

## Entregabilidade

1. Usa domínio próprio em `MAIL_FROM` (não `@gmail.com` como remetente)
2. Configura SPF, DKIM e DMARC no DNS
3. Checklist na UI `/portal/notificacoes`

Ver [.env.example](../.env.example), [DEPLOY_PRODUCAO.md](./DEPLOY_PRODUCAO.md) e **[EMAIL_SMTP_SETUP.md](./EMAIL_SMTP_SETUP.md)** (passo a passo Brevo/Resend).
