# 💼 Fase 10: CRM Entidades + Propostas – EM PROGRESSO

## ✅ Implementado

### 1️⃣ **CRM Service** (`crm.service.ts`)

**Funcionalidades**:
- ✅ Criar entidade cliente (com validação NIF)
- ✅ Listar entidades com paginação + filtros
- ✅ Obter detalhes (propostas, formandos)
- ✅ Atualizar entidade
- ✅ Eliminar entidade
- ✅ Estatísticas: total formandos, faturação, taxa aceição

**Endpoints previstos**:
```bash
POST   /crm/entidades                    # Criar
GET    /crm/entidades                    # Listar
GET    /crm/entidades/{id}               # Detalhes
PUT    /crm/entidades/{id}               # Atualizar
DELETE /crm/entidades/{id}               # Eliminar
GET    /crm/estatisticas                 # Stats
```

### 2️⃣ **Proposal Service** (`proposal.service.ts`)

**Estados de proposta**:
```
RASCUNHO → ENVIADA → ACEITE
              ↓
            REJEITADA
              ↓
           CANCELADA
```

**Funcionalidades**:
- ✅ Criar proposta (com auto-código ou manual)
- ✅ Listar propostas por entidade
- ✅ Obter detalhes
- ✅ Editar (apenas RASCUNHO)
- ✅ Enviar por email
- ✅ Aceitar/Rejeitar
- ✅ Ciclo de vida completo

**Endpoints previstos**:
```bash
POST   /crm/entidades/{id}/propostas              # Criar
GET    /crm/entidades/{id}/propostas              # Listar
GET    /crm/propostas/{id}                        # Detalhes
PUT    /crm/propostas/{id}                        # Atualizar
POST   /crm/propostas/{id}/enviar                 # Enviar email
POST   /crm/propostas/{id}/aceitar                # Aceitar
POST   /crm/propostas/{id}/rejeitar               # Rejeitar
DELETE /crm/propostas/{id}                        # Eliminar
GET    /crm/propostas/{id}/pdf                    # Gerar PDF
```

**Exemplo Proposta**:
```json
{
  "id": "prop-123",
  "codigo": "PROP-20260603-ABC1",
  "titulo": "Formação Python – 25h",
  "descricao": "Curso introdutório de programação em Python",
  "valor": "€500,00",
  "estado": "ENVIADA",
  "validadeAte": "2026-07-03",
  "entidadeCliente": {
    "nome": "Tech Solutions SA",
    "email": "contatos@techsolutions.pt"
  },
  "curso": {
    "codigoUfcd": "10863",
    "designacao": "Formação em Python"
  },
  "criadoEm": "2026-06-03T10:00:00Z",
  "atualizadoEm": "2026-06-03T14:30:00Z"
}
```

### 3️⃣ **Trainer Management Service** (`trainer-management.service.ts`)

**Status de Formador**:
- ✅ **OK** – Todas as qualificações válidas
- ⚠️ **ALERTA** – Expires em <30 dias
- ❌ **EXPIRADO** – Qualificações vencidas

**Qualificações**:
- CC (Cartão de Cidadão) – Identidade
- CCP (Cartão de Crédito Profissional) – Habilitações

**Funcionalidades**:
- ✅ Criar formador
- ✅ Listar formadores (com status)
- ✅ Atualizar qualificações
- ✅ Verificar renovações (cron job)
- ✅ Alertas de expiração

**Endpoints previstos**:
```bash
POST   /crm/formadores                   # Criar
GET    /crm/formadores                   # Listar (com filtro status)
GET    /crm/formadores/{id}              # Detalhes
PUT    /crm/formadores/{id}/qualificacoes  # Atualizar qualif.
GET    /crm/formadores/renovacoes        # Alertas de renovação
```

**Exemplo Formador**:
```json
{
  "id": "form-456",
  "nomeCompleto": "João Silva",
  "nif": "1234567890",
  "email": "joao@formadores.pt",
  "cc": {
    "numero": "0000000AA",
    "validade": "2027-03-15",
    "valido": true,
    "diasAteExpiracao": 287
  },
  "ccp": {
    "numero": "CCP-2024-001",
    "validade": "2026-11-30",
    "valido": true,
    "diasAteExpiracao": 182
  },
  "statusGeral": "OK"
}
```

---

## 📊 Schema Prisma (Já Presente)

```prisma
model EntidadeCliente {
  id            String
  tenantId      String
  nif           String          @unique per tenant
  nome          String
  email         String?
  telefone      String?
  
  formandos     FormandoProfile[]
  propostas     PropostaComercial[]
  documentos    DocumentoAnexo[]
}

model PropostaComercial {
  id                String
  tenantId          String
  entidadeClienteId String
  codigo            String          @unique per tenant
  titulo            String
  descricao         String?
  valorCentavos     Int
  moeda             String          // EUR
  estado            PropostaEstado  // RASCUNHO|ENVIADA|ACEITE|REJEITADA|CANCELADA
  validadeAte       DateTime?
  cursoId           String?
  notasInternas     String?
}

model FormadorProfile {
  id            String
  tenantId      String
  userId        String          @unique
  nomeCompleto  String
  nif           String          @unique per tenant
  email         String
  ccNumero      String?
  ccValidade    DateTime?       // CC expira
  ccpNumero     String?
  ccpValidade   DateTime?       // CCP expira
}
```

