# Certificação software AT – Fase 10B.5

> Processo **gratuito** junto da Autoridade Tributária para software de faturação certificável.
> A implementação técnica no NexiForma prepara o produto; a **aprovação oficial** é um processo administrativo paralelo.
>
> Credenciais e configuração: **[CREDENCIAIS_AT.md](./CREDENCIAIS_AT.md)**

## O que o NexiForma já implementa


| Requisito                         | Implementação                                                    |
| --------------------------------- | ---------------------------------------------------------------- |
| ATCUD + QR Code                   | Emissão de fatura (`POST .../emitir`)                            |
| Numeração sequencial imutável     | Séries `SerieFaturacao.proximoNumero`                            |
| Hash de integridade SHA-256       | `FaturaComercial.hashIntegridade` na emissão                     |
| Comunicação webservice AT         | `RegisterInvoice` (`POST .../comunicar-at`)                      |
| Anulação na AT                    | `ChangeInvoiceStatus` (`POST .../anular`) - ver secção abaixo    |
| Nota de crédito (NC)              | `POST .../faturas/:id/nota-credito` - série NC + referência à FT |
| Nota de débito (ND)               | ⏳ **obrigatório** - ainda em falta (ver abaixo)                  |
| Registo de séries AT              | `registarSerie` - código de validação **automático** (8 chars)   |
| Anulação de série AT              | `anularSerie`                                                    |
| Auditoria de respostas AT         | `FaturaComunicacaoAt`                                            |
| Licença Anexo II (adesão WS)      | Aceite obrigatório em `/portal/crm/faturacao`                    |
| Checklist de prontidão            | `/portal/crm/faturacao` + `GET .../certificacao`                 |
| Bloqueio produção sem certificado | API + UI                                                         |
| Histórico de faturação imutável   | Proibido apagar - ver secção abaixo                              |




### Histórico de faturação - proibido apagar

É **expressamente proibido** apagar qualquer histórico de faturação (faturas, linhas emitidas, séries, comunicações AT, ATCUD/hash).

- Correcções: **anulação** (`ChangeInvoiceStatus`), **nota de crédito (NC)** ou **nota de débito (ND)**.
- BD: FK `ON DELETE RESTRICT` em faturas/séries (não cascateiam com tenant/cliente).
- API: bloqueio ao eliminar entidade/tenant com documentos de faturação.
- RGPD DELETE: apenas anonimiza dados pessoais - **nunca** remove documentos fiscais.



### Códigos de validação de séries

**Não é necessário** ir ao Portal das Finanças obter o código manualmente na operação normal.

1. O gestor cria a série no NexiForma.
2. Com WFA configurado e `AT_SERIES_MODE` activo, o NexiForma chama o webservice de séries (`registarSerie`).
3. A AT devolve `codValidacaoSerie` (8 caracteres) → gravado em `SerieFaturacao.codigoValidacaoAt`.
4. Na emissão, o ATCUD usa esse código (`código-número`).

Fallback: colar manualmente o código (Portal AT ou série já registada fora do NexiForma).  
Auto-registo na emissão: activo quando `AT_SERIES_MODE ≠ disabled` (ou `AT_SERIES_AUTO_REGISTER=1`).

### Anulação de faturas - existe webservice?

**Sim.** O webservice de documentos (factemiws) expõe `ChangeInvoiceStatusRequest` para alterar o estado do documento (anulação = estado `A`).

No NexiForma:

- `POST /crm/faturas/:id/anular` - se a fatura já estiver `COMUNICADA_AT`, comunica a anulação à AT antes de marcar `ANULADA` localmente.
- Envelope: `buildChangeInvoiceStatusSoapEnvelope` em `at-faturas-payload.util.ts`.
- SOAP Action: `AT_SOAP_ACTION_CHANGE_STATUS`.

Não existe um webservice separado só de “cancelamento”; é a mesma API de documentos, operação de alteração de estado.  
**Anular ≠ NC/ND:** anulação altera o estado do documento original; nota de crédito / débito são **documentos novos** (séries próprias), comunicados com `RegisterInvoice` e referência à fatura original.

### Notas de crédito (NC) e notas de débito (ND) - requisito

Para software de faturação certificável / operação completa AT, o NexiForma **tem de permitir emitir**:


| Documento           | Tipo série | Função                                                                  | Estado NexiForma                          |
| ------------------- | ---------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| Fatura              | `FT`       | Documento de venda                                                      | ✅                                         |
| Fatura simplificada | `FS`       | (quando aplicável)                                                      | ✅ série                                   |
| **Nota de crédito** | `NC`       | Corrige/anula valores a favor do cliente (documento novo com ref. à FT) | ✅ criar a partir de FT + emitir/comunicar |
| **Nota de débito**  | `ND`       | Corrige valores a favor do emitente (documento novo com ref. à FT)      | ⏳ **falta implementar**                   |


Requisitos funcionais (NC e ND):

1. Série própria registada na AT (`registarSerie` tipo `NC` / `ND`) com código de validação.
2. Numeração, ATCUD, QR e hash próprios (como qualquer documento emitido).
3. Referência obrigatória ao documento original (FT) no payload AT / SAF-T.
4. Comunicação à AT via `RegisterInvoice` (não via `ChangeInvoiceStatus`).
5. UI/API para o gestor emitir a partir da fatura (ou fluxo equivalente).

Hoje: `SerieFaturacaoTipo` = `FT | FS | NC` - **sem** `ND`. Payload/SAF-T já tratam `ND` em alguns sítios; falta enum, criação (`criarNotaDebito`), série auto e UI.

## O que falta para funcionar de ponta a ponta



### Administrativo / plataforma (produtor NexiForma)


