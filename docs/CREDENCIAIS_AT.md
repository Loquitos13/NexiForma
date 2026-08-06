# Credenciais AT – Guia de obtenção e configuração

> Activar comunicação de faturas (**factemiws** / `RegisterInvoice`), anulação (`ChangeInvoiceStatus`) e séries (`registarSerie`) no NexiForma.
>
> Visão produto / gaps: **[CERTIFICACAO_SOFTWARE_AT.md](./CERTIFICACAO_SOFTWARE_AT.md)** · Deploy: [DEPLOY_PRODUCAO.md](./DEPLOY_PRODUCAO.md)

---

## Duas camadas de credenciais


| Camada                    | Quem                    | O quê                                                       |
| ------------------------- | ----------------------- | ----------------------------------------------------------- |
| **Plataforma (produtor)** | Equipa NexiForma        | PFX mTLS, chave pública cifra AT, `AT_SOFTWARE_CERT_NUMBER` |
| **Tenant (emitente)**     | Cada entidade formadora | Subutilizador WFA + password, dados fiscais, séries         |


O certificado de adesão do produtor **não** substitui o WFA do cliente.

---



## Modos


| Modo         | Descrição                                            |
| ------------ | ---------------------------------------------------- |
| `disabled`   | Integração desactivada                               |
| `sandbox`    | Dev/staging (`:700`/`:722` ou mock `*_SANDBOX_MOCK`) |
| `production` | Webservice real (`:400` faturas, `:422` séries)      |


---



## 1. O que cada tenant configura (emitir + comunicar)

UI: **Portal → CRM → Faturação** (`/portal/crm/faturacao`).

### Checklist mínimo


