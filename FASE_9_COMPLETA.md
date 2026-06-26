# 🔐 Fase 9: QR Verificável + CMD Assinatura – IMPLEMENTADO

## ✅ Completado

### 1️⃣ **Verification Service** (`verificacao.service.ts`)

**Funcionalidades**:
- ✅ Geração dinâmica de QR codes
- ✅ Página pública de verificação (sem autenticação)
- ✅ Código público único: `CERT-20260603-A1B2C3D4`
- ✅ Hash de integridade (SHA-256)
- ✅ Revogação de certificados
- ✅ Timestamp de validação

**QR Code**:
```
Aponta para: https://nexiforma.pt/verificar/{codigoPublico}
Contém: Link público verificável por qualquer pessoa
Uso: Impresso em PDF/papel
```

### 2️⃣ **CMD Signature Service** (`cmd-signature.service.ts`)

**Integração Chave Móvel Digital**:
- ✅ Iniciar processo de assinatura
- ✅ Geração de código PIN (6 dígitos)
- ✅ Validação de certificado digital
- ✅ Mock para desenvolvimento (sem CMD configurado)
- ✅ Status em tempo real

**Fluxo de Assinatura**:
```
1. Utilizador clica "Assinar com CMD" no sumário
2. Sistema gera sessionId + codigoPin (ex: 123456)
3. Utilizador abre app Chave Móvel Digital
4. Introduz código PIN
5. Completa autenticação biométrica
6. CMD API confirma assinatura (callback webhook)
7. Sumário marcado como IMUTÁVEL
8. Metadados armazenados: certificado serial, issuer, validadoAte
```

### 3️⃣ **Public Verification Endpoints**

```bash
# GET /verificar/{codigoPublico}
# Retorna informações públicas do certificado (sem autenticação)

Exemplo:
GET /verificar/CERT-20260603-A1B2C3D4
↓
{
  "sucesso": true,
  "dados": {
    "codigoPublico": "CERT-20260603-A1B2C3D4",
    "emitidoEm": "2026-06-03T10:30:00Z",
    "revogadoEm": null,
    "formando": {
      "nome": "João Silva",
      "nif": "1234567890"
    },
    "curso": {
      "designacao": "Formação em Python",
      "codigoUfcd": "10863",
      "cargaHoras": 25
    },
    "acao": {
      "codigoInterno": "ACAO001",
      "dataInicio": "2026-04-01",
      "dataFim": "2026-05-31"
    },
    "entidade": {
      "legalName": "Centro Formação ABC",
      "nif": "500123456"
    }
  },
  "hash": "a1b2c3d4...",
  "validadoEm": "2026-06-03T14:25:30Z"
}
```

### 4️⃣ **Management Endpoints (Autenticados)**

```bash
# POST /certificados/{matriculaId}/qrcode
# Gera QR code para um certificado
↓ Base64 PNG (Data URL)

# POST /certificados/{matriculaId}/revogar
# Revogar certificado (admin)
{
  "motivo": "Irregularidade detetada"
}

# POST /sumarios/{sumarioId}/assinar
# Iniciar assinatura CMD
{
  "nomeUtilizador": "João Silva",
  "email": "joao@example.com"
}
↓
{
  "sucesso": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "estado": "PENDENTE_AUTENTICACAO",
  "codigoPin": "123456",
  "instrucoes": "Abra a app Chave Móvel Digital..."
}

# GET /sumarios/{sumarioId}/assinatura-status/{sessionId}
# Verificar status em tempo real
↓
{
  "sucesso": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "estado": "ASSINADO",
  "assinadoEm": "2026-06-03T10:35:00Z"
}
```

### 5️⃣ **Webhook Callback**

```bash
# POST /sumarios/assinatura/callback
# Chamado por CMD API após conclusão

Request (de CMD):
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "estado": "SUCESSO",
  "certificado": {
    "serial": "0123456789ABCDEF",
    "issuer": "AMA - Autoridade da Manutenção do Ambiente",
    "validadoAte": "2027-06-03"
  }
}

Response:
{
  "sucesso": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 📊 Schema Updates (Prisma)

Campos já presentes (Fase 7):
```prisma
model Sumario {
  assinaturaRef      String?     // Ex: "CERT-20260603-A1B2C3D4"
  assinaturaTipo     String?     // "interna" | "CMD_QUALIFICADA"
  assinaturaMetadata Json?       // { sessionId, certificado, ... }
  assinadoEm         DateTime?   // timestamp da assinatura
  imutavel           Boolean     // true = assinado e bloqueado
}

