# Fase 10B – Faturação AT integrada no CRM

> **Objectivo:** permitir a **emissão legal de faturas** e **comunicação em tempo real à AT** (webservice e-fatura), dentro do fluxo comercial já existente (entidades → propostas → faturação).
>
> **Utilizadores:** `tenant_manager` (gestor) e `comercial`.
>
> **Custo AT:** webservice e certificação de software são **gratuitos**; o investimento é desenvolvimento, certificação operacional e manutenção.

---

## Posicionamento no produto

```
Entidade cliente → Proposta (RASCUNHO → ENVIADA → ACEITE) → Fatura → Comunicação AT → PDF/email ao cliente
```

| Papel | Permissões |
|-------|------------|
| **comercial** | Criar fatura a partir de proposta aceite, editar rascunho, emitir, enviar ao cliente, consultar estado AT |
| **tenant_manager** | Tudo do comercial + configurar séries/AT, anular faturas, reenviar comunicação, relatórios CRM |

---

## Entregáveis

### 1. Motor de faturação (NexiForma)

- Séries de documentos por tenant (FT, FS, NC, etc.)
- Numeração sequencial e **imutabilidade** após emissão
- Linhas com IVA (taxas PT: isento, reduzida, intermédia, normal)
- Cálculo de totais, retenções opcionais (fase 2)
- **ATCUD** + **QR Code** no documento (requisito legal)
- Assinatura/hash de integridade (algoritmo exigido para software certificável)
- PDF/HTML imprimível (reutilizar padrão `openHtmlForPrint` / export HTML)

### 2. Integração AT (webservice SOAP)

- Cliente SOAP conforme WSDL oficial (`factemiws` / especificação Portal Finanças)
- Autenticação: subutilizador **WFA – Comunicação de dados de faturas**
- HTTPS + certificado SSL do processo de adesão (produtor de software)
- Operação **Registo de Documento Comercial** por fatura emitida
- Tratamento de respostas: sucesso, erro de validação, erro de autenticação
- Modos **`production`** (webservice real), **`sandbox`** (simulação local para testes) ou **`disabled`** (até credenciais AT)

### 3. Modelo de dados (Prisma – proposta)

```prisma
enum FaturaEstado {
  RASCUNHO
  EMITIDA
  COMUNICADA_AT
  ANULADA
}

model ConfigFaturacaoTenant {
  tenantId           String   @id
  nifEmitente        String   // espelha tenant; validado
  regimeIva          String   // NORMAL | ISENTO | ...
  seriePadrao        String
  atSubutilizador    String?  // referência; segredo em Secrets Manager
  atCertificadoRef   String?  // identificador do certificado SSL AT
  softwareCertificado String? // nº certificado AT (após certificação)
  comunicacaoAtiva   Boolean  @default(false)
}

model SerieFaturacao {
  id          String
  tenantId    String
  codigo      String   // ex. "2026"
  tipo        String   // FT | FS | NC
  proximoNumero Int
  ativo       Boolean
}

model FaturaComercial {
  id                String
  tenantId          String
  entidadeClienteId String
  propostaId        String?  @unique // ligação opcional 1:1
  serieId           String
  numero            Int
  codigoAtcud       String?
  estado            FaturaEstado
  dataEmissao       DateTime?
  dataVencimento    DateTime?
  valorCentavos     Int
  ivaCentavos       Int
  moeda             String   @default("EUR")
  linhas            FaturaLinha[]
  comunicacoesAt    FaturaComunicacaoAt[]
  emitidaPorUserId  String?
  anuladaEm         DateTime?
  motivoAnulacao    String?
}

model FaturaLinha {
  id              String
  faturaId        String
  descricao       String
  quantidade      Decimal
  precoUnitCentavos Int
  taxaIva         Decimal
  valorIvaCentavos  Int
}

model FaturaComunicacaoAt {
  id           String
  faturaId     String
  tentativaEm  DateTime
  sucesso      Boolean
  codigoResposta String?
  mensagemAt   String?
  payloadHash  String?  // auditoria sem guardar PII em claro
}
```

