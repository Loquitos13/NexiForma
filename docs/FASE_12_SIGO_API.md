# Fase 12 – SIGO API oficial + reconciliação

> **Objectivo:** preparar e operacionalizar a submissão de acções de formação à plataforma **SIGO (DGEEC)**, com trilho de auditoria, reconciliação de estados e tratamento de erros parciais.
>
> **Utilizadores:** `tenant_manager` (submissão, reconciliação, reenvio).

---

## Estado actual

| Sub-fase | Conteúdo | Estado |
|----------|----------|--------|
| **12.0** | Export manual JSON/CSV + validação UFCD/NIF | ✅ |
| **12.1** | Adapter `http` / `disabled` + persistência `SigoSubmissao` | ✅ |
| **12.2** | Cliente HTTP robusto (timeout, retry, parser) | ✅ |
| **12.3** | Reconciliação `http` (consulta estado remoto) | ✅ |
| **12.4** | UI `/portal/sigo` + dossie «Submeter SIGO API» | ✅ |
| **12.5** | API oficial DGEEC (contrato definitivo) | ⏳ aguarda DGEEC |

> Enquanto a API oficial não estiver publicada, configure `SIGO_API_MODE=disabled` e use export JSON/CSV manual. Quando a DGEEC publicar o contrato, active `http` com `SIGO_API_BASE_URL` e credenciais piloto/produção.

---

## Fluxo

```
Dossiê pedagógico → Validação SIGO → Submeter API → Estado SUBMETIDA → Reconciliar → ACEITE → Sync certificados SIGO
                                      ↓ (erro)
                                    ERRO → Reenviar
```

---

## API NestJS (`/v1/sigo`)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/sigo/config` | Modo servidor (`http` / `disabled`) |
| GET | `/sigo/submissoes` | Listar submissões (filtro `?acaoId=`) |
| GET | `/sigo/acoes-formacao/:acaoId/submissoes` | Histórico por acção |
| POST | `/sigo/acoes-formacao/:acaoId/submit` | Validar + submeter pacote JSON |
| POST | `/sigo/submissoes/:id/reconciliar` | Consultar estado remoto (modo `http`) |
| POST | `/sigo/submissoes/:id/reenviar` | Nova submissão a partir da acção |
| GET | `/sigo/acoes-formacao/:acaoId/certificados` | Certificados SIGO sincronizados por acção |
| GET | `/sigo/submissoes/:id/certificados` | Certificados de uma submissão |
| POST | `/sigo/submissoes/:id/certificados/sincronizar` | Obter certificados oficiais da SIGO |
| GET | `/sigo/certificados/:id/download` | Download PDF certificado SIGO |

---

## Variáveis de ambiente

```env
SIGO_API_MODE=disabled            # http | disabled
SIGO_API_BASE_URL=https://...     # base URL API DGEEC (modo http)
SIGO_API_KEY=                     # Bearer token ou API key
SIGO_API_TIMEOUT_MS=30000
SIGO_API_STATUS_PATH=/acoes/{referenceId}
SIGO_API_SUBMIT_PATH=/acoes
SIGO_API_CERTIFICADOS_PATH=/acoes/{referenceId}/certificados
SIGO_API_CERTIFICADO_DOWNLOAD_PATH=/certificados/{certificadoId}/download
SIGO_API_MAX_RETRIES=2
```

---

## Credenciais SIGO (quando API DGEEC disponível)

| Credencial | Onde obter | Configuração |
|------------|------------|--------------|
| **URL base API** | Documentação DGEEC / convite piloto | `SIGO_API_BASE_URL` |
| **API key / token** | Portal entidade formadora certificada | `SIGO_API_KEY` |
| **Certificado cliente** (se exigido) | Processo de adesão DGEEC | Futuro: variáveis mTLS (Fase 12.5) |

### Ordem recomendada

1. Export JSON/CSV manual enquanto `SIGO_API_MODE=disabled`
2. Quando DGEEC disponibilizar endpoint: `SIGO_API_MODE=http` + credenciais
3. Validar acção no dossiê (`validacao-sigo` sem erros bloqueantes)
4. Submeter → reconciliar até `ACEITE`
5. Em caso de `REJEITADA` ou `ERRO`: corrigir dados + **Reenviar**

---

## Modelo de dados

```prisma
enum SigoSubmissaoEstado {
  PENDENTE
  SUBMETIDA
  ACEITE
  REJEITADA
  ERRO
}

model SigoSubmissao {
  referenceId    String   // ID remoto ou interno
  payloadHash    String?  // SHA-256 do pacote (auditoria)
  erros          Json?    // erros parciais / resposta remota
  submittedAt    DateTime?
  reconciledAt   DateTime?
}
```

---

## Critérios de aceitação

- [x] Submissão bloqueada se validação SIGO falhar
- [x] Histórico persistido por tenant e acção
- [x] Reconciliação http consulta endpoint configurável
- [x] Reenvio cria nova submissão
- [x] UI lista erros parciais
- [ ] Contrato API oficial DGEEC mapeado (12.5)

---

## Referências

- Export manual: `GET /dossie-pedagogico/acoes-formacao/:id/export/sigo`
- Validação: `GET .../validacao-sigo`
- UI: `/portal/sigo`, `/portal/dossie`
- Deploy: [docs/DEPLOY_PRODUCAO.md](./DEPLOY_PRODUCAO.md)
- Código: `apps/api/src/sigo/`