---

## 🔧 Faltam

### Endpoints REST (CRM Controller)
```typescript
// controller/crm.controller.ts
@Controller('crm')
export class CrmController {
  // Entidades
  @Post('entidades')
  @Get('entidades')
  @Get('entidades/:id')
  @Put('entidades/:id')
  @Delete('entidades/:id')
  @Get('estatisticas')
  
  // Propostas
  @Post('entidades/:entidadeId/propostas')
  @Get('crm/propostas/:id')
  @Put('crm/propostas/:id')
  @Post('crm/propostas/:id/enviar')
  @Post('crm/propostas/:id/aceitar')
  @Post('crm/propostas/:id/rejeitar')
  
  // Formadores
  @Post('formadores')
  @Get('formadores')
  @Get('formadores/:id')
  @Put('formadores/:id/qualificacoes')
  @Get('formadores/renovacoes')
}
```

### UI Componentes (Next.js/Web)
- Form Criar/Editar Entidade
- Tabela Entidades com filtros
- Detalhe Entidade (propostas + formandos)
- Form Criar Proposta
- Tabela Propostas (com status visual)
- Detalhe Formador (CC/CCP com validação visual)
- Dashboard CRM (KPIs)

### Integrações
- [ ] Export para contabilidade
- [ ] E-fatura (quando pronto)
- [ ] CRM externo (Pipedrive, HubSpot)

---

## 🎯 KPIs Esperados Fase 10

- Entidades cadastradas: _/mês (meta: 50+)
- Taxa conversão proposta: _% (meta: 60%)
- Tempo proposta → aceitar: _dias (meta: 7)
- Formadores com qualific. válida: _% (meta: 100%)
- Alertas renovação verificados: _% (meta: 100%)

---

## 📝 Próximos Passos

### Fase 11: PWA Formando + Quiz Engine
- [ ] Manifest.json + service worker
- [ ] Calendar formando
- [ ] Quiz engine (banco de perguntas)
- [ ] Progresso visual

### Fase 12: SIGO API + Reconciliação
- [ ] Cliente API oficial SIGO
- [ ] Sincronização estado submissão
- [ ] Reconciliação de erros
- [ ] Resubmissão parcial

---

**Status**: 🔄 EM PROGRESSO
**Próximo**: Criar CRM Controller + UI
**Estimativa**: +1-2 dias (controllers + UI básica)

---

## 📌 Notas de Implementação

### Validação NIF
- 9 dígitos português
- Fórmula checksum integrada ✓

### Estados Proposta
- RASCUNHO: editável, não enviada
- ENVIADA: enviada por email, aguardando resposta
- ACEITE: aceite pelo cliente
- REJEITADA: recusada
- CANCELADA: cancelada internamente

### Qualificações Formador
- CC: Obrigatório em Portugal
- CCP: Necessário para alguns cursos
- Ambas com datas de validade
- Alerts automáticos 30 dias antes

### Email Propostas
- Template auto-gerado
- Link direto para página proposta
- Incluir código único
- Validade visível

### Estatísticas CRM
- Total entidades
- Entidades ativas (com formandos)
- Faturação total
- Taxa aceição propostas
- Formandos por entidade

---

## 🔜 Fase 10B – Faturação AT (planeada)

Integração no CRM para **gestor** (`tenant_manager`) e **comercial** (`comercial`).

**Fluxo:** Proposta `ACEITE` → Fatura rascunho → Emitir (ATCUD + QR) → Comunicar webservice AT → PDF/email ao cliente.

| Sub-fase | Entregável |
|----------|------------|
| 10B.1 | Prisma: `FaturaComercial`, linhas, séries; `POST /propostas/:id/faturar` |
| 10B.2 | Emissão: numeração imutável, ATCUD, documento HTML/PDF |
| 10B.3 | Cliente SOAP AT + `FaturaComunicacaoAt` (auditoria) |
| 10B.4 | UI `/portal/crm/faturas` + botão «Faturar» em propostas |
| 10B.5 | Certificação software AT (processo gratuito) |

**Especificação:** [docs/FASE_10B_FATURACAO_AT_CRM.md](./docs/FASE_10B_FATURACAO_AT_CRM.md)

**Endpoints previstos (resumo):**
```bash
GET    /crm/faturas
POST   /crm/propostas/:id/faturar
POST   /crm/faturas/:id/emitir
POST   /crm/faturas/:id/comunicar-at
POST   /crm/faturas/:id/anular          # só gestor
GET    /crm/faturas/:id/documento.html
PATCH  /crm/config/faturacao            # só gestor
```
