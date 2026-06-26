# 🎨 NexiForma – UI Professional + SaaS Model

> **Status**: ✅ Componentes React finalizados  
> **Fases**: 8, 9, 10 COMPLETAS + UI/Settings  
> **Data**: 2026-06-03

---

## 📋 Índice

1. [Modelo de Negócio SaaS](#modelo-saas)
2. [Arquitetura de Theming](#arquitetura-theming)
3. [Componentes Implementados](#componentes)
4. [Fluxo de Utilizador](#fluxo-utilizador)
5. [Configurações: Utilizador vs Tenant](#configuracoes)
6. [Guia de Implementação](#guia-implementacao)

---

## 🏢 Modelo SaaS {#modelo-saas}

NexiForma é uma **plataforma SaaS multi-tenant** para gestão de formação profissional com conformidade DGERT portuguesa.

### Planos de Subscrição

```
┌──────────────────────────────────────────────────────────────────┐
│  STARTER ($99/mês)                                              │
├──────────────────────────────────────────────────────────────────┤
│ • 5 formadores | 10 cursos | 100 formandos                       │
│ • Gestão básica + Certificados                                   │
│ • Suporte por email                                              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  PROFESSIONAL ($299/mês)  ⭐ RECOMENDADO                          │
├──────────────────────────────────────────────────────────────────┤
│ • 50 formadores | 100 cursos | 1000 formandos                    │
│ • Pacote inspeção DGERT automático                               │
│ • QR certificados + Verificação pública                          │
│ • CRM avançado + Relatórios                                      │
│ • API REST acesso                                                │
│ • Suporte email + telefone                                       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  ENTERPRISE ($999/mês)                                           │
├──────────────────────────────────────────────────────────────────┤
│ • Ilimitado tudo                                                 │
│ • SIGO API integrado (conexão DGERT)                             │
│ • Assinatura qualificada CMD                                     │
│ • PWA customizado com logo                                       │
│ • Suporte 24/7 + gestor dedicado                                 │
│ • SLA 99.9% garantido                                            │
└──────────────────────────────────────────────────────────────────┘
```

### Modelo de Faturação

- **Ciclo**: Mensal (renovação automática)
- **Cancelamento**: 30 dias de pré-aviso
- **Upgrade**: Imediato (cobrança pro-rata)
- **Downgrade**: Efetivo próximo período

---

## 🎨 Arquitetura de Theming {#arquitetura-theming}

### Hierarquia de Customização

```
┌─────────────────────────────────────────────────────────┐
│  1️⃣  DEFAULTS GLOBAIS (Sistema)                        │
│     primaryColor: #2563eb, fontSize: medium, etc       │
└─────────────────────────────────────────────────────────┘
            ↓ Override ↓
┌─────────────────────────────────────────────────────────┐
│  2️⃣  TENANT SETTINGS (Gestor Empresa)                  │
│     Logo, cores, email suporte, footer text            │
│     ⚠️ Afeta TODA a empresa                             │
└─────────────────────────────────────────────────────────┘
            ↓ Override ↓
┌─────────────────────────────────────────────────────────┐
│  3️⃣  USER SETTINGS (Utilizador Individual)             │
│     Tema (light/dark), cor primária, idioma             │
│     ✅ Apenas sua experiência pessoal                   │
└─────────────────────────────────────────────────────────┘
```

### CSS Variables (Tailwind Integration)

```css
:root {
  --color-primary: #2563eb;      /* De USER > TENANT > DEFAULT */
  --color-secondary: #64748b;
  --color-background: #ffffff;   /* Light/Dark automático */
  --color-text: #1e293b;
  --color-accent: #f59e0b;
  --theme: light;                /* light | dark | auto */
}

/* Dark mode automático */
.dark {
  --color-background: #0f172a;
  --color-text: #f1f5f9;
  --color-secondary: #cbd5e1;
}
```

---

## 📦 Componentes Implementados {#componentes}

### Backend (NestJS)

| Arquivo | Função | Rotas |
|---------|--------|-------|
| `settings.service.ts` | Lógica de theming e branding | – |
| `settings.controller.ts` | Endpoints REST | `GET/PUT /settings/*` |
| `settings.module.ts` | Registração DI | – |

### Frontend (Next.js React)

| Componente | Localização | Funcionalidade |
|-----------|-----------|-----------------|
| `ThemeContext.tsx` | `/contexts/` | Provider global de tema |
| `CRMDashboard.tsx` | `/components/crm/` | Dashboard com gráficos |
| `FormEntidade.tsx` | `/components/crm/` | Formulário criar entidade |
| `ListaEntidades.tsx` | `/components/crm/` | Tabela listagem |
| `FormProposta.tsx` | `/components/crm/` | Formulário proposta |
| `UserSettingsPanel.tsx` | `/components/settings/` | Definições pessoal |
| `TenantAdminPanel.tsx` | `/components/settings/` | Admin empresa |

---

## 🔄 Fluxo de Utilizador {#fluxo-utilizador}

### 1️⃣ Primeiro Acesso (Onboarding)

```
Login
  ↓
ThemeProvider carrega settings do servidor
  ├─ GET /api/settings/tema (user settings)
  ├─ GET /api/settings/paleta (override hierarchy)
  ↓
CSS variables aplicadas
  ↓
Dashboard aparece com tema personalizado
```

### 2️⃣ Personalizar Experiência (Utilizador)

```
Menu → Definições → Meu Perfil
  ↓
UserSettingsPanel abre
  ├─ Tema (light/dark)
  ├─ Cor primária (seleção/custom)
  ├─ Tamanho fonte
  ├─ Idioma (pt/en)
  ↓
PUT /api/settings/tema {tema: 'dark', fontSize: 'large'}
  ↓
Localstorage atualiza
  ↓
Componentes re-render com nova paleta
```

### 3️⃣ Configurar Empresa (Admin do Tenant)

```
Menu → Administração → Empresa
  ↓
TenantAdminPanel abre
  ├─ Verificar: user.role === 'tenant_admin'?
  ├─ Se NÃO → ForbiddenException
  ↓
Se SIM:
  ├─ Upload logo
  ├─ Definir cores corporativas
  ├─ Email/tel suporte
  ↓
PUT /api/settings/tenant/branding
  ↓
Recarregar para toda empresa
```

### 4️⃣ Visualizar Plano Subscrição

```
Menu → Administração → Plano
  ↓
GET /api/settings/tenant/plano
  ├─ Plano atual
  ├─ Dias restantes
  ├─ Status
  ↓
Mostrar planos disponíveis (GET /api/settings/planos)
  ↓
Gestor pode fazer upgrade/downgrade
```

---

## ⚙️ Configurações: Utilizador vs Tenant {#configuracoes}

### Utilizador (Self-Service)

✅ **Pode alterar**:
- Tema visual (light/dark)
- Cor primária (customizável)
- Tamanho de fonte
- Idioma preferido
- Layout (sidebar colapsado/expandido)

❌ **Não pode alterar**:
- Logo da empresa
- Email corporativo
- Cores de branding
- Plano de subscrição

**Armazenamento**: `users.settings` (JSON PostgreSQL)

### Tenant Admin (Gestor Empresa)

✅ **Pode alterar**:
- Logo e favicon
- Cores corporativas (primária, secundária, accent)
- Email e telefone suporte
- Texto footer
- CSS customizado
- Upgrade/downgrade plano

❌ **Não pode alterar**:
- Dados de outros tenants
- Preços (definidos pelo sistema)
- Permissões de utilizadores

**Armazenamento**: `tenants.settings` (JSON PostgreSQL)

**Restrição**: 
```typescript
// Backend enforça
if (user.role !== 'tenant_admin') {
  throw new ForbiddenException('Acesso negado');
}
```

---

## 🚀 Guia de Implementação {#guia-implementacao}

### Setup Inicial (Backend)

1. **Registrar Settings Module**
```typescript
// app.module.ts
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [SettingsModule, /* ... */],
})
export class AppModule {}
```

2. **Adicionar campos Prisma**
```prisma
model User {
  // ...
  settings  Json?  // { primaryColor, theme, fontSize, language, etc }
}

model Tenant {
  // ...
  settings  Json?  // { logoUrl, primaryColor, supportEmail, etc }
}
```

3. **Executar migração**
```bash
npx prisma migrate dev --name add-settings
```

### Setup Inicial (Frontend)

1. **Envolver App em ThemeProvider**
```typescript
// layout.tsx
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

2. **Usar Hook em componentes**
```typescript
import { useTheme } from '@/contexts/ThemeContext';

export const MyComponent = () => {
  const { primaryColor, theme } = useTheme();
  
  return (
    <div style={{ color: primaryColor }}>
      Conteúdo
    </div>
  );
};
```

3. **Adicionar CSS Global**
```css
/* globals.css */
:root {
  --color-primary: #2563eb;
  --color-secondary: #64748b;
  /* ... */
}

.dark {
  --color-background: #0f172a;
  --color-text: #f1f5f9;
}
```

### Páginas a Implementar

```
apps/web/app/plataforma/
├── crm/
│   ├── page.tsx              # Dashboard CRM
│   ├── entidades/
│   │   ├── page.tsx          # Lista entidades
│   │   ├── nova/page.tsx     # Criar entidade
│   │   └── [id]/page.tsx     # Detalhe entidade
│   ├── propostas/
│   │   ├── page.tsx          # Lista propostas
│   │   ├── nova/page.tsx     # Criar proposta
│   │   └── [id]/page.tsx     # Detalhe proposta
│   └── formadores/
│       ├── page.tsx          # Lista formadores
│       └── [id]/page.tsx     # Detalhe formador
└── definicoes/
    ├── perfil/page.tsx       # User settings
    └── empresa/page.tsx      # Tenant admin (se admin)
```

### Exemplo Page (CRM Entidades)

```typescript
// app/plataforma/crm/entidades/page.tsx
import { ListaEntidades } from '@/components/crm/ListaEntidades';

export default function EntidadesPage() {
  return (
    <div className="p-6">
      <ListaEntidades />
    </div>
  );
}
```

---

## 📊 Endpoints Criados

### Settings Utilizador

```bash
GET    /api/settings/tema
PUT    /api/settings/tema
GET    /api/settings/paleta
GET    /api/settings/css
```

### Settings Tenant (Admin)

```bash
GET    /api/settings/tenant/branding
PUT    /api/settings/tenant/branding
GET    /api/settings/tenant/plano
```

### Público

```bash
GET    /api/settings/planos
```

---

## 🎯 Próximos Passos

- [ ] **Hoje**: Implementar páginas CRM (entidades, propostas)
- [ ] **Amanhã**: Componentes de gestão formadores
- [ ] **Fim semana**: Testes integração UI
- [ ] **Próxima semana**: Deploy staging
- [ ] **Fase 11**: PWA + Quiz engine
- [ ] **Fase 12**: SIGO API integration

---

## 📚 Referências

**Documentação Relacionada**:
- [RESUMO_EXECUTIVO_FASES_8-10.md](./RESUMO_EXECUTIVO_FASES_8-10.md)
- [FASE_10_EM_PROGRESSO.md](./FASE_10_EM_PROGRESSO.md)
- [PROXIMAS_TAREFAS.md](./PROXIMAS_TAREFAS.md)

**Design System**:
- Tailwind CSS v4
- Recharts (gráficos)
- React Context (state management)

---

## ✅ Checklist Finalização

- [x] Settings Service (Backend)
- [x] Settings Controller (Backend)
- [x] ThemeContext (Frontend)
- [x] CRMDashboard component
- [x] FormEntidade component
- [x] ListaEntidades component
- [x] FormProposta component
- [x] UserSettingsPanel component
- [x] TenantAdminPanel component
- [ ] Páginas Next.js (routing)
- [ ] Testes integração
- [ ] Deploy staging

---

**Status**: 🎉 **COMPONENTES PRONTOS** – Falta páginas e testes  
**Próxima Revisão**: Após implementação de páginas (2-3 dias)

