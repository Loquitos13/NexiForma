# Documentação de testes - Faturação NexiForma

## Âmbito

Cobertura de testes automatizados dos serviços e utilitários de **faturação AT** (`apps/api/src/faturas/`) e **subscrição/billing** (`apps/api/src/billing/`).

## Como executar

```bash
# Todos os testes da API
npm test --workspace=apps/api

# Só faturação (utilitários + aceitação)
npm test --workspace=apps/api -- --testPathPattern=faturas

# Só billing
npm test --workspace=apps/api -- --testPathPattern=billing
```

## Ficheiros de teste - Faturação AT

| Ficheiro | O que valida |
|----------|----------------|
| `faturas-acceptance.spec.ts` | Critérios de aceitação Fase 10B: ATCUD, SOAP AT, IVA, certificação sandbox |
| `fatura-iva.util.spec.ts` | Cálculo de totais, IVA e retenções |
| `fatura-atcud.util.spec.ts` | Formatação ATCUD para QR/documento |
| `at-faturas.util.spec.ts` | Parsing de respostas SOAP AT |
| `at-faturas-integration.spec.ts` | Fluxo integração AT (mock) |
| `fatura-search.util.spec.ts` | Pesquisa e filtros de faturas |
| `faturacao-moradas.util.spec.ts` | Normalização de moradas fiscais |
| `fatura-template-cores.util.spec.ts` | Template visual de documentos |
| `fatura-assinatura-at.util.spec.ts` | Assinatura/certificação AT |

## Ficheiros de teste - Billing / subscrição

| Ficheiro | O que valida |
|----------|----------------|
| `billing-entitlements.util.spec.ts` | Entitlements por plano, módulos avulsos, gating portal/API |
| `billing.service.spec.ts` | Listagem de planos, checkout com plano inválido |

## Cenários de aceitação (Faturação AT)

### CA-2 - Estado integração AT
- Gestor vê estado de certificação em sandbox (`avaliarCertificacaoAt`).

### CA-3 - ATCUD
- Emissão gera ATCUD no formato `{serie}-{numero}`.

### CA-4 - Comunicação AT
- Sucesso e erro SOAP produzem mensagens legíveis para o utilizador.

### CA-7 - IVA e retenções
- Totais líquidos = base + IVA − retenção.

## Cenários - Entitlements

- Plano **modular** + addon `faturacao_at` activa faturação sem CRM.
- Plano **enterprise** inclui CRM, faturação e features enterprise.
- Subscrição **cancelada** bloqueia módulos excepto `/portal/billing`.

## Regressão manual recomendada (UI)

1. `/portal/crm/faturacao` - banner «Em desenvolvimento… Brevemente» visível.
2. `/portal/crm/faturas` - emissão e export SAF-T (ambiente de teste).
3. `/portal/billing` - planos e checkout Stripe (chave configurada).

## Manutenção

Ao alterar utilitários em `faturas/*.util.ts`, actualizar ou adicionar testes no ficheiro `*.spec.ts` correspondente antes de merge.