| #   | Item                                                                                       | Onde obter                                                                       | Notas                                                                                                              |
| --- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Aceite **Licença Anexo II**                                                                | Checkbox no portal NexiForma                                                     | Obrigatório antes de qualquer WS                                                                                   |
| 2   | Dados emitente (nome, NIF, morada, IBAN, BIC, email gestor, capital social, Conservatória) | Dados da empresa                                                                 | Bloqueante no checklist                                                                                            |
| 3   | Série(s) **FT**; **NC** e **ND** (notas de crédito/débito); FS se usar                     | Criadas no NexiForma                                                             | NC ✅; ND ⏳ (ver [CERTIFICACAO](./CERTIFICACAO_SOFTWARE_AT.md#notas-de-crédito-nc-e-notas-de-débito-nd--requisito)) |
| 4   | **Código validação série**                                                                 | **Automático** via «Registar AT» (`registarSerie`)                               | Uma série AT por tipo (FT, NC, ND, …); fallback: colar 8 chars                                                     |
| 5   | **Subutilizador WFA** + **password**                                                       | [Portal das Finanças](https://www.portaldasfinancas.gov.pt) → webservice faturas | Por NIF da **entidade**, não do produtor                                                                           |
| 6   | Comunicação AT activa                                                                      | Toggle após checklist verde                                                      | -                                                                                                                  |
| 7   | N.º certificação software                                                                  | Opcional no tenant                                                               | Em geral vem do `.env` da plataforma                                                                               |
| 8   | Referência certificado SSL                                                                 | Processo adesão produtor                                                         | Informativo / recomendado                                                                                          |


Formato subutilizador: `NIF/subutilizador` (ex. `123456789/1`). Se introduzir só `1`, o NexiForma usa `{NIF_emitente}/1`.

### Só emitir vs comunicar AT

- **Emitir** documento local (número, ATCUD, QR): precisa série com código de validação + dados legais.
- **Comunicar / anular na AT**: precisa ainda WFA + password + modo servidor `production` (ou sandbox real) + licença aceite + n.º certificação em produção.



### Séries - automático

Na operação normal o gestor **não** vai ao Portal AT buscar o código:

1. Cria a série no NexiForma
2. Clica «Registar AT» (ou a emissão auto-regista se `AT_SERIES_MODE` activo)
3. A AT devolve o código de 8 caracteres → `codigoValidacaoAt`

---



## 2. Credenciais da plataforma (`.env` servidor)

```env
AT_FATURAS_MODE=production
AT_SERIES_MODE=production
AT_FATURAS_ENDPOINT=https://servicos.portaldasfinancas.gov.pt:400/fews/faturas
AT_SERIES_ENDPOINT=https://servicos.portaldasfinancas.gov.pt:422/SeriesWSService
AT_FATURAS_PUBLIC_KEY_PATH=/run/secrets/at-public-key.pem
AT_FATURAS_CLIENT_CERT_PFX_PATH=/run/secrets/at-producer.pfx
AT_FATURAS_CLIENT_CERT_PASSPHRASE=
AT_SOFTWARE_CERT_NUMBER=
AT_CREDENTIALS_ENCRYPTION_KEY=
AT_FATURAS_TIMEOUT_MS=30000
```


| Variável                        | Origem                                                 |
| ------------------------------- | ------------------------------------------------------ |
| Chave pública AT                | Manual técnico / adesão factemiws (cifra password WFA) |
| Certificado PFX (mTLS)          | Adesão **produtor** de software AT                     |
| `AT_SOFTWARE_CERT_NUMBER`       | Certificação do software NexiForma (Modelo 24)         |
| `AT_CREDENTIALS_ENCRYPTION_KEY` | Gerada pela equipa DevOps (não vem da AT)              |


**Atenção naming:** um `.cer` devolvido na adesão com nome tipo “Chave Cifra Publica AT” pode ser o **certificado do produtor** (CN=NIF), não a chave pública de cifra. A cifra WS-Security continua em `at-public-key.pem` (CN típico `Chave Cifra Publica AT`).

---



## 3. Processo administrativo



### Produtor (uma vez)

1. ASSOFT → depósito direitos de autor
2. Modelo 24 / programa faturação certificada → n.º certificação
3. Adesão produtor + certificado SSL/PFX no servidor
4. Configurar `.env` (`AT_*_MODE=production`, PFX, chave pública, n.º certificação)



### Cada entidade (tenant)

1. Criar subutilizador WFA no Portal das Finanças
2. Aceitar Licença Anexo II no NexiForma
3. Preencher dados emitente
4. Criar séries e «Registar AT» (código automático)
5. Activar comunicação AT

---



## 4. Webservices usados


| Operação          | Pedido AT                                 | Endpoint típico (produção) | NexiForma            |
| ----------------- | ----------------------------------------- | -------------------------- | -------------------- |
| Comunicar fatura  | `RegisterInvoiceRequest`                  | `:400/fews/faturas`        | `comunicar-at`       |
| **Anular fatura** | `ChangeInvoiceStatusRequest` (estado `A`) | mesmo                      | `anular`             |
| Registar série    | `registarSerie`                           | `:422/SeriesWSService`     | «Registar AT» / auto |
| Anular série      | `anularSerie`                             | `:422`                     | API séries           |


Sim: existe webservice para anular faturas - `ChangeInvoiceStatus`, já implementado. Não é um serviço separado; é alteração de estado no factemiws.

---



## 5. O que falta (estado 2026-07)

Ver tabela detalhada em [CERTIFICACAO_SOFTWARE_AT.md](./CERTIFICACAO_SOFTWARE_AT.md#o-que-falta-para-funcionar-de-ponta-a-ponta).

Resumo: motor (emitir FT, NC, comunicar, anular, séries) ✅; **ND (nota de débito) em falta**; falta n.º certificação real, WFA de entidades reais, validação E2E produção; sandbox AT bloqueada pelo PFX de teste expirado.

---



## 6. Resolução de problemas


| Sintoma                      | Acção                                                      |
| ---------------------------- | ---------------------------------------------------------- |
| «Comunicação AT desactivada» | `AT_FATURAS_MODE=production` + credenciais servidor        |
| Password WFA em falta        | CRM → Faturação                                            |
| Código série em falta        | «Registar AT» na série (ou colar fallback)                 |
| Código AT `-3`               | Documento duplicado na AT                                  |
| Códigos 1–13, 99             | Erro WS-Security - verificar WFA e chave pública           |
| Fault `118` séries           | Autenticação/autorização - WFA ou n.º certificação         |
| TLS sandbox `ERR_SSL_*`      | Cert produtor não serve em `:700`; precisa PFX de teste AT |
| Checklist bloqueada          | Completar licença, emitente, WFA, séries, certificação     |


---



## Referências

- [Especificação webservice 2022+](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Negocios/Faturacao/Regras_mecanismos_comunicacao/e_Fatura/e_Fatura_Comunicacao_elementos_docs_faturacao_2022_seguintes/Paginas/default.aspx)
- [FAQs webservice faturas AT](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/pages/faqs-00996.aspx)
- [nunopicado/AtWS](https://github.com/nunopicado/AtWS) (exemplos técnicos)
- Código: `apps/api/src/faturas/at-faturas-*.ts`, `at-series-*.ts`