### 4. API NestJS (`/v1/crm/faturas` ou `/v1/faturas`)

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/crm/faturas` | manager, comercial | Listar (filtro entidade, estado, datas) |
| GET | `/crm/faturas/:id` | manager, comercial | Detalhe + histórico AT |
| POST | `/crm/propostas/:id/faturar` | manager, comercial | Cria rascunho a partir de proposta **ACEITE** |
| POST | `/crm/faturas` | manager, comercial | Criar rascunho manual |
| PATCH | `/crm/faturas/:id` | manager, comercial | Editar só em RASCUNHO |
| POST | `/crm/faturas/:id/emitir` | manager, comercial | Fecha numeração, gera ATCUD/QR |
| POST | `/crm/faturas/:id/comunicar-at` | manager, comercial | Envia ao webservice AT |
| POST | `/crm/faturas/:id/anular` | **manager** | Anula + comunica anulação AT |
| GET | `/crm/faturas/:id/documento.html` | manager, comercial | PDF/HTML para impressão |
| GET | `/crm/config/faturacao` | **manager** | Config tenant |
| PATCH | `/crm/config/faturacao` | **manager** | Séries, flags, credenciais AT |

### 5. UI CRM (`/portal/crm` e `/portal/propostas`)

- **Dashboard CRM:** KPI faturação emitida / pendente comunicação AT
- **Lista de faturas** (`/portal/crm/faturas`): tabela com estado, cliente, valor, estado AT
- **Detalhe fatura:** linhas, totais, botões Emitir / Comunicar AT / Imprimir / Enviar email
- **Propostas:** botão **«Faturar»** visível quando `estado === ACEITE` e ainda sem fatura
- **Configuração** (`/portal/crm/faturacao`): só gestor – séries, teste de ligação AT, estado certificação
- Reutilizar roles existentes: `@Roles("tenant_manager", "comercial")`

---

## Fases de implementação

| Sub-fase | Conteúdo | Dependências |
|----------|----------|--------------|
| **10B.1** | Schema Prisma + CRUD faturas + rascunho desde proposta | CRM actual |
| **10B.2** | Emissão (série, ATCUD, QR, PDF/HTML) | 10B.1 |
| **10B.3** | Cliente SOAP AT + comunicação + auditoria | 10B.2, credenciais AT |
| **10B.4** | UI CRM completa + emails ao cliente | 10B.1–10B.3 |
| **10B.5** | Certificação AT: hash integridade, checklist, guards produção, doc processo | 10B.2 estável |
| **10B.6** | Fase 2: sandbox AT, comunicação automática, NC, retenções, teste ligação | 10B.3 |

> **Nota legal:** até existir **número de certificação AT**, use `AT_FATURAS_MODE=sandbox` em dev ou `disabled` em produção.

---

## Variáveis de ambiente (API)

```env
AT_FATURAS_WSDL_URL=...
AT_FATURAS_ENDPOINT=https://servicos.portaldasfinancas.gov.pt:400/fews/faturas
AT_FATURAS_MODE=production|sandbox|disabled
AT_SOFTWARE_CERT_NUMBER=   # após certificação
```

Credenciais por tenant: `atSubutilizador` + password encriptada. Guia completo: [CREDENCIAIS_AT.md](./CREDENCIAIS_AT.md).

---

## Critérios de aceitação

- [x] Comercial converte proposta aceite em fatura rascunho em 2 cliques
- [x] Gestor configura série e vê estado da integração AT (incl. modo sandbox)
- [x] Fatura emitida gera documento com ATCUD + QR legível
- [x] Comunicação AT regista sucesso/erro com mensagem compreensível (sandbox + produção)
- [x] Fatura emitida é imutável; anulação só por gestor com motivo
- [x] CRM dashboard reflecte receita faturada vs propostas aceites
- [x] Testes unitários: cálculo IVA, numeração, parser respostas AT, sandbox, retenções

---

## Referências

- [Portal Finanças – Especificação webservice 2022+](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Negocios/Faturacao/Regras_mecanismos_comunicacao/e_Fatura/e_Fatura_Comunicacao_elementos_docs_faturacao_2022_seguintes/Paginas/default.aspx)
- [FAQs webservice faturas AT](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/pages/faqs-00996.aspx)
- [Programa faturação certificação (gov.pt)](https://www.gov.pt/servicos/programa-de-faturacao-certificacao)
- `FASE_10_EM_PROGRESSO.md` – CRM base
- `apps/api/src/propostas/` – propostas comerciais existentes
