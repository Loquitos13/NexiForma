# Certificação software AT – Fase 10B.5

> Processo **gratuito** junto da Autoridade Tributária para software de faturação certificável.
> A implementação técnica no NexiForma prepara o produto; a **aprovação oficial** é um processo administrativo paralelo.

## O que o NexiForma já implementa

| Requisito | Implementação |
|-----------|----------------|
| ATCUD + QR Code | Emissão de fatura (`POST .../emitir`) |
| Numeração sequencial imutável | Séries `SerieFaturacao.proximoNumero` |
| Hash de integridade SHA-256 | `FaturaComercial.hashIntegridade` na emissão |
| Comunicação webservice AT | `POST .../comunicar-at` (modo `production`) |
| Auditoria de respostas AT | `FaturaComunicacaoAt` |
| Checklist de prontidão | `/portal/crm/faturacao` + `GET .../certificacao` |
| Código validação série AT | `SerieFaturacao.codigoValidacaoAt` (8 chars) |
| Bloqueio produção sem certificado | API + UI |

## Variáveis de ambiente (plataforma)

Ver guia completo: **[CREDENCIAIS_AT.md](./CREDENCIAIS_AT.md)**

```env
AT_FATURAS_MODE=production          # ou disabled
AT_FATURAS_ENDPOINT=https://servicos.portaldasfinancas.gov.pt:400/fews/faturas
AT_FATURAS_PUBLIC_KEY_PATH=./certs/at-public-key.pem
AT_FATURAS_CLIENT_CERT_PFX_PATH=./certs/at-producer.pfx
AT_CREDENTIALS_ENCRYPTION_KEY=
AT_SOFTWARE_CERT_NUMBER=      # n.º certificação AT (após aprovação NexiForma)
```

Por tenant (gestor em `/portal/crm/faturacao`):

- `softwareCertificado` - override opcional
- `atCertificadoRef` - referência certificado SSL adesão
- `atSubutilizador` - subutilizador WFA
- Códigos de validação por série

## Processo AT (checklist operacional)

1. **Desenvolver** motor de faturação conforme especificação AT (10B.1–10B.4 ✅)
2. **Submeter** candidatura no [Programa de faturação certificada](https://www.gov.pt/servicos/programa-de-faturacao-certificacao)
3. **Obter** número de certificação do software
4. **Registar** séries e códigos de validação no Portal das Finanças
5. **Criar** subutilizador WFA para comunicação de faturas
6. **Adesão** produtor software + certificado SSL (referência em `atCertificadoRef`)
7. **Configurar** `AT_SOFTWARE_CERT_NUMBER` e `AT_FATURAS_MODE=production`
8. **Activar** comunicação AT no tenant após checklist verde

## Modos de operação

| Modo | Uso |
|------|-----|
| `production` | Webservice AT real - exige certificação + credenciais |
| `disabled` | Integração desactivada até configurar credenciais |

## Referências

- **[Credenciais AT – guia de obtenção](./CREDENCIAIS_AT.md)**
- [Especificação webservice 2022+](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Negocios/Faturacao/Regras_mecanismos_comunicacao/e_Fatura/e_Fatura_Comunicacao_elementos_docs_faturacao_2022_seguintes/Paginas/default.aspx)
- [FAQs webservice faturas AT](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/pages/faqs-00996.aspx)
- [docs/FASE_10B_FATURACAO_AT_CRM.md](./FASE_10B_FATURACAO_AT_CRM.md)
