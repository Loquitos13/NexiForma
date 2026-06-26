# NexiForma – Roadmap para liderar a gestão de formação em Portugal

Este documento descreve o que **já existe**, o que **falta** para ser referência no mercado português (DGERT / entidades certificadas / SIGO), e a ordem sugerida de execução.

## O que já tens (Fases 1–7)

| Área | Estado |
|------|--------|
| Multi-tenant SaaS + Control Plane | ✅ |
| Dossiê pedagógico + checklist DGERT (19 critérios) | ✅ |
| Export SIGO (JSON/CSV) + validação NIF/UFCD | ✅ |
| SIGO API adapter (http/disabled) | ✅ parcial |
| LMS + SCORM upload + assiduidade Zoom/Teams | ✅ |
| Dossiê arquivado (S3/local) | ✅ |
| MFA, convites, billing Stripe | ✅ |
| UI produção (landing, auth, portal) | ✅ |
| Certificados HTML/PDF + alertas compliance | ✅ Fase 7 |

## O que falta para ser a melhor app de Portugal

### 1. Conformidade e inspeção DGERT (diferenciador #1)

Entidades certificadas vivem de **passar inspeções sem stress**. Falta:

- **Assinatura qualificada** (CMD / Chave Móvel) - **depende serviço pago AMA**; em pausa
- **Pacote único de inspeção** – ZIP automático: dossiê + presenças + sumários + cronograma aprovado + evidências LMS
- **Simulador de inspeção** – score preditivo com histórico de entidades similares
- **Catálogo UFCD oficial** – validação contra referencial DGEEC actualizado
- **Plano anual de formação** – planeamento multi-acção com alertas de capacidade

### 2. Integração SIGO / DGEEC (diferenciador #2)

- API **oficial** quando disponível (hoje: export manual + adapter `http` configurável)
- **Reconciliação** – estado da submissão, erros DGEEC, reenvio parcial
- **Sincronização de formandos** – evitar duplicados e NIF inválidos antes de submeter

### 3. Experiência do formando (diferenciador #3)

- **App mobile** (PWA ou nativa) – calendário, presenças, SCORM offline - **PWA base ✅** (manifest + SW); calendário dedicado ⏳
- **Portal formando** – catálogo, inscrições, perfil, documentos CC/BI/carta ✅
- **RGPD** – consentimento utilizador ✅
- **Notificações** – SMS/email/WhatsApp para sessões, convites, certificado disponível
- **Certificado verificável** – QR code + página pública de validação
- **Acessibilidade** – WCAG 2.1 AA no portal formando

### 4. Operacional da entidade formadora

- **CRM entidades cliente** – UI + API ✅ (`/portal/crm`, entidades, propostas)
- **Propostas comerciais** – orçamentos, envio email, aceitar/rejeitar ✅
- **Faturação AT no CRM** – emissão legal + webservice e-fatura ⏳ **Fase 10B** ([spec](./FASE_10B_FATURACAO_AT_CRM.md))
- **Gestão de formadores** – validade CCP/CC, alertas de renovação
- **Salas e recursos** – ocupação, conflitos de horário
- **Receitas por acção** – ligadas a faturas CRM (após Fase 10B)

### 5. LMS de verdade

- **Editor de quizzes** – banco de perguntas, randomização, nota mínima
- **Vídeo com progresso** – Vimeo/YouTube/Mux + anti-fraude
- **Trilhas de aprendizagem** – pré-requisitos entre módulos
- **Gamificação leve** – badges, progresso visual

### 6. Assiduidade e modalidades híbridas

- **OAuth Zoom/Teams** – criar reuniões a partir do cronograma (não só webhooks)
- **Geolocalização opcional** – check-in presencial com QR na sala
- **Biometria / reconhecimento** – parceiro externo (fase longa)

### 7. Confiança, escala e enterprise

- **SOC2 / ISO 27001** – documentação, retenção, DPA
- **RGPD** – export de dados, direito ao esquecimento, consentimentos
- **SLA 99,9%** – multi-AZ AWS, backups, disaster recovery
- **SSO enterprise** – Cognito/SAML/Azure AD (Cognito parcial)
- **API pública** – webhooks para parceiros (ERP, contabilidade)

### 8. Inteligência e produto

- **Dashboard executivo** – receita, ocupação, taxa de conclusão, NPS formandos
- **Copilot DGERT** – “o que falta para inspecção?” em linguagem natural
- **Benchmark sectorial** – anonimizado entre tenants NexiForma

---

## Prioridade recomendada (próximas fases)

| Fase | Foco | Impacto mercado PT |
|------|------|-------------------|
| **8** | Notificações (email/SMS) + pacote inspeção ZIP | Alto – reduz trabalho manual |
| **9** | Certificado QR verificável (+ assinatura CMD se cliente pagar AMA) | Alto – confiança legal |
| **10** | CRM entidades + propostas + formadores CCP | Médio – vendas B2B (**parcial ✅**) |
| **10B** | **Faturação AT no CRM** (emitir + comunicar webservice) | Alto – ciclo comercial completo |
| **11** | PWA formando + quiz engine | Médio – retenção formandos (**parcial: PWA SW + quiz ✅**) |
| **12** | SIGO API oficial + reconciliação | Alto quando DGEEC abrir API |
| **13** | SSO SAML + API pública + contabilidade | Enterprise |

---

## Posicionamento sugerido

> **NexiForma** – a única plataforma que une **dossiê DGERT pronto para inspeção**, **SIGO**, **LMS** e **operacional SaaS** num fluxo guiado, em português, para entidades certificadas.

O MVP actual já cobre **60–70%** do core DGERT. Os 30% restantes são sobretudo **integrações oficiais**, **mobile**, **assinatura qualificada** e **operacional comercial** – o que separa “bom software” de **líder de mercado**.