model CertificadoVerificacao {
  codigoPublico      String @unique  // "CERT-20260603-A1B2C3D4"
  tokenHash          String @unique  // SHA-256 hash (security)
  hashConteudo       String          // SHA-256 do conteúdo
  emitidoEm          DateTime
  revogadoEm         DateTime?       // null = válido
}
```

---

## 🔧 Configuração (.env)

```env
# CMD (Chave Móvel Digital)
CMD_ENABLED=true|false
CMD_API_URL=https://cmd.cc.pt/assinador/api
CMD_API_KEY=seu-api-key-aqui

# Se CMD desabilitado, usa mock (dev-friendly)
```

---

## 🎯 Fluxo HTML de Certificado (com QR)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Certificado | Curso XYZ</title>
</head>
<body>
  <h1>CERTIFICADO DE FORMAÇÃO</h1>
  
  <p>Certifica-se que <strong>João Silva</strong> (NIF: 1234567890)</p>
  <p>completou com sucesso a formação em <strong>Python Avançado</strong></p>
  <p>Carga horária: 25 horas | Código UFCD: 10863</p>
  
  <!-- QR Code gerado pela API -->
  <div class="qr-container">
    <img src="data:image/png;base64,iVBORw0KGgo..." width="150" height="150" />
    <p>Escanear para verificar autenticidade</p>
  </div>
  
  <!-- Assinatura -->
  <div class="signature-box">
    <p>Assinado digitalmente com Chave Móvel Digital</p>
    <p>Certificado: 0123456789ABCDEF</p>
    <p>Data: 03 de Junho de 2026</p>
  </div>
  
  <!-- Link verificação -->
  <hr>
  <p style="font-size: 10px; color: #666;">
    Verificar em: https://nexiforma.pt/verificar/CERT-20260603-A1B2C3D4
  </p>
</body>
</html>
```

---

## 🚀 Teste Fase 9

```bash
# 1. Gerar QR code
curl -X POST http://localhost:3000/certificados/matriculaId/qrcode \
  -H "Authorization: Bearer $TOKEN"

# 2. Verificar certificado (público)
curl -X GET http://localhost:3000/verificar/CERT-20260603-A1B2C3D4

# 3. Iniciar assinatura CMD (mock)
curl -X POST http://localhost:3000/sumarios/sumarioId/assinar \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nomeUtilizador":"João","email":"joao@example.com"}'

# 4. Verificar status
curl -X GET http://localhost:3000/sumarios/sumarioId/assinatura-status/sessionId \
  -H "Authorization: Bearer $TOKEN"

# 5. Simular callback CMD (webhook)
curl -X POST http://localhost:3000/sumarios/assinatura/callback \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId":"550e8400-e29b-41d4-a716-446655440000",
    "estado":"SUCESSO",
    "certificado":{
      "serial":"0123456789ABCDEF",
      "issuer":"AMA",
      "validadoAte":"2027-06-03"
    }
  }'
```

---

## 📦 Dependências (Já Presentes)

- ✅ `qrcode` – Geração de QR
- ✅ AWS SDK – Para armazenamento de metadados
- ✅ Redis (para produção) – Cache de sessions CMD

---

## 🎯 KPIs Fase 9

- QR codes gerados: _/mês (meta: 500+)
- Taxa sucesso CMD: _% (meta: 98%)
- Certificados verificáveis: _% (meta: 100%)
- Tempo assinatura CMD: ~30s (meta: <60s)

---

## 📝 Próximos Passos

### Fase 10: CRM Entidades + Propostas (Médio Impacto)
Implementar:
1. UI completa para CRM EntidadeCliente
2. CRUD de propostas comerciais
3. Gestão formadores (CCP/CC)
4. Orçamentos e contratos
5. Integração com faturação

---

**Status**: ✅ READY FOR PHASE 10
**Próxima**: CRM Entidades + Propostas Comerciais
**Estimativa**: 2-3 sprints
**Diferenciador**: Confiança legal + verificação pública = **líder PT**
