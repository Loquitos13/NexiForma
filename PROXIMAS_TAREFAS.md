# ✅ PRÓXIMAS TAREFAS – NexiForma

> Actualizado após portal formando, RGPD, CRM e PWA base.

## ✅ Concluído recentemente

- [x] Portal formando – menu, catálogo, inscrições, perfil
- [x] Documentos CC/BI/carta com câmara
- [x] RGPD – consentimento utilizador, registo gestor (somente leitura)
- [x] Documentos identificação – CC/BI/carta com câmara (upload no perfil formando)
- [x] CRM API + UI dashboard (`/portal/crm`, entidades, propostas, formadores)
- [x] Quiz engine API + player formando
- [x] SIGO reconciliação HTTP (`/portal/sigo`)
- [x] PWA – manifest + service worker registado no layout formando
- [x] `npm run db:migrate:deploy` na raiz

---

## 🔜 Implementar mais tarde (prioridade)

### Fase 10B – CRM Faturação AT (gestor + comercial)

> Especificação completa: [docs/FASE_10B_FATURACAO_AT_CRM.md](./docs/FASE_10B_FATURACAO_AT_CRM.md)

- [x] **10B.1** – Modelo `FaturaComercial`, séries, linhas IVA; criar fatura a partir de proposta **ACEITE**
- [x] **10B.2** – Emissão legal: numeração, ATCUD, QR Code, PDF/HTML
- [x] **10B.3** – Webservice AT (SOAP): comunicação em tempo real + auditoria de respostas
- [x] **10B.4** – UI CRM: editor template fatura, dados legais emitente/destinatário, config tenant
- [x] **10B.5** – Certificação software AT + integração webservice produção (WS-Security, mTLS)

**Roles:** `tenant_manager`, `comercial`  
**Nota:** API AT é gratuita; emissão exige software certificável + subutilizador WFA.  
**Credenciais:** [docs/CREDENCIAIS_AT.md](./docs/CREDENCIAIS_AT.md)

### Fase 12 – SIGO API oficial

> Especificação: [docs/FASE_12_SIGO_API.md](./docs/FASE_12_SIGO_API.md)

- [x] **12.0** – Export manual JSON/CSV + validação UFCD/NIF
- [x] **12.1** – Adapter http/disabled + `SigoSubmissao`
- [x] **12.2** – Cliente HTTP com retry + parser respostas
- [x] **12.3** – Reconciliação http (consulta estado remoto configurável)
- [x] **12.4** – UI `/portal/sigo` (erros, reenviar, reconciliação)
- [x] **12.5** – Contrato API oficial DGEEC (aguarda publicação)

### Produção

> Guia completo: [docs/DEPLOY_PRODUCAO.md](./docs/DEPLOY_PRODUCAO.md) - sem modos mock/sandbox; integrações reais ou `disabled`.

### Fase 13 – Enterprise

> Especificação: [docs/FASE_13_ENTERPRISE.md](./docs/FASE_13_ENTERPRISE.md)

- [x] **13.1** – OpenAPI spec (`/v1/docs/openapi.json`)
- [x] **13.2** – API pública expandida (faturas, matrículas)
- [x] **13.3** – Chaves API self-service (`/portal/enterprise`)
- [x] **13.4** – SSO OIDC por tenant (Azure AD / PKCE)
- [x] **13.5** – Export SAF-T PT (faturas comerciais)
- [x] **13.6** – RGPD export automático formando
- [x] **13.7** – KPIs faturação CRM

---

## 🎯 Melhorias curtas (opcional)

| Área | Tarefa |
|------|--------|
| Formando | Calendário de sessões dedicado (`/portal/formando/calendario`) |
| PWA | Cache offline SCORM leitura; push notifications |
| RGPD | Export JSON automático por pedido |
| PWA | Ícones PNG 192/512; botão «Instalar app» no portal formando |
| CRM | PDF/HTML proposta comercial ✅; **faturação AT (Fase 10B)** ✅ |

---

## 📚 Referência

- [README.md](./README.md) – arranque e endpoints
- [product-roadmap-pt.md](./docs/product-roadmap-pt.md) – visão mercado PT
- [FASE_10_EM_PROGRESSO.md](./FASE_10_EM_PROGRESSO.md) – detalhe CRM
- [ROADMAP_VISUAL_8-12.md](./docs/ROADMAP_VISUAL_8-12.md) – timeline visual

**Estimativa próximo sprint:** Fase 12.5 (contrato DGEEC quando disponível) ou Fase 13 Enterprise / melhorias curtas.