| Item                                       | Estado (2026-07)             | Notas                                                                       |
| ------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------- |
| Certificado cliente mTLS (adesão produtor) | ✅ obtido                     | CN=`515834963` → PFX `certs/at-producer-515834963.pfx`                      |
| Chave pública cifra AT (WS-Security)       | ⚠️ verificar validade        | `AT_FATURAS_PUBLIC_KEY_PATH=./certs/at-public-key.pem`                      |
| Depósito ASSOFT (direitos de autor)        | ⏳                            | Pré-requisito Modelo 24 (campo 06)                                          |
| Modelo 24 / n.º certificação AT            | ⏳                            | Preencher `AT_SOFTWARE_CERT_NUMBER` (hoje placeholder `9999`)               |
| Teste SOAP produção com credenciais reais  | ⏳                            | mTLS `:400`/`:422` OK; auth falha com user de teste `599999993/37`          |
| Sandbox AT (`:700`/`:722`)                 | ❌ certificado teste expirado | Cert produtor **não** é aceite na sandbox; só `TesteWebservices.pfx` válido |




### Código NexiForma (já coberto vs gaps)


| Capacidade                                                | Estado                                                 |
| --------------------------------------------------------- | ------------------------------------------------------ |
| RegisterInvoice / ChangeInvoiceStatus / séries            | ✅ implementado                                         |
| Aceite Licença Anexo II + bloqueios                       | ✅                                                      |
| Emissão ATCUD/QR/hash + UI faturação (FT)                 | ✅                                                      |
| Emissão nota de crédito (NC)                              | ✅ (criar a partir de FT)                               |
| Emissão nota de débito (ND)                               | ⏳ **a implementar** (tipo série + API/UI + registo AT) |
| Validação E2E produção com n.º certificação real          | ⏳ depende AT + Modelo 24                               |
| Renovar/obter chave pública AT actual se a actual expirar | ⏳ operacional                                          |


Bloqueios actuais: **certificação + credenciais reais** (plataforma) e **nota de débito (ND)** no produto.

## O que cada tenant configura para emitir faturas

Em **Portal → CRM → Faturação** (`/portal/crm/faturacao`):


| #   | Configuração                                                                                            | Obrigatório para emitir?        | Obrigatório para comunicar AT?                |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------- |
| 1   | Aceitar **Licença Anexo II**                                                                            | Sim (bloqueia WS)               | Sim                                           |
| 2   | **Dados do emitente**: nome, NIF, morada fiscal, IBAN, BIC, email gestor, capital social, Conservatória | Sim (documento legal)           | Sim                                           |
| 3   | **Série(s)** FT; **NC** e **ND** quando emitir notas; FS se usar                                        | Sim (FT)                        | Sim (código AT por série)                     |
| 4   | **Subutilizador WFA** + **password WFA** (Portal das Finanças, por NIF da entidade)                     | Não*                            | Sim                                           |
| 5   | Código validação série                                                                                  | Obtido via «Registar AT» / auto | Sim em produção                               |
| 6   | Activar **Comunicação AT** (checklist verde)                                                            | Não                             | Sim                                           |
| 7   | N.º certificação software                                                                               | Override opcional               | Plataforma ou tenant; obrigatório em produção |
| 8   | Referência certificado SSL adesão                                                                       | Não                             | Recomendado (informativo)                     |


 Sem WFA pode emitir em rascunho/local conforme modo servidor, mas **não** comunica à AT nem obtém código de série automático em produção.

Formato WFA: `NIF/subutilizador` (ex. `123456789/1`). Se introduzir só `1`, o NexiForma usa `{NIF_emitente}/1`.

Fluxo típico do gestor:

1. Aceitar licença Anexo II
2. Preencher dados legais/bancários do emitente
3. Criar série → «Registar AT» (grava código automático)
4. Guardar WFA + password
5. Activar comunicação AT quando o checklist estiver verde
6. Emitir fatura → comunicar AT (ou fluxo automático conforme config)



## Processo AT (checklist operacional - produtor)

1. **Desenvolver** motor de faturação conforme especificação AT (10B ✅)
2. **ASSOFT** - depósito de direitos de autor (n.º para Modelo 24)
3. **Submeter** Modelo 24 / [Programa de faturação certificada](https://www.gov.pt/servicos/programa-de-faturacao-certificacao)
4. **Obter** número de certificação → `AT_SOFTWARE_CERT_NUMBER`
5. **Adesão** produtor + certificado SSL/PFX no servidor (já feito para NIF 515834963)
6. **Configurar** `.env` produção (`AT_FATURAS_MODE=production`, PFX, chave pública)
7. Cada **tenant**: WFA próprio + séries via webservice + checklist verde



## Modos de operação


| Modo         | Uso                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `production` | Webservice AT real (`:400` faturas, `:422` séries) - exige certificação + WFA                                    |
| `sandbox`    | Dev/staging; webservice teste AT (`:700`/`:722`) se houver PFX de teste válido; ou mock local (`*_SANDBOX_MOCK`) |
| `disabled`   | Integração desactivada                                                                                           |




## Referências

- **[Credenciais AT – guia de obtenção](./CREDENCIAIS_AT.md)**
- [Especificação webservice 2022+](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Negocios/Faturacao/Regras_mecanismos_comunicacao/e_Fatura/e_Fatura_Comunicacao_elementos_docs_faturacao_2022_seguintes/Paginas/default.aspx)
- [FAQs webservice faturas AT](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/pages/faqs-00996.aspx)
- [docs/FASE_10B_FATURACAO_AT_CRM.md](./FASE_10B_FATURACAO_AT_CRM.md)
- Código: `apps/api/src/faturas/at-faturas-*.ts`, `at-series-*.ts`, `at-certificacao.util.ts`

