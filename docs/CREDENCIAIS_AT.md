# Credenciais AT – Guia de obtenção e configuração (produção)

> Referência para activar a comunicação de faturas ao webservice **factemiws** (`RegisterInvoice`) no NexiForma.
>
> Relacionado: [DEPLOY_PRODUCAO.md](./DEPLOY_PRODUCAO.md) · [CERTIFICACAO_SOFTWARE_AT.md](./CERTIFICACAO_SOFTWARE_AT.md)

---

## Modos permitidos

| Modo | Descrição |
|------|-----------|
| `disabled` | Integração desactivada (default até configurar credenciais) |
| `production` | Webservice real AT (porta 400) |

Não existem modos mock ou sandbox - a plataforma está preparada apenas para produção.

---

## 1. Credenciais por tenant (gestor)

Configurar em **Portal → CRM → Faturação** (`/portal/crm/faturacao`).

| Credencial | Onde obter | Campo no NexiForma |
|------------|------------|-------------------|
| **Subutilizador WFA** | [Portal das Finanças](https://www.portaldasfinancas.gov.pt) → webservice faturas | «Subutilizador WFA» |
| **Password WFA** | Criada com o subutilizador AT | «Password WFA» (encriptada em BD) |
| **Código validação por série** (8 chars) | Portal AT → registo de séries | Por série FT / NC / FS |
| **N.º certificação software** | [Programa faturação certificada](https://www.gov.pt/servicos/programa-de-faturacao-certificacao) | Campo ou `AT_SOFTWARE_CERT_NUMBER` global |
| **Referência certificado SSL** | Processo adesão produtor software | «Referência certificado SSL AT» |

Formato subutilizador: `NIF/subutilizador` (ex. `123456789/1`). Se introduzir só `1`, o NexiForma usa `{NIF_emitente}/1`.

---

## 2. Credenciais da plataforma (`.env` servidor)

```env
AT_FATURAS_MODE=production
AT_FATURAS_ENDPOINT=https://servicos.portaldasfinancas.gov.pt:400/fews/faturas
AT_FATURAS_PUBLIC_KEY_PATH=/run/secrets/at-public-key.pem
AT_FATURAS_CLIENT_CERT_PFX_PATH=/run/secrets/at-producer.pfx
AT_FATURAS_CLIENT_CERT_PASSPHRASE=
AT_SOFTWARE_CERT_NUMBER=
AT_CREDENTIALS_ENCRYPTION_KEY=
AT_FATURAS_TIMEOUT_MS=30000
AT_FATURAS_WSDL_URL=https://servicos.portaldasfinancas.gov.pt:400/fews/faturas?wsdl
```

| Variável | Origem |
|----------|--------|
| Chave pública AT | Manual técnico / processo adesão factemiws |
| Certificado PFX (mTLS) | Adesão produtor de software AT |
| `AT_SOFTWARE_CERT_NUMBER` | Certificação do software NexiForma |
| `AT_CREDENTIALS_ENCRYPTION_KEY` | Gerada pela equipa DevOps (não vem da AT) |

---

## 3. Processo administrativo AT

1. Submeter software no [Programa de faturação certificada](https://www.gov.pt/servicos/programa-de-faturacao-certificacao)
2. Obter número de certificação
3. Registar séries e códigos de validação no Portal AT
4. Criar subutilizador WFA por entidade formadora
5. Concluir adesão produtor software + certificado SSL
6. Configurar `.env` de produção
7. Activar «Comunicação AT activa» no tenant (checklist verde)

---

## 4. Resolução de problemas

| Sintoma | Acção |
|---------|--------|
| «Comunicação AT desactivada» | `AT_FATURAS_MODE=production` + credenciais servidor |
| Password WFA em falta | CRM → Faturação |
| Código AT `-3` | Documento duplicado na AT |
| Códigos 1–13, 99 | Erro WS-Security - verificar WFA e chave pública |
| Checklist bloqueada | Completar certificação e dados emitente |

---

## Referências

- [Especificação webservice 2022+](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Negocios/Faturacao/Regras_mecanismos_comunicacao/e_Fatura/e_Fatura_Comunicacao_elementos_docs_faturacao_2022_seguintes/Paginas/default.aspx)
- [FAQs webservice faturas AT](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/pages/faqs-00996.aspx)
- [nunopicado/AtWS](https://github.com/nunopicado/AtWS) (exemplos técnicos)
- Código: `apps/api/src/faturas/at-faturas-*.ts`
