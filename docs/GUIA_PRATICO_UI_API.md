# 🎓 GUIA PRÁTICO – Como Usar UI + API

> **Audiência**: Desenvolvedores / Product Owners  
> **Tempo de leitura**: 10 minutos  
> **Exemplos**: Copy-paste prontos

---

## 1️⃣ Setup Inicial

### A) Envolver app em ThemeProvider

```typescript
// app/layout.tsx
'use client';

import { ThemeProvider } from '@/contexts/ThemeContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>
          <Navigation />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### B) Adicionar CSS Variables

```css
/* globals.css */
:root {
  --color-primary: #2563eb;
  --color-secondary: #64748b;
  --color-background: #ffffff;
  --color-text: #1e293b;
  --color-accent: #f59e0b;
  --theme: light;
}

.dark {
  --color-background: #0f172a;
  --color-text: #f1f5f9;
  --color-secondary: #cbd5e1;
}
```

---

## 2️⃣ Usar Tema em Componentes

### Exemplo 1: Botão com Tema

```typescript
'use client';

import { useTheme } from '@/contexts/ThemeContext';

export const MyButton = () => {
  const { primaryColor, theme } = useTheme();

  return (
    <button
      style={{
        backgroundColor: primaryColor,
        color: '#ffffff',
      }}
      className="px-4 py-2 rounded-lg font-semibold hover:shadow-lg"
    >
      Clica-me
    </button>
  );
};
```

### Exemplo 2: Dark Mode Toggle

```typescript
'use client';

import { useTheme } from '@/contexts/ThemeContext';

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="px-4 py-2 rounded-lg"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
};
```

### Exemplo 3: Cor Customizada pelo Utilizador

```typescript
'use client';

import { useTheme } from '@/contexts/ThemeContext';

export const ColorPicker = () => {
  const { primaryColor, setPrimaryColor } = useTheme();

  return (
    <div>
      <label>Escolha sua cor primária:</label>
      <input
        type="color"
        value={primaryColor}
        onChange={(e) => setPrimaryColor(e.target.value)}
        className="w-16 h-16 rounded-lg cursor-pointer"
      />
      <p>Cor selecionada: {primaryColor}</p>
    </div>
  );
};
```

---

## 3️⃣ Chamar API Settings

### Obter Tema do Utilizador

```typescript
// Frontend
async function carregarMeuTema() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/settings/tema', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  console.log('Meu tema:', data.themeSettings);
  // Output: { primaryColor: '#2563eb', theme: 'dark', fontSize: 'large', ... }
}
```

### Atualizar Tema

```typescript
async function atualizarMeuTema() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/settings/tema', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      theme: 'dark',
      fontSize: 'large',
      primaryColor: '#dc2626',
    }),
  });

  const data = await response.json();
  console.log('Atualizado:', data);
}
```

### Obter Paleta de Cores (incluindo Tenant branding)

```typescript
async function obterPaletaCompleta() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/settings/paleta', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const paleta = await response.json();
  console.log('Paleta aplicada:', paleta);
  // Output: 
  // {
  //   primaryColor: '#2563eb',      (user override)
  //   secondaryColor: '#64748b',    (tenant default)
  //   backgroundColor: '#ffffff',   (system default)
  //   ...
  // }
}
```

---

## 4️⃣ Admin: Configurar Branding da Empresa

```typescript
'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { TenantAdminPanel } from '@/components/settings/TenantAdminPanel';

export default function AdminPage() {
  // TenantAdminPanel já faz tudo:
  // 1. Carrega branding atual
  // 2. Valida que user.role === 'tenant_admin'
  // 3. PUT /api/settings/tenant/branding quando submit
  
  return <TenantAdminPanel />;
}
```

**Resultado da chamada API:**

```bash
PUT /api/settings/tenant/branding
{
  "companyName": "Tech Solutions",
  "logoUrl": "https://...",
  "primaryColor": "#2563eb",
  "supportEmail": "support@tech.pt",
  "supportPhone": "+351 21 1234567",
  "footerText": "© 2026 Tech Solutions"
}

Response:
{
  "sucesso": true,
  "mensagem": "Branding atualizado com sucesso",
  "branding": { ... }
}
```

---

## 5️⃣ Utilizador: Personalizar Interface

```typescript
'use client';

import { UserSettingsPanel } from '@/components/settings/UserSettingsPanel';

export default function SettingsPage() {
  // UserSettingsPanel oferece:
  // ✓ Escolher tema (light/dark/auto)
  // ✓ Cor primária (paleta ou custom)
  // ✓ Tamanho fonte (small/medium/large)
  // ✓ Idioma (pt/en)
  // ✓ Layout (sidebar colapsado)
  
  return <UserSettingsPanel />;
}
```

---

## 6️⃣ CRM: Usar Componentes

### Dashboard

```typescript
'use client';

import { CRMDashboard } from '@/components/crm/CRMDashboard';

export default function CRMPage() {
  return <CRMDashboard />;
  
  // Mostra:
  // • 4 KPI cards (entidades, formandos, propostas, faturação)
  // • 2 gráficos Recharts (propostas por mês, taxa aceite)
  // • 3 botões ação rápida (nova entidade, proposta, formadores)
}
```

### Criar Entidade

```typescript
'use client';

import { FormEntidade } from '@/components/crm/FormEntidade';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NovaEntidadePage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (formData) => {
    setLoading(true);
    try {
      const response = await fetch('/api/crm/entidades', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('Entidade criada! ✅');
        router.push('/plataforma/crm/entidades');
      }
    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Nova Entidade</h1>
      <FormEntidade onSubmit={handleSubmit} loading={loading} />
    </div>
  );
}
```

### Listar Entidades

```typescript
'use client';

