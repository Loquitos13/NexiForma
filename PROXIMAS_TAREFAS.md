# ✅ PRÓXIMAS TAREFAS – NexiForma

> Actualizado: formação pronta para go-live (SIGO disabled até contrato DGEEC; sumários com assinatura interna ou PDF).

## ✅ Concluído recentemente

- [x] Portal formando – menu, catálogo, inscrições, perfil
- [x] Documentos CC/BI/carta com câmara
- [x] RGPD – consentimento + download dados pessoais (JSON/CSV/TXT)
- [x] CRM API + UI + faturação AT (Fase 10B)
- [x] Quiz engine API + player formando
- [x] SIGO adapter http/soap/disabled + UI `/portal/sigo`
- [x] PWA – manifest + service worker no layout formando
- [x] Formação go-live: validação UFCD em cursos, metadados SIGO nos formandos, docs produção

---

## 🔜 Implementar mais tarde (prioridade)

### Fase 12 – SIGO API oficial

> Especificação: [docs/FASE_12_SIGO_API.md](./docs/FASE_12_SIGO_API.md)

- [x] **12.0–12.4** – Export, adapter, reconciliação, UI
- [ ] **12.5** – Contrato API oficial DGEEC (aguarda publicação WSDL/paths)

**Go-live:** `SIGO_API_MODE=disabled` + export manual. Ver [DEPLOY_PRODUCAO.md](./docs/DEPLOY_PRODUCAO.md) §6.2.

### Produção

> Guia: [docs/DEPLOY_PRODUCAO.md](./docs/DEPLOY_PRODUCAO.md)

- [x] Checklist formação / inspeção DGERT (runbook 6.2)
- [x] Defaults recomendados: `SIGO_API_MODE=disabled`
- [x] Sumários: assinatura interna + upload PDF assinado (CMD removida)
- [x] Contador de sessão formador/formando (assiduidade ao abrir a sessão)
- [x] Progresso LMS por formando + notificação in-app ao concluir percurso
- [ ] Executar runbook E2E num tenant piloto em staging/produção

---

## 🎯 Melhorias curtas (opcional)

| Área | Tarefa |
|------|--------|
| PWA | Cache offline SCORM; ícones PNG 192/512 |
| LMS | Editor quiz avançado / randomização |
| Catálogo UFCD | Import massivo CNQ oficial (além do seed) |

---

## 📚 Referência

- [README.md](./README.md) – arranque e endpoints
- [product-roadmap-pt.md](./docs/product-roadmap-pt.md) – visão mercado PT
- [FASE_12_SIGO_API.md](./docs/FASE_12_SIGO_API.md) – SIGO
- [CERTIFICACAO_SOFTWARE_AT.md](./docs/CERTIFICACAO_SOFTWARE_AT.md) – faturação AT