import { ListaEntidades } from '@/components/crm/ListaEntidades';

export default function EntidadesPage() {
  return <ListaEntidades />;
  
  // Mostra:
  // • Barra busca + filtro tipo
  // • Tabela com 6 colunas (nome, NIF, email, tipo, status, ações)
  // • Links para detalhe de cada entidade
}
```

---

## 7️⃣ API: Chamadas Diretas

### Criar Entidade

```bash
curl -X POST http://localhost:3000/api/crm/entidades \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nif": "500123456",
    "nome": "Tech Solutions PT",
    "email": "contact@tech.pt",
    "telefone": "+351 21 1234567",
    "tipo": "empresa",
    "contactoPrincipal": "João Silva"
  }'

Response:
{
  "id": "uuid-123",
  "nif": "500123456",
  "nome": "Tech Solutions PT",
  "status": "ativa",
  "criadaEm": "2026-06-03T10:00:00Z"
}
```

### Listar Entidades

```bash
curl -X GET "http://localhost:3000/api/crm/entidades?search=Tech&tipo=empresa" \
  -H "Authorization: Bearer $TOKEN"

Response:
{
  "entidades": [
    {
      "id": "uuid-123",
      "nif": "500123456",
      "nome": "Tech Solutions PT",
      "email": "contact@tech.pt",
      "tipo": "empresa",
      "ativa": true,
      "criadaEm": "2026-06-03T10:00:00Z"
    }
  ],
  "total": 1,
  "pagina": 1
}
```

### Criar Proposta

```bash
curl -X POST http://localhost:3000/api/crm/entidades/uuid-123/propostas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cursoId": "curso-uuid",
    "descricao": "Proposta curso especializado",
    "valor": 1500.00,
    "dataValidade": "2026-09-03"
  }'

Response:
{
  "id": "prop-uuid",
  "codigo": "PROP-1717404000-A1B2C3D4",
  "estado": "RASCUNHO",
  "valor": 1500.00,
  "criadaEm": "2026-06-03T10:00:00Z"
}
```

### Obter Plano Atual

```bash
curl -X GET http://localhost:3000/api/settings/tenant/plano \
  -H "Authorization: Bearer $TOKEN"

Response:
{
  "tenantId": "tenant-uuid",
  "planoAtual": {
    "id": "plan_professional",
    "nome": "Professional",
    "preco": 299,
    "features": ["Tudo do Starter", "Inspeção automática", "..."],
    "limites": {
      "formadores": 50,
      "cursos": 100,
      "formandos": 1000
    }
  },
  "status": "ativo",
  "diasRestantes": 25
}
```

---

## 8️⃣ Validação & Tratamento de Erros

### Validação Frontend (FormEntidade)

```typescript
const validarFormulario = (): boolean => {
  const newErrors: Record<string, string> = {};

  if (!formData.nif) newErrors.nif = 'NIF é obrigatório';
  else if (!/^\d{9}$/.test(formData.nif)) newErrors.nif = 'NIF deve ter 9 dígitos';

  if (!formData.email) newErrors.email = 'Email é obrigatório';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
    newErrors.email = 'Email inválido';

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

### Tratamento de Permissões

```typescript
// Backend verifica automaticamente
PUT /api/settings/tenant/branding

// Se user.role !== 'tenant_admin':
Response 403:
{
  "statusCode": 403,
  "message": "Apenas gestor do tenant pode atualizar branding"
}
```

---

## 9️⃣ Performance Tips

### Lazy Load Componentes Pesados

```typescript
import dynamic from 'next/dynamic';

const CRMDashboard = dynamic(
  () => import('@/components/crm/CRMDashboard'),
  { loading: () => <div>Carregando gráficos...</div> }
);

export default function CRMPage() {
  return <CRMDashboard />;
}
```

### Cache Settings

```typescript
// Guardar em localStorage
useEffect(() => {
  const cachedSettings = localStorage.getItem('user-settings');
  if (cachedSettings) {
    setSettings(JSON.parse(cachedSettings));
  }
}, []);
```

### Debounce API Calls

```typescript
import { useMemo } from 'react';

const debouncedSave = useMemo(() => {
  return debounce((settings) => {
    fetch('/api/settings/tema', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }, 1000);
}, []);

// Chamar sem sobrecarregar API
debouncedSave(updatedSettings);
```

---

## 🔟 Troubleshooting

### Cores Não Mudam

**Problema**: Definições de cores não aparecem.

**Solução**:
1. Verificar localStorage: `console.log(localStorage.getItem('token'))`
2. Verificar ThemeContext: `const { primaryColor } = useTheme()`
3. Verificar CSS variables: `console.log(getComputedStyle(document.documentElement).getPropertyValue('--color-primary'))`

### Dark Mode Não Funciona

**Problema**: Dark mode não está aplicando.

**Solução**:
1. Verificar classe `.dark` em `<html>` ou `<body>`
2. Verificar Tailwind config inclui `darkMode: 'class'`
3. Forçar re-render: `setTheme('dark')` then `setTheme('light')`

### API Retorna 401

**Problema**: Unauthorized ao chamar endpoint.

**Solução**:
1. Verificar token: `localStorage.getItem('token')`
2. Verificar header: `Authorization: Bearer ${token}`
3. Verificar expiry: JWT pode estar expirado

---

## 📚 Referências

- [Documentação Completa](./docs/)
- [Componentes React](./apps/web/components/)
- [API Endpoints](./apps/api/src/)
- [TypeScript Interfaces](./apps/api/src/crm/dto/)

---

**Pronto para começar?** ✅ Todos os componentes estão prontos para usar!

